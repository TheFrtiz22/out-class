const {unwrapActions}=require('./helpers/action-result.cjs');
// Interview self-booking bursts on isolated native PostgreSQL with simulated statement latency.
// Every invited student reserves a distinct published slot at once through the real
// reserveInterview (ReadCommitted atomic(), the platform-wide panel publication advisory
// lock, club/user/application/slot row locks, live staffing coverage, panel sync, audit).
// Each club's bookable round is built through the real leader workflow: generate ->
// review -> publish panel schedule, then publish booking. Students are split evenly
// across OUTCLASS_BOOKING_CLUBS clubs and all clubs burst together, so one-club versus
// multi-club runs show what the single global lock costs. Only request auth is synthetic.
// Run: node scripts/run-contention-benchmark.cjs
// Optional: OUTCLASS_BOOKING_STUDENTS=20,60 OUTCLASS_BOOKING_CLUBS=1,3 OUTCLASS_BOOKING_RTT_MS=0,2 OUTCLASS_BOOKING_REPORT=out.json
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.OUTCLASS_CONTENTION_TEST_DATABASE_URL;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const list = (value, fallback) => (value || fallback).split(',').map(Number);
const STUDENT_SCENARIOS = list(process.env.OUTCLASS_BOOKING_STUDENTS, '20,60');
const CLUB_SCENARIOS = list(process.env.OUTCLASS_BOOKING_CLUBS, '1,3');
const RTT_SCENARIOS = list(process.env.OUTCLASS_BOOKING_RTT_MS, '0,2');
const ROOMS_PER_CLUB = 6; // parallel rooms; each needs one interviewer per 30-minute hourly session
const leaderCaps = ['interviews.manage', 'applications.review', 'applicants.identify', 'recruitment.manage'];
const interviewerCaps = ['interviews.manage', 'applications.review', 'applicants.identify'];
const weekly = { timezone: 'UTC', weeklySubmitted: true, weekly: Array.from({ length: 7 }, () => [[0, 1440]]), exceptions: {} };

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

