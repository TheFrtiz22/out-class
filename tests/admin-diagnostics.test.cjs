const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
function harness(overrides = {}, faults = {}) {
  const logs = [], cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const m = { exports: {} };
    const mocks = { 'node:crypto': { ...require('node:crypto'), randomUUID: () => { if (faults.uuid) throw Error('private UUID failure'); return require('node:crypto').randomUUID(); } }, ...overrides, 'next/navigation': { unstable_rethrow: require('next/dist/client/components/unstable-rethrow.server').unstable_rethrow, redirect: url => { throw Object.assign(Error('redirect'), { url }); } } };
    new Function('require', 'module', 'exports', 'console', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(name => mocks[name] || (name.startsWith('@/') ? load(name.slice(2) + (name.includes('components/') ? '.tsx' : '.ts')) : require(name)), m, m.exports, { error: value => { if (faults.logger) throw Error('private logger failure'); logs.push(JSON.parse(value)); } });
    return cache[file] = m.exports;
  }
  return { ...load('utils/admin-page.ts'), ...load('lib/admin-failure.ts'), logs, load };
}
for (const code of ['ADMIN_AUTH_REQUIRED', 'ADMIN_ACCESS_DENIED', 'ADMIN_ELEVATION_REQUIRED', 'ADMIN_MFA_REQUIRED', 'ADMIN_GRANT_REVOKED', 'ADMIN_SESSION_EXPIRED', 'ADMIN_SUPPORT_SESSION_CONFLICT']) {
  test(`${code} retains secure login denial and logs only safe fields`, async () => {
    const h = harness();
    await assert.rejects(h.adminPageLoad('/platform', async () => { throw new h.AdminAccessError(code, 'secret'); }), e => e.url === '/platform/login');
    assert.equal(h.logs[0].code, code);
    assert.ok(!JSON.stringify(h.logs).includes('secret'));
  });
}
test('successful overview returns data; unexpected loader and guard errors never return protected data or redirect', async () => {
  const h = harness();
  assert.deepEqual(await h.adminPageLoad('/platform', async () => ({ students: 2 })), { value: { students: 2 } });
  assert.equal(h.logs.length, 0);
  for (const code of ['ADMIN_DATA_LOAD_FAILED', 'ADMIN_UNKNOWN_SERVER_ERROR']) {
    const result = await h.adminPageLoad('/platform', async () => { throw Error('token cookie database stack secret'); }, code);
    assert.equal(result.value, undefined);
    assert.match(result.supportCode, new RegExp('^' + code + ':'));
    assert.ok(!JSON.stringify(h.logs).includes('secret'));
    const { AdminRecovery } = h.load('components/admin/admin-recovery.tsx');
    const html = require('react-dom/server').renderToStaticMarkup(AdminRecovery(result));
    assert.match(html, /Admin temporarily unavailable/);
    assert.ok(!html.includes('/platform/login'));
  }
});
test('provider classification requires explicit Supabase denial semantics', () => {
  const h = harness();
  for (const error of [
    { status: 401, code: 'bad_jwt' }, { status: 403, code: 'insufficient_aal' },
    { status: 400, code: 'invalid_credentials' }, { status: 422, code: 'session_not_found' },
    { name: 'AuthSessionMissingError', status: 400 }, { name: 'AuthInvalidJwtError', code: 'invalid_jwt', status: 400 },
  ]) assert.equal(h.providerAuthFailure(error), true, JSON.stringify(error));
  for (const status of [404, 405, 429, 500, 503]) {
    assert.equal(h.providerAuthFailure({ status }), false);
    assert.equal(h.providerAuthFailure({ status, code: 'bad_jwt' }), false, 'operational status overrides contradictory denial code');
  }
  for (const error of [
    null, undefined, 'malformed', {}, { status: '401' }, { status: 401 }, { status: 403 },
    { status: 401, code: 'invalid_api_key' }, { status: 403, code: 'mfa_totp_verify_not_enabled' },
    { status: 400, code: 'bad_json' }, { status: 400, code: { secret: 'malformed' } },
    { name: 'AuthInvalidTokenResponseError', status: 500 }, { name: 'AuthUnknownError', status: 401, code: 'bad_jwt' },
  ]) assert.equal(h.providerAuthFailure(error), false, JSON.stringify(error));
});

