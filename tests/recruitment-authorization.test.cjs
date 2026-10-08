const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function load(file, mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.slice(2) + '.ts', mocks) : require(n), mod, mod.exports);
  return mod.exports;
}
const operations = {
  move: api => api.moveApplicantRound({ clubId: id(1), applicationId: id(2), newRoundId: id(3) }),
  decision: api => api.setApplicationStatus({ clubId: id(1), applicationId: id(2), status: 'ACCEPTED' }),
  anonymity: api => api.setRoundAnonymousReview(id(1), id(3), true),
  testRequirement: api => api.setClubTestRequirement(id(1), 'OPTIONAL'),
  anonymousContent: api => api.saveAnonymousReviewContent(id(1), id(2), 'Safe content', true),
  reveal: api => api.revealApplicantIdentity(id(1), id(2), 'Resolve an application issue'),
};
for (const [operation, run] of Object.entries(operations)) for (const revocation of ['permission', 'membership', 'disabled-user']) {
  test(`${operation} rereads ${revocation} after its transaction lock`, async () => {
    let locked = false, downstream = 0;
    const tx = {
      $queryRaw: async strings => { if (strings.join('').includes('FOR UPDATE')) locked = true; return []; },
      user: { findUnique: async () => { assert.ok(locked); return { disabledAt: revocation === 'disabled-user' ? new Date() : null }; } },
      clubMember: { findUnique: async () => { assert.ok(locked); return revocation === 'membership' ? null : { status: 'ACTIVE', isOwner: revocation === 'disabled-user', permissions: [] }; } },
      application: { updateMany: async () => { downstream++; return { count: 1 }; }, findFirst: async () => { downstream++; return null; } },
      pipelineRound: { findFirst: async () => { downstream++; return null; }, updateMany: async () => { downstream++; return { count: 1 }; } },
      club: { update: async () => { downstream++; } },
      auditLog: { create: async () => { downstream++; } },
    };
    const api = load('actions/crm.ts', {
      '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx) } },
      '@/utils/auth': { requireClubPermission: async () => ({ user: { id: id(4) }, membership: { isOwner: true, status: 'ACTIVE' } }) },
      'next/cache': { revalidatePath() {} },
    });
    await assert.rejects(run(api), /access denied/); assert.equal(downstream, 0);
  });
}
test('canonical transaction gate keeps operational mutations suspended, while historical reads retain their existing suspension policy', async () => {
  const { authorizeClubTransaction } = load('lib/club-transaction-authorization.ts', {});
  const tx = {
    $queryRaw: async strings => strings.join('').includes('"suspendedAt"') ? [{ id: id(1) }] : [],
    user: { findUnique: async () => ({ disabledAt: null }) },
    clubMember: { findUnique: async () => ({ status: 'ACTIVE', permissions: ['applicants.identify'] }) },
  };
  await assert.rejects(authorizeClubTransaction(tx, id(1), id(4), ['applicants.identify']), /club is suspended/);
  assert.ok(await authorizeClubTransaction(tx, id(1), id(4), ['applicants.identify'], { allowSuspendedRead: true, readOnly: true }));
});
