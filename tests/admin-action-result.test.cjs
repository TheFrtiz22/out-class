// Platform admin refusals (stale password/MFA check and the like) are returned results, so production
// does not mask them as a 500 and the console can send the administrator to /platform/login.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const { refused } = require('./helpers/action-result.cjs');
const cache = new Map();
function load(file, mocks = {}) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports);
  return mod.exports;
}
const failure = load('lib/admin-failure.ts');
const stale = () => { throw new failure.AdminAccessError('ADMIN_ELEVATION_REQUIRED', 'Verify your password and authenticator again at /platform/login before this sensitive action.'); };

test('adminActionResult returns AdminAccessError as a refusal and rethrows anything else', async () => {
  const outcome = await refused(failure.adminActionResult(async () => stale(), 'probe'), /\/platform\/login/);
  assert.equal(outcome.code, 'ADMIN_ELEVATION_REQUIRED');
  assert.ok(failure.ADMIN_REVERIFY_CODES.includes(outcome.code));
  await assert.rejects(failure.adminActionResult(async () => { throw new Error('database down'); }, 'probe'), /database down/);
  // A non-admin probe is not a re-verify prompt: it still throws, so it keeps reaching Sentry.
  await assert.rejects(failure.adminActionResult(async () => { throw new failure.AdminAccessError('ADMIN_ACCESS_DENIED', 'Platform admin access required.'); }, 'probe'), e => e instanceof failure.AdminAccessError && e.code === 'ADMIN_ACCESS_DENIED');
});

test('the Users console actions return a stale elevation as a refusal', async () => {
  const api = load('actions/admin-workspace.ts', {
    'next/cache': { revalidatePath() {}, revalidateTag() {} }, '@/utils/prisma': { prisma: {} }, '@/utils/platform-admin': { requirePlatformAdmin: async () => stale() },
    '@/utils/auth': {}, '@/actions/platform-organization-onboarding': {}, '@/actions/club-onboarding': {}, '@/actions/platform-admin': {},
    '@/utils/club-onboarding': {}, '@/utils/email': {}, '@/utils/invitation-delivery': {}, '@/utils/invitation-background': {},
  });
  const id = '00000000-0000-4000-8000-000000000001', reason = 'Investigating a support request.';
  for (const call of [api.inspectAdminStudent(id, reason), api.resendAdminStudentInvitation(id, reason)])
    assert.equal((await refused(call, /Verify your password/)).code, 'ADMIN_ELEVATION_REQUIRED');
});