test('overview actually renders recovery instead of login when its loader throws', async () => {
  const h = harness({ '@/actions/admin-workspace': { getAdminOverview: async () => { throw Error('private database details'); } }, '@/components/product/page-header': { PageHeader: () => null } });
  const Page = h.load('app/platform/page.tsx').default;
  const html = require('react-dom/server').renderToStaticMarkup(await Page());
  assert.match(html, /ADMIN_DATA_LOAD_FAILED:/);
  assert.ok(!html.includes('private database details'));
  assert.ok(!html.includes('Needs Attention'));
  assert.ok(!html.includes('/platform/login'));
});
test('overview actually renders protected metrics on loader success', async () => {
  const metrics = { students: 2, clubs: 1, eventApprovals: 0, clubApprovals: 0, reports: 0, upcomingEvents: 0, supportItems: 0 };
  const h = harness({ '@/actions/admin-workspace': { getAdminOverview: async () => metrics }, '@/components/product/page-header': { PageHeader: () => null } });
  const html = require('react-dom/server').renderToStaticMarkup(await h.load('app/platform/page.tsx').default());
  assert.match(html, /Needs Attention/);
  assert.ok(!html.includes('temporarily unavailable'));
});

test('Next dynamic-render signals and navigation control flow are rethrown without diagnostic noise', async () => {
  const h = harness();
  const { DynamicServerError } = require('next/dist/client/components/hooks-server-context');
  const error = new DynamicServerError('cookies');
  await assert.rejects(h.adminPageLoad('/platform', async () => { throw error; }), e => e === error);
  assert.equal(h.logs.length, 0);
});
test('eligibility distinguishes expected denial from operational failure without leaking details', async () => {
  let failure;
  const h = harness({ '@/utils/platform-admin': { requirePlatformAdminEligibility: async () => { if (failure) throw failure; return { id: 'admin' }; } } });
  const route = h.load('app/api/platform/eligibility/route.ts');
  assert.deepEqual(await (await route.GET()).json(), { eligible: true });
  failure = new h.AdminAccessError('ADMIN_ACCESS_DENIED', 'denied');
  const denied = await route.GET();
  assert.equal(denied.status, 200);
  assert.deepEqual(await denied.json(), { eligible: false });
  failure = Error('private database details');
  const broken = await route.GET(), body = await broken.json();
  assert.equal(broken.status, 500);
  assert.equal(body.eligible, false);
  assert.match(body.supportCode, /^ADMIN_UNKNOWN_SERVER_ERROR:/);
  assert.ok(!JSON.stringify(body).includes('private database details'));
});

