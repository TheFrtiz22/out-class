// Club-write contention on isolated native PostgreSQL with simulated network latency.
// Production functions (iad1) and the database (us-west-2) are ~70 ms apart, so every
// statement inside a transaction extends how long its locks are held. A Prisma
// extension delays each statement by the configured round trip; locks, timeouts,
// unique constraints and transactions are real. Only request authentication is synthetic.
// Run: node scripts/run-contention-benchmark.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.OUTCLASS_CONTENTION_TEST_DATABASE_URL;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const CONCURRENT_STUDENTS = Number(process.env.OUTCLASS_CONTENTION_STUDENTS || 20);
const RTT_SCENARIOS = (process.env.OUTCLASS_CONTENTION_RTT_MS || '0,70').split(',').map(Number);

function loader(mocks, overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const text = overrides[path.relative(process.cwd(), file)] ?? fs.readFileSync(file, 'utf8');
    const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name), mod, mod.exports);
    return mod.exports;
  }
  return load;
}

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]);
};

test('club-wide write contention under simulated cross-region latency', { skip: !databaseUrl, timeout: 600000 }, async t => {
  const url = new URL(databaseUrl);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '58455'); assert.equal(url.pathname, '/outclass_contention_test');
  const operator = new PrismaClient({ datasourceUrl: databaseUrl });
  const appUrl = databaseUrl.replace('fixture_superuser@', 'outclass_production_app@');
  const base = new PrismaClient({ datasourceUrl: appUrl });
  t.after(async () => { await base.$disconnect(); await operator.$disconnect(); });

  // Each statement pays half the round trip before and half after it runs, while
  // any locks taken earlier in the transaction remain held.
  let rttMs = 0;
  const delayed = base.$extends({ query: { async $allOperations({ args, query }) {
    if (rttMs) await sleep(rttMs / 2);
    const result = await query(args);
    if (rttMs) await sleep(rttMs / 2);
    return result;
  } } });
  class Client { constructor() { return delayed; } }
  const request = new AsyncLocalStorage();
  const mocks = {
    '@prisma/client': { ...require('@prisma/client'), PrismaClient: Client },
    'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }) },
    'next/cache': { revalidatePath() {}, revalidateTag() {} },
    '@/utils/auth': { requireAuth: async () => ({ user: request.getStore() }) },
  };
  const current = loader(mocks)('actions/applications.ts');
  const previous = loader(mocks, { 'actions/applications.ts': execFileSync('git', ['show', 'origin/main:actions/applications.ts'], { encoding: 'utf8' }) })('actions/applications.ts');

  const club = await operator.club.create({ data: { slug: `contention-${randomUUID()}`, name: 'Contention Club', tagline: '', description: '', color: '#142d4e', category: 'Academic', applicationOpen: true } });
  await operator.pipelineRound.create({ data: { clubId: club.id, name: 'Applied', order: 0 } });
  const question = await operator.applicationQuestion.create({ data: { clubId: club.id, prompt: 'Why this club?', type: 'ESSAY', required: true, order: 0 } });

  async function students(count) {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await operator.user.create({ data: { email: `${randomUUID()}@virginia.edu` } });
      await operator.studentProfile.create({ data: { userId: user.id, firstName: 'Synthetic', lastName: `Student ${i}`, computingId: randomUUID(), major: 'Economics', gradYear: 2028 } });
      users.push(user);
    }
    return users;
  }
  const draft = (text) => ({ clubId: club.id, answers: [{ questionId: question.id, response: text }] });

  async function burst(api, users) {
    const results = await Promise.all(users.map(user => request.run(user, async () => {
      const start = performance.now();
      try { await api.saveApplicationDraft(draft(`Draft from ${user.id}`)); return { ok: true, ms: performance.now() - start }; }
      catch (error) { return { ok: false, ms: performance.now() - start, error: String(error?.message || error).slice(0, 120) }; }
    })));
    const ok = results.filter(r => r.ok), failed = results.filter(r => !r.ok);
    return {
      attempted: results.length, succeeded: ok.length, failed: failed.length,
      p50: percentile(ok.map(r => r.ms), 0.5), p95: percentile(ok.map(r => r.ms), 0.95), max: percentile(ok.map(r => r.ms), 1),
      errors: [...new Set(failed.map(r => r.error))],
    };
  }

  const report = [];
  for (const rtt of RTT_SCENARIOS) {
    rttMs = rtt;
    for (const [label, api] of [['main (club FOR UPDATE)', previous], ['branch (club FOR SHARE + student lock)', current]]) {
      const result = await burst(api, await students(CONCURRENT_STUDENTS));
      report.push({ rttMs: rtt, version: label, ...result });
      t.diagnostic(`rtt=${rtt}ms ${label}: ${result.succeeded}/${result.attempted} saved, p50=${result.p50}ms p95=${result.p95}ms max=${result.max}ms${result.errors.length ? ' errors=' + JSON.stringify(result.errors) : ''}`);
    }
  }
  if (process.env.OUTCLASS_CONTENTION_REPORT) fs.writeFileSync(process.env.OUTCLASS_CONTENTION_REPORT, JSON.stringify({ students: CONCURRENT_STUDENTS, report }, null, 2));

  // The branch must save every concurrent student's draft at every simulated latency.
  for (const row of report.filter(r => r.version.startsWith('branch'))) assert.equal(row.succeeded, row.attempted, `rtt=${row.rttMs}ms: ${JSON.stringify(row.errors)}`);

  await t.test('one student\'s concurrent first saves stay ordered without a unique-constraint error', async () => {
    rttMs = RTT_SCENARIOS[RTT_SCENARIOS.length - 1];
    const [user] = await students(1);
    const results = await Promise.allSettled([1, 2, 3].map(n => request.run(user, () => current.saveApplicationDraft(draft(`tab ${n}`)))));
    assert.deepEqual(results.map(r => r.status), ['fulfilled', 'fulfilled', 'fulfilled'], JSON.stringify(results.map(r => r.reason?.message)));
    const apps = await operator.application.findMany({ where: { studentId: user.id, clubId: club.id }, include: { answers: true } });
    assert.equal(apps.length, 1); assert.equal(apps[0].status, 'DRAFTING'); assert.equal(apps[0].answers.length, 1);
  });

  await t.test('suspension still blocks drafts and leader configuration still serializes with student saves', async () => {
    rttMs = 0;
    const [user] = await students(1);
    // A leader holding the club row exclusively (e.g. closing applications) blocks the save until commit.
    let saved = false;
    const leader = operator.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${club.id} FOR UPDATE`;
      await sleep(400);
      assert.equal(saved, false, 'student save must wait for the leader transaction');
      await tx.club.update({ where: { id: club.id }, data: { applicationOpen: true } });
    });
    await sleep(50);
    await request.run(user, () => current.saveApplicationDraft(draft('waits for leader')));
    saved = true;
    await leader;
    await operator.club.update({ where: { id: club.id }, data: { suspendedAt: new Date() } });
    try {
      await assert.rejects(request.run(user, () => current.saveApplicationDraft(draft('after suspension'))), /suspended/i);
    } finally {
      await operator.club.update({ where: { id: club.id }, data: { suspendedAt: null } });
    }
  });
});
