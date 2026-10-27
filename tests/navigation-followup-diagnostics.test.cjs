const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../scripts/navigation-followup-server-diagnostics.cjs');
const provider = require('../scripts/navigation-followup-provider-events.cjs');
const id = 'ab4a925a-4ad8-45ae-bdb2-bb23bb341923';

test('followup runtime observer is opt-in and refuses non-owned endpoints', () => {
  assert.equal(runtime.configuration({}), null);
  const env = { OUTCLASS_FOLLOWUP_SERVER_DIAGNOSTICS: '1', OUTCLASS_FOLLOWUP_DISPOSABLE: 'outclass-onboarding-e2e', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321', OUTCLASS_SITE_URL: 'http://127.0.0.1:3107' };
  assert.deepEqual(runtime.configuration(env), { authOrigin: 'http://127.0.0.1:55321' });
  for (const change of [{ NEXT_PUBLIC_SUPABASE_URL: 'https://production.example.test' }, { OUTCLASS_SITE_URL: 'http://127.0.0.1:3000' }, { OUTCLASS_FOLLOWUP_DISPOSABLE: '' }]) assert.throws(() => runtime.configuration({ ...env, ...change }));
});

test('only a validated provider request UUID leaves the response-header boundary', () => {
  const secret = 'private-cookie-token-email@example.test';
  assert.equal(runtime.providerRequestId([Buffer.from('set-cookie'), Buffer.from(secret), Buffer.from('X-Request-ID'), Buffer.from(id)]), id);
  assert.equal(runtime.providerRequestId({ authorization: secret, 'x-request-id': secret }), null);
  assert.equal(runtime.providerRequestId([['sb-request-id', id], ['private', secret]]), id);
  const c = runtime.collector({ authOrigin: 'http://127.0.0.1:55321', clock: () => 0, emit() {} }), store = c.createStore('rounds'), request = { origin: 'http://127.0.0.1:55321', path: '/auth/v1/user' };
  c.created(request, store); c.sent(request); c.headers(request, 200, { 'x-request-id': id, 'set-cookie': secret }); c.ended(request);
  assert.equal(store.auth[0].providerRequestId, id);
  assert.equal(JSON.stringify(c.finish(store, { status: 200, stage: 'finish' })).includes(secret), false);
});

test('provider duration is unknown until its numeric unit is established', () => {
  assert.equal(provider.durationMs(4200000000), null);
  assert.equal(provider.durationMs(4200000000, 'nanoseconds'), 4200);
  assert.equal(provider.durationMs('4.2s'), 4200);
  assert.equal(provider.durationMs('4200ms'), 4200);
  assert.equal(provider.durationMs('4200 cookies=secret'), null);
});

test('provider logs discard actors, cookies, request data and messages', () => {
  const secret = 'private-cookie-token-email@example.test';
  const row = { method: 'GET', path: '/user', time: '2026-10-27T00:00:00Z', request_id: id, status: 200, duration: 4200000000, message: secret, actor_id: secret, headers: { authorization: secret } };
  const event = provider.authLogEvent(JSON.stringify(row), 'nanoseconds');
  assert.equal(event.providerDurationMs, 4200); assert.equal(event.requestId, id);
  assert.equal(JSON.stringify(event).includes(secret), false);
  assert.equal(provider.authLogEvent(JSON.stringify({ ...row, path: '/user?token=' + secret })), null);
  assert.equal(provider.authLogEvent(JSON.stringify({ ...row, path: '/admin/users/' + id })), null);
  assert.equal(provider.authLogEvent(secret), null);
});

test('container counters accept only the two owned services and numeric fields', () => {
  const line = JSON.stringify({ Name: 'supabase_auth_outclass-onboarding-e2e', CPUPerc: '120.5%', MemUsage: '64MiB / 4GiB', Command: 'private-secret' });
  assert.deepEqual(provider.containerStats(line), { category: 'auth', cpuPercent: 120.5, memoryUsedBytes: 67108864, memoryLimitBytes: 4294967296 });
  assert.equal(provider.containerStats(JSON.stringify({ Name: 'production_auth', CPUPerc: '1%', MemUsage: '1MiB / 1GiB' })), null);
  for (const Name of ['constructor', '__proto__', 'toString']) assert.equal(provider.containerStats(JSON.stringify({ Name })), null);
});

test('gateway timing headers preserve zero and discard every other header', () => {
  assert.deepEqual(runtime.gatewayTimings({ 'x-kong-upstream-latency': '27', 'x-kong-proxy-latency': '0', authorization: 'secret', constructor: '1' }), { gatewayUpstreamMs: 27, gatewayProxyMs: 0 });
  assert.deepEqual(runtime.gatewayTimings(['x-kong-upstream-latency', 'private-cookie']), { gatewayUpstreamMs: null, gatewayProxyMs: null });
});

test('followup output cannot overwrite historical, root or existing evidence', () => {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
  const { validateOutput } = require('../scripts/navigation-followup-study.cjs');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'outclass-followup-output-test-'));
  try {
    const root = path.join(repo, 'docs/performance/followup-20261027'); fs.mkdirSync(root, { recursive: true });
    const valid = path.join(root, 'diagnosis-example'); assert.equal(validateOutput(valid, repo), valid);
    fs.mkdirSync(valid); assert.throws(() => validateOutput(valid, repo));
    for (const name of ['docs/performance/phase15', 'docs/performance/followup-20261027/PLAN.json', 'docs/performance/followup-20261027/nested/diagnosis-x']) assert.throws(() => validateOutput(path.join(repo, name), repo));
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});
