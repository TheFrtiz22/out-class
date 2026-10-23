const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { protocol, controlLayout, validateCohort } = require('../scripts/navigation-crossover.cjs');
const { fixtureProfile } = require('../scripts/navigation-fixture-config.cjs');

test('crossover fixes balanced AB/BA pairs and a same-build control before observing results', () => {
  for (const seed of ['0'.repeat(32), '1'.repeat(32), 'abcd'.repeat(8)]) {
    const blocks = protocol(seed), pairs = blocks.filter(b => b.position === 0);
    assert.deepEqual(blocks, protocol(seed)); assert.equal(blocks.length, 10);
    assert.equal(pairs.filter(b => b.order === 'AB').length, 2);
    assert.equal(pairs.filter(b => b.order === 'BA').length, 2);
    assert.equal(pairs[2].comparison, 'same-build-control'); assert.equal(pairs[2].order, 'AA');
    for (const pair of pairs) assert.equal(blocks.filter(b => b.pair === pair.pair).length, 2);
  }
  assert.throws(() => protocol('unbounded/arbitrary'), /match/);
});
test('the control changes only the route wrapper and retains every server authorization statement', () => {
  const source = fs.readFileSync('app/layout.tsx', 'utf8'), control = controlLayout(source);
  const security = text => text.split('\n').filter(line => !line.includes('RouteContent') && !line.includes('<div className="oc-route-content"'));
  assert.deepEqual(security(control), security(source));
  assert.ok(control.includes('>{children}</div>'));
  assert.throws(() => controlLayout(source.replace('>{children}</RouteContent>', '>other</RouteContent>')), /exactly one/);
});
test('crossover retains recoveries but rejects lost observations, access changes and failed requests', () => {
  const row = { renderedRooms: 24, openInterviewLinks: 24, requests: [{ status: 200, failed: false }] };
  const data = { samples: Array.from({ length: 8 }, () => structuredClone(row)), failures: [{ assertion: 'browser_script_error' }] };
  validateCohort(data, 1); assert.equal(data.failures.length, 1);
  for (const mutate of [d => d.samples.pop(), d => d.samples[0].openInterviewLinks = 23, d => d.samples[0].requests[0].status = 403, d => d.samples[0].requests[0].status = null, d => d.failures.push({ assertion: 'room_count' })]) {
    const invalid = structuredClone(data); mutate(invalid); assert.throws(() => validateCohort(invalid, 1));
  }
});
test('crossover credentials cannot select a hosted service, another project or another fixture port', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outclass-crossover-guard-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.json'), profile = fixtureProfile('crossover');
  const config = { projectId: 'outclass-navigation-crossover-e2e', appUrl: 'http://127.0.0.1:3119', status: { API_URL: 'http://127.0.0.1:59321', DB_URL: 'postgresql://fixture@127.0.0.1:59322/postgres', MAILPIT_URL: 'http://127.0.0.1:59324' } };
  fs.writeFileSync(file, JSON.stringify(config)); assert.equal(profile.readConfig(file).projectId, config.projectId);
  for (const changed of [{ ...config, projectId: 'out-class' }, { ...config, appUrl: 'https://example.test:3119' }, { ...config, status: { ...config.status, DB_URL: 'postgresql://fixture@db.example.test:59322/postgres' } }, { ...config, status: { ...config.status, API_URL: 'http://127.0.0.1:58321' } }]) { fs.writeFileSync(file, JSON.stringify(changed)); assert.throws(() => profile.readConfig(file)); }
  assert.throws(() => fixtureProfile('arbitrary'), /Unknown/);
});