test('interview self-booking bursts under simulated latency', { skip: !databaseUrl, timeout: 1800000 }, async t => {
  const url = new URL(databaseUrl);
  // Only the two reserved loopback fixtures: the contention benchmark's own database
  // (scripts/run-contention-benchmark.cjs) or the CI security suite's (scripts/run-disposable-postgres.cjs security).
  const reserved = { 58455: '/outclass_contention_test', 58454: '/outclass_security_test' };
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.pathname, reserved[url.port], 'reserved disposable fixture only');
  const operator = new PrismaClient({ datasourceUrl: databaseUrl });
  const base = new PrismaClient({ datasourceUrl: databaseUrl.replace('fixture_superuser@', 'outclass_production_app@') });
  t.after(async () => { await base.$disconnect(); await operator.$disconnect(); });

  // Each statement pays half the round trip before and half after it runs, while
  // any locks taken earlier in the transaction (including the advisory lock) stay held.
  let rttMs = 0, statements = 0;
  const delayed = base.$extends({ query: { async $allOperations({ args, query }) {
    statements++;
    if (rttMs) await sleep(rttMs / 2);
    const result = await query(args);
    if (rttMs) await sleep(rttMs / 2);
    return result;
  } } });
  class Client { constructor() { return delayed; } }
  const request = new AsyncLocalStorage();
  let hasPermission;
  const mocks = {
    '@prisma/client': { ...require('@prisma/client'), PrismaClient: Client },
    'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }), headers: async () => new Headers() },
    'next/cache': { revalidatePath() {}, revalidateTag() {} },
    '@/utils/auth': {
      requireAuth: async () => ({ user: request.getStore() }),
      getSessionUser: async () => request.getStore() ?? null,
      requireClubPermission: async (clubId, permissions) => {
        const user = request.getStore();
        const m = await delayed.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
        assert.ok(m && m.status === 'ACTIVE' && permissions.every(p => hasPermission(m, p)), 'Denied');
        return { user, membership: m };
      },
    },
  };
  const load = loader(mocks);
  ({ hasPermission } = load('lib/permissions.ts'));
  // Opt-in: OUTCLASS_BOOKING_PROFILE=1 attributes reservation time and statements to its helpers.
  const profile = {};
  if (process.env.OUTCLASS_BOOKING_PROFILE) for (const [file, names] of [['utils/interview-booking.ts', ['interviewBookingCoverage']], ['utils/official-panel-conflicts.ts', ['assertOfficialPanelConflicts']], ['utils/interview-scheduling-access.ts', ['syncBookingPanel']], ['utils/panel-publication.ts', ['lockSchedulingPeople']], ['utils/panel-planning.ts', ['loadPanelPlanningScene']], ['utils/interviewer-pool.ts', ['loadInterviewerPool']], ['lib/panel-proposals.ts', ['validatePanelDocument']]]) {
    const mod = load(file);
    for (const name of names) { const real = mod[name]; if (name === 'validatePanelDocument') { mod[name] = (...args) => { const t0 = performance.now(); try { return real(...args); } finally { const p = profile[name] ??= { calls: 0, ms: 0, statements: 0 }; p.calls++; p.ms += performance.now() - t0; } }; continue; } mod[name] = async (...args) => { const t0 = performance.now(), s0 = statements; try { return await real(...args); } finally { const p = profile[name] ??= { calls: 0, ms: 0, statements: 0 }; p.calls++; p.ms += performance.now() - t0; p.statements += statements - s0; } }; }
  }
  const rooms = unwrapActions(load('actions/interview-rooms.ts')), proposals = unwrapActions(load('actions/panel-proposals.ts'));
  const publication = load('actions/panel-publication.ts'), booking = load('actions/interview-booking-publication.ts');
  const as = (user, fn) => request.run(user, fn);
  const ok = r => { assert.equal(r.ok, true, r.error); return r.value; };
  const user = async label => operator.user.create({ data: { email: `${label}-${randomUUID()}@virginia.edu` } });

  // One club with a published, fully staffed, bookable interview round and `count` invited students.
  async function bookableClub(count) {
    const club = await operator.club.create({ data: { name: 'Booking contention', slug: `booking-${randomUUID()}`, tagline: '', description: '', color: '#142d45', category: 'Other' } });
    const cycle = await operator.recruitmentCycle.create({ data: { clubId: club.id, name: 'Cycle' } });
    const round = await operator.pipelineRound.create({ data: { clubId: club.id, name: 'Interview', type: 'INTERVIEW', order: 1, anonymousReview: false } });
    const ownerUser = await user('owner');
    await operator.clubMember.create({ data: { clubId: club.id, userId: ownerUser.id, isOwner: true, permissions: leaderCaps, interviewOffices: ['PRESIDENT'] } });
    const roomCount = Math.min(ROOMS_PER_CLUB, count), perRoom = Math.ceil(count / roomCount);
    // Interviewers mirror tests/helpers/panel-publication-fixture.cjs: INTERVIEWER access,
    // interview permissions and confirmed all-day availability for this round.
    for (let i = 0; i < roomCount + 2; i++) {
      const member = await operator.clubMember.create({ data: { clubId: club.id, userId: (await user('interviewer')).id, accessRole: 'INTERVIEWER', permissions: interviewerCaps } });
      await operator.interviewRoundParticipation.create({ data: { clubId: club.id, memberId: member.id, roundId: round.id, availability: weekly, confirmedAt: new Date() } });
    }
    // Hourly 30-minute sessions on one future day leave every interviewer a break.
    const day = Date.UTC(2030, 9, 12, 8);
    const slotIds = [];
    for (let r = 0; r < roomCount; r++) {
      const room = await operator.interviewRoom.create({ data: { clubId: club.id, roundId: round.id, name: `Room ${r}`, location: `Room ${r}`, kind: 'IN_PERSON', timezone: 'UTC', duration: 30, interviewersNeeded: 1 } });
      for (let s = 0; s < perRoom; s++) {
        const slot = await operator.interviewSlot.create({ data: { clubId: club.id, roomId: room.id, startTime: new Date(day + s * 3600000), endTime: new Date(day + s * 3600000 + 1800000), location: room.location } });
        slotIds.push(slot.id);
      }
    }
    const students = [];
    for (let i = 0; i < count; i++) {
      const student = await user('student');
      const app = await operator.application.create({ data: { clubId: club.id, studentId: student.id, roundId: round.id, recruitmentCycleId: cycle.id, status: 'INTERVIEWING', submittedAt: new Date() } });
      students.push({ user: student, app });
    }
    const scope = { clubId: club.id, roundId: round.id };
    await as(ownerUser, async () => {
      const window = { start: new Date(day - 3600000).toISOString(), end: new Date(day + (perRoom + 1) * 3600000).toISOString() };
      const draft = (await proposals.generatePanelProposal({ ...scope, revision: 0, window, options: { maxConsecutiveMinutes: null, breakMinutes: 15 }, mode: 'REGENERATE' })).proposal;
      assert.equal(draft.validation.filled, slotIds.length, JSON.stringify(draft.validation.issues?.slice(0, 3)));
      const current = (await proposals.getPanelProposalWorkspace(scope)).proposal;
      const reviewed = ok(await publication.reviewPanelPublication({ ...scope, proposalId: current.id, revision: current.revision }));
      assert.equal(reviewed.unfilled, 0);
      ok(await publication.publishPanelSchedule({ ...scope, proposalId: reviewed.proposalId, revision: reviewed.revision, approvalToken: reviewed.approvalToken }));
      await booking.setInterviewBookingPublication({ ...scope, revision: 0, action: 'PUBLISH', cycleId: cycle.id, allowCancellation: true, allowRescheduling: true });
    });
    // What a student sees: every slot is offered as bookable.
    const visible = await as(students[0].user, () => rooms.getApplicantSchedule(students[0].app.id));
    assert.equal(visible.publicationState, 'PUBLISHED');
    const offered = visible.rooms.flatMap(r => r.slots.map(s => s.id));
    assert.equal(offered.length, slotIds.length, 'every staffed slot must be bookable');
    return { club, students: students.map((s, i) => ({ ...s, slotId: offered[i] })) };
  }

  async function burst(clubs) {
    const everyone = clubs.flatMap(c => c.students);
    statements = 0;
    const results = await Promise.all(everyone.map(s => as(s.user, async () => {
      const start = performance.now();
      try {
        await rooms.reserveInterview({ applicationId: s.app.id, slotId: s.slotId });
        return { ok: true, ms: performance.now() - start };
      } catch (error) { return { ok: false, ms: performance.now() - start, error: String(error?.code ? `${error.code} ` : '') + String(error?.message || error).replace(/\s+/g, ' ').slice(0, 160) }; }
    })));
    const statementsPerCall = Math.round(statements / results.length);
    const good = results.filter(r => r.ok), failed = results.filter(r => !r.ok);
    const clubIds = clubs.map(c => c.club.id);
    const stored = await operator.interviewBooking.count({ where: { slot: { clubId: { in: clubIds } } } });
    const overCapacity = await operator.$queryRaw`SELECT s.id FROM "InterviewSlot" s JOIN "InterviewBooking" b ON b."slotId"=s.id WHERE s."clubId"=ANY(${clubIds}::text[]) GROUP BY s.id, s.capacity HAVING count(*) > s.capacity`;
    return { attempted: results.length, succeeded: good.length, failed: failed.length, stored, overCapacity: overCapacity.length, statementsPerCall,
      p50: percentile(good.map(r => r.ms), 0.5), p95: percentile(good.map(r => r.ms), 0.95), max: percentile(good.map(r => r.ms), 1),
      failedMaxMs: percentile(failed.map(r => r.ms), 1), errors: [...new Set(failed.map(r => r.error))] };
  }

  const report = [];
  for (const rtt of RTT_SCENARIOS) for (const students of STUDENT_SCENARIOS) for (const clubCount of CLUB_SCENARIOS) {
    rttMs = 0;
    const setupStart = performance.now(), clubs = [];
    for (let c = 0; c < clubCount; c++) clubs.push(await bookableClub(Math.floor(students / clubCount) + (c < students % clubCount ? 1 : 0)));
    const setupMs = Math.round(performance.now() - setupStart);
    for (const k of Object.keys(profile)) delete profile[k];
    rttMs = rtt; const result = await burst(clubs); rttMs = 0;
    if (process.env.OUTCLASS_BOOKING_PROFILE) t.diagnostic(`profile rtt=${rtt}ms students=${students} clubs=${clubCount}: ` + Object.entries(profile).map(([k, p]) => `${k} ${Math.round(p.ms / p.calls)}ms/${Math.round(p.statements / p.calls)} stmts per call`).join('; '));
    report.push({ rttMs: rtt, students, clubs: clubCount, setupMs, ...result });
    t.diagnostic(`rtt=${rtt}ms students=${students} clubs=${clubCount}: ${result.succeeded}/${result.attempted} booked (stored ${result.stored}, over-capacity slots ${result.overCapacity}, ~${result.statementsPerCall} statements/call), p50=${result.p50}ms p95=${result.p95}ms max=${result.max}ms${result.errors.length ? ` failedMax=${result.failedMaxMs}ms errors=` + JSON.stringify(result.errors) : ''}`);
  }
  if (process.env.OUTCLASS_BOOKING_REPORT) fs.writeFileSync(process.env.OUTCLASS_BOOKING_REPORT, JSON.stringify(report, null, 2));
  // Every confirmed reservation is stored exactly once and no session exceeds capacity.
  for (const row of report) { assert.equal(row.stored, row.succeeded, JSON.stringify(row)); assert.equal(row.overCapacity, 0, JSON.stringify(row)); }

  // Correctness under real concurrency, with latency so the transactions overlap.
  const attempt = (student, slotId) => as(student.user, async () => {
    try { await rooms.reserveInterview({ applicationId: student.app.id, slotId }); return { ok: true }; }
    catch (error) { return { ok: false, error: String(error?.message || error), refused: error?.refused === true, code: error?.code }; }
  });

  await t.test('two students racing for the last seat of one session: exactly one is booked', async () => {
    rttMs = 0; const club = await bookableClub(2); const slotId = club.students[0].slotId;
    const capacity = (await operator.interviewSlot.findUnique({ where: { id: slotId } })).capacity;
    assert.equal(capacity, 1, 'fixture sessions hold one applicant');
    rttMs = 2; const results = await Promise.all(club.students.map(s => attempt(s, slotId))); rttMs = 0;
    assert.equal(results.filter(r => r.ok).length, 1, JSON.stringify(results));
    assert.match(results.find(r => !r.ok).error, /just booked|no longer available|fully staffed|changed while saving/i);
    assert.equal(results.find(r => !r.ok).refused, true, 'the losing booking is a returned { ok: false } refusal');
    assert.equal(await operator.interviewBooking.count({ where: { slotId } }), 1);
  });

  await t.test('one student booking overlapping interviews in two clubs at once: exactly one is booked', async () => {
    rttMs = 0; const [a, b] = [await bookableClub(1), await bookableClub(1)];
    const student = a.students[0];
    // The same student is also invited by club B; both clubs' first sessions start at the same time.
    const bRound = await operator.application.findUnique({ where: { id: b.students[0].app.id }, select: { roundId: true, recruitmentCycleId: true, clubId: true } });
    const second = { user: student.user, app: await operator.application.create({ data: { clubId: bRound.clubId, studentId: student.user.id, roundId: bRound.roundId, recruitmentCycleId: bRound.recruitmentCycleId, status: 'INTERVIEWING', submittedAt: new Date() } }) };
    const [slotA, slotB] = await Promise.all([a.students[0].slotId, b.students[0].slotId].map(id => operator.interviewSlot.findUnique({ where: { id } })));
    assert.equal(+slotA.startTime, +slotB.startTime, 'fixture sessions overlap');
    rttMs = 2; const results = await Promise.all([attempt(student, slotA.id), attempt(second, slotB.id)]); rttMs = 0;
    assert.equal(results.filter(r => r.ok).length, 1, JSON.stringify(results));
    assert.match(results.find(r => !r.ok).error, /already have an interview at that time|changed while saving/i);
    assert.equal(results.find(r => !r.ok).refused, true, 'the losing booking is a returned { ok: false } refusal');
    assert.equal(await operator.interviewBooking.count({ where: { application: { studentId: student.user.id } } }), 1);
  });
});
