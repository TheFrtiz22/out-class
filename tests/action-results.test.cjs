// Converted Server Actions return expected failures as values, because Next
// replaces thrown messages in production. These tests load real actions with
// stubbed persistence and check the returned envelope the browser receives.
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');

function loader(mocks) {
  const cache = new Map();
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), mod, mod.exports);
    return mod.exports;
  };
  return load;
}
const { userMessage } = loader({})('lib/user-message.ts');
const fallback = 'Couldn’t save your changes. Try again.';
const clubId = '00000000-0000-4000-8000-000000000001', questionId = '00000000-0000-4000-8000-000000000002';

function applications({ applicationOpen = true, profile = true, status = 'DRAFTING', failure } = {}) {
  const tx = {
    $queryRaw: async () => [],
    club: { findUnique: async () => { if (failure) throw failure; return { testRequirement: 'OPTIONAL', applicationOpen, applicationDeadline: null } } },
    studentProfile: { findUnique: async () => profile ? { id: 'profile' } : null },
    applicationQuestion: { findMany: async () => [{ id: questionId, prompt: 'Why?', type: 'ESSAY', required: true, wordLimit: 50 }] },
    pipelineRound: { findFirst: async () => ({ id: 'round' }) },
    recruitmentCycle: { findMany: async () => [] },
    application: { findFirst: async () => ({ id: 'app', status }), updateMany: async () => ({ count: status === 'DRAFTING' ? 1 : 0 }) },
    applicationAnswer: { findMany: async () => [], deleteMany: async () => {}, createMany: async () => {} },
  };
  return loader({
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'student' } }) },
    '@/utils/club-write-transaction': { clubWriteTransaction: async fn => fn(tx) },
    '@/utils/prisma': { prisma: {} },
    '@/utils/official-panel-schedule': {},
    'next/cache': { revalidatePath: () => {} },
  })('actions/applications.ts');
}
const input = { clubId, answers: [{ questionId, response: 'Because I care about it.' }] };

test('application submit returns closed intake and missing profile as safe failures, not throws', async () => {
  const closed = await applications({ applicationOpen: false }).submitApplication(input);
  assert.equal(closed.ok, false);
  assert.match(closed.error, /Applications are closed/);
  assert.equal(userMessage(closed, fallback), closed.error);
  const missing = await applications({ profile: false }).submitApplication(input);
  assert.equal(missing.ok, false);
  assert.match(userMessage(missing, fallback), /complete your unified profile/);
  const submitted = await applications({ status: 'SUBMITTED' }).saveApplicationDraft(input);
  assert.equal(submitted.ok, false);
  assert.match(submitted.error, /already been submitted/);
  // The envelope is plain data, so it survives Server Action serialization intact.
  assert.deepEqual(JSON.parse(JSON.stringify(submitted)), submitted);
});

test('application success is wrapped and unexpected errors still throw', async () => {
  const saved = await applications().submitApplication(input);
  assert.deepEqual(saved, { $action: 'outclass.action/v1', ok: true, data: { success: true, applicationId: 'app' } });
  const prismaFailure = Object.assign(new Error('\nInvalid `prisma.club.findUnique()` invocation: connection refused'), { code: 'P1001' });
  await assert.rejects(applications({ failure: prismaFailure }).saveApplicationDraft(input), error => error === prismaFailure);
});

test('decision guards return safe failures for stale offers and suspended clubs', async () => {
  const offer = status => loader({
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'leader' } }), requireClubPermission: async () => ({ user: { id: 'leader' } }) },
    '@/utils/club-write-transaction': { clubWriteTransaction: async fn => fn({ clubInvitation: { findFirst: async () => status && { id: 'offer', status } } }) },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => {} },
    '@/utils/revoke-club-invitations': { revokeClubInvitations: async () => {} },
    '@/utils/recruitment-offers': {},
    'next/cache': { revalidatePath: () => {} },
  })('actions/recruitment-offers.ts');
  const accepted = await offer('ACCEPTED').revokeRecruitmentOffer(clubId, questionId);
  assert.equal(accepted.ok, false);
  assert.match(accepted.error, /Only pending offers can be revoked/);
  assert.equal((await offer(null).revokeRecruitmentOffer(clubId, questionId)).error, 'Offer unavailable.');
  assert.deepEqual((await offer('PENDING').revokeRecruitmentOffer(clubId, questionId)).data, { success: true });

  // Shared guards thrown from other modules carry the brand across module instances.
  const suspension = loader({})('lib/club-suspension.ts');
  const suspended = loader({
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'student' } }) },
    '@/utils/club-write-transaction': { clubWriteTransaction: async fn => fn({ $queryRaw: async () => [{ id: clubId }] }) },
    '@/utils/prisma': { prisma: {} },
    '@/utils/official-panel-schedule': {},
    'next/cache': { revalidatePath: () => {} },
  })('actions/applications.ts');
  const result = await suspended.saveApplicationDraft(input);
  assert.equal(result.ok, false);
  assert.equal(result.error, suspension.CLUB_SUSPENDED_MESSAGE);
  assert.equal(result.code, 'CLUB_SUSPENDED');
});