for (const faults of [{ logger: true }, { uuid: true }, { logger: true, uuid: true }]) {
  test(`diagnostic faults ${JSON.stringify(faults)} preserve recovery, denial and API classification`, async () => {
    const h = harness({
      '@/actions/admin-workspace': { getAdminOverview: async () => { throw Error('private loader failure'); } },
      '@/components/product/page-header': { PageHeader: () => null },
      '@/utils/platform-admin': { requirePlatformAdminEligibility: async () => { throw Error('private provider failure'); } },
    }, faults);
    const Page = h.load('app/platform/page.tsx').default;
    const html = require('react-dom/server').renderToStaticMarkup(await Page());
    assert.match(html, /Admin temporarily unavailable/);
    assert.match(html, /ADMIN_DATA_LOAD_FAILED:/);
    assert.ok(!/Needs Attention|private|platform\/login/.test(html));
    const first = await h.adminPageLoad('/platform', async () => { throw Error('private original'); }, 'ADMIN_DATA_LOAD_FAILED');
    const second = await h.adminPageLoad('/platform', async () => { throw Error('private original'); }, 'ADMIN_DATA_LOAD_FAILED');
    assert.equal(first.value, undefined);
    assert.match(first.supportCode, /^ADMIN_DATA_LOAD_FAILED:/);
    assert.notEqual(first.supportCode, second.supportCode);
    if (faults.uuid) assert.match(first.supportCode, /:fallback-\d+$/);
    await assert.rejects(h.adminPageLoad('/platform', async () => { throw new h.AdminAccessError('ADMIN_MFA_REQUIRED', 'private denial'); }), e => e.url === '/platform/login');
    const api = await h.load('app/api/platform/eligibility/route.ts').GET();
    assert.equal(api.status, 500);
    const body = await api.json();
    assert.equal(body.eligible, false);
    assert.match(body.supportCode, /^ADMIN_UNKNOWN_SERVER_ERROR:/);
    assert.ok(!JSON.stringify(body).includes('private'));
    if (!faults.logger) {
      assert.ok(h.logs.some(log => log.code === 'ADMIN_MFA_REQUIRED' && log.category === 'access'));
      assert.ok(h.logs.some(log => log.supportCode === first.supportCode && log.category === 'operational'));
      assert.ok(!JSON.stringify(h.logs).includes('private'));
    }
  });
}

test('new school-request Admin route preserves denials and recovers from operational guard failures', async () => {
  let failure;
  const h = harness({
    '@/utils/platform-admin': { requirePlatformAdmin: async () => { if (failure) throw failure; return { id: 'admin' }; } },
    '@/components/product/page-header': { PageHeader: () => null },
    '@/components/admin/school-request-review': { SchoolRequestReview: () => require('react').createElement('p', null, 'Protected school request review') },
  });
  const Page = h.load('app/platform/school-requests/page.tsx').default;
  failure = Error('private database outage');
  const html = require('react-dom/server').renderToStaticMarkup(await Page());
  assert.match(html, /Admin temporarily unavailable/);
  assert.match(html, /ADMIN_UNKNOWN_SERVER_ERROR:/);
  assert.ok(!/Protected school request review|private|platform\/login/.test(html));
  assert.equal(h.logs.at(-1).route, '/platform/school-requests');
  assert.equal(h.logs.at(-1).category, 'operational');
  for (const code of ['ADMIN_AUTH_REQUIRED', 'ADMIN_ACCESS_DENIED', 'ADMIN_MFA_REQUIRED', 'ADMIN_ELEVATION_REQUIRED', 'ADMIN_GRANT_REVOKED', 'ADMIN_SESSION_EXPIRED', 'ADMIN_SUPPORT_SESSION_CONFLICT']) {
    failure = new h.AdminAccessError(code, 'denied');
    await assert.rejects(Page(), error => error.url === '/platform/login');
  }
  failure = undefined;
  const allowed = require('react-dom/server').renderToStaticMarkup(await Page());
  assert.match(allowed, /Protected school request review/);
  assert.ok(!allowed.includes('temporarily unavailable'));
});

test('signed-out Admin login uses the canonical login route and preserves its Admin return destination', () => {
  const h = harness({
    '@/contexts/auth-context': { useAuth: () => ({ user: null, loading: false, isImpersonating: false }) },
    '@/contexts/demo-context': { useDemoMode: () => ({ isDemoEnabled: false }) },
    '@/components/product/page-header': { PageHeader: () => null },
    '@/components/ui/button': { Button: () => null },
    '@/components/ui/input': { Input: () => null },
  });
  const Page = h.load('app/platform/login/page.tsx').default;
  const html = require('react-dom/server').renderToStaticMarkup(require('react').createElement(Page));
  assert.match(html, /href="\/login\?next=%2Fplatform"/);
  assert.ok(!html.includes('view=auth'));
});
