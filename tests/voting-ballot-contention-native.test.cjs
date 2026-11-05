// Live-vote ballot bursts on isolated native PostgreSQL with simulated statement latency.
// Every eligible voter casts at once for the current applicant, through the real
// clubWriteTransaction (lock and statement timeouts). Locks, constraints and
// transactions are real; only request authentication is synthetic.
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
const VOTER_SCENARIOS = (process.env.OUTCLASS_BALLOT_VOTERS || '15,40,80').split(',').map(Number);
const RTT_SCENARIOS = (process.env.OUTCLASS_BALLOT_RTT_MS || '0,2').split(',').map(Number);
const caps = ['applications.review', 'applicants.identify', 'decisions.vote', 'decisions.start', 'decisions.manage', 'decisions.finish', 'decisions.publish', 'recruitment.manage'];

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

test('live voting ballot bursts under simulated latency', { skip: !databaseUrl, timeout: 900000 }, async t => {
  const url = new URL(databaseUrl);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '58455'); assert.equal(url.pathname, '/outclass_contention_test');
  const operator = new PrismaClient({ datasourceUrl: databaseUrl });
  const base = new PrismaClient({ datasourceUrl: databaseUrl.replace('fixture_superuser@', 'outclass_production_app@') });
  t.after(async () => { await base.$disconnect(); await operator.$disconnect(); });

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
    '@/utils/auth': {
      requireAuth: async () => ({ user: request.getStore() }),
      requireClubPermission: async (clubId, permissions) => {
        const user = request.getStore();
        const m = await delayed.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
        assert.ok(m && m.status === 'ACTIVE' && permissions.every(p => m.permissions.includes(p)), 'Denied');
        return { user, membership: m };
      },
    },
  };
  const files = ['actions/voting-room.ts', 'actions/voting-room-setup.ts'];
  const apiFor = overrides => { const load = loader(mocks, overrides); return Object.assign({}, ...files.map(f => load(f))); };
  const current = apiFor({});
  const baselineRef = process.env.OUTCLASS_CONTENTION_BASELINE_REF;
  const previous = baselineRef ? apiFor(Object.fromEntries(['actions/voting-room.ts', 'lib/club-transaction-authorization.ts'].map(f => [f, execFileSync('git', ['show', `${baselineRef}:${f}`], { encoding: 'utf8' })]))) : null;
  const as = (user, fn) => request.run(user, fn);
  const ok = r => assert.equal(r.ok, true, JSON.stringify(r));

  async function room(voterCount) {
    const club = await operator.club.create({ data: { name: 'Ballot contention', slug: `ballots-${randomUUID()}`, tagline: '', description: '', color: '#142d45', category: 'Other' } });
    const cycle = await operator.recruitmentCycle.create({ data: { clubId: club.id, name: 'Cycle' } });
    const round = await operator.pipelineRound.create({ data: { clubId: club.id, name: 'Interview', type: 'INTERVIEW', order: 0 } });
    const users = [];
    for (let i = 0; i < voterCount + 2; i++) users.push(await operator.user.create({ data: { email: `ballot-${randomUUID()}@demo.invalid` } }));
    const [leaderUser, applicantUser, ...voterUsers] = users;
    const leader = await operator.clubMember.create({ data: { clubId: club.id, userId: leaderUser.id, permissions: caps } });
    const voters = [];
    for (const user of voterUsers) voters.push({ user, member: await operator.clubMember.create({ data: { clubId: club.id, userId: user.id, permissions: ['applications.review', 'applicants.identify', 'decisions.vote'] } }) });
    const app = await operator.application.create({ data: { clubId: club.id, studentId: applicantUser.id, roundId: round.id, recruitmentCycleId: cycle.id, status: 'IN_REVIEW', submittedAt: new Date() } });
    const scope = { clubId: club.id, sessionId: randomUUID() };
    const created = await as(leaderUser, () => current.createLiveVotingRoom({ ...scope, cycleId: cycle.id, roundId: round.id, applicationIds: [app.id], participantIds: [leader.id, ...voters.map(v => v.member.id)], leaderMemberIds: [leader.id], targetSize: 1, presentationOptions: { fields: ['name'], highlights: {} } }));
    assert.equal(created.sessionId, scope.sessionId, JSON.stringify(created));
    const command = async action => ok(await as(leaderUser, async () => current.commandLiveVotingRoom({ ...scope, action, requestId: randomUUID(), revision: (await current.getLiveVotingRoom(scope)).revision, confirmed: true })));
    await command('START');
    for (const v of voters) await as(v.user, () => current.joinLiveVotingRoom(scope));
    await command('OPEN_VOTING');
    return { scope, app, voters };
  }

  async function burst(api, { scope, app, voters }) {
    const results = await Promise.all(voters.map(v => as(v.user, async () => {
      const start = performance.now();
      try {
        const r = await api.castLiveVotingBallot({ ...scope, applicationId: app.id, passNumber: 1, ballotRevision: null, choice: 'ACCEPT', requestId: randomUUID() });
        return { ok: r.ok === true, ms: performance.now() - start, error: r.ok ? undefined : String(r.code || r.message || r.error) };
      } catch (error) { return { ok: false, ms: performance.now() - start, error: String(error?.message || error).slice(0, 120) }; }
    })));
    const good = results.filter(r => r.ok), failed = results.filter(r => !r.ok);
    const stored = await operator.votingBallot.count({ where: { sessionId: scope.sessionId } });
    return { attempted: results.length, succeeded: good.length, failed: failed.length, stored, p50: percentile(good.map(r => r.ms), 0.5), p95: percentile(good.map(r => r.ms), 0.95), max: percentile(good.map(r => r.ms), 1), errors: [...new Set(failed.map(r => r.error))] };
  }

  const report = [];
  for (const rtt of RTT_SCENARIOS) for (const count of VOTER_SCENARIOS) {
    for (const [label, api] of [...(previous ? [[`baseline ${baselineRef}`, previous]] : []), ['current', current]]) {
      rttMs = 0; const fixture = await room(count);
      rttMs = rtt; const result = await burst(api, fixture); rttMs = 0;
      report.push({ rttMs: rtt, voters: count, version: label, ...result });
      t.diagnostic(`rtt=${rtt}ms voters=${count} ${label}: ${result.succeeded}/${result.attempted} recorded (stored ${result.stored}), p50=${result.p50}ms p95=${result.p95}ms max=${result.max}ms${result.errors.length ? ' errors=' + JSON.stringify(result.errors) : ''}`);
    }
  }
  if (process.env.OUTCLASS_BALLOT_REPORT) fs.writeFileSync(process.env.OUTCLASS_BALLOT_REPORT, JSON.stringify(report, null, 2));
  // Every accepted ballot is stored exactly once; nothing is half-recorded.
  for (const row of report) assert.equal(row.stored, row.succeeded, JSON.stringify(row));
});
