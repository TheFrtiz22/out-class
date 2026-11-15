const {unwrapActions,refused}=require('./helpers/action-result.cjs');
// Mock recruiting cycle, end to end, on the disposable native PostgreSQL of the
// security runner (scripts/run-disposable-postgres.cjs security). 50 synthetic
// applicants (fake names, @example.test addresses) go through one club's full cycle:
// apply -> anonymous round-1 review -> advance or reject -> interview booking ->
// live voting on the finalists -> finalization and decision release -> offers
// accepted -> roster CSV export. Every stage drives the real server actions, route
// handler and Prisma transactions through utils/prisma.ts as the non-superuser
// runtime role; only request authentication is synthetic (same stubbing as the
// other native suites). Each stage's wall time is logged as a smoke baseline.
// Never inherits DATABASE_URL or connects to a hosted project; skips without the gate.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');

const databaseUrl = process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;
const APPLICANTS = 50, FINALISTS = 12, ADMITTED = 8, REVIEWERS = 3, VOTERS = 3;
const ROOMS = 6; // interview rooms; FINALISTS / ROOMS hourly 30-minute sessions per room
const leaderCaps = ['recruitment.manage', 'applications.review', 'applicants.identify', 'interviews.manage', 'members.manage',
  'decisions.vote', 'decisions.start', 'decisions.manage', 'decisions.finish', 'decisions.publish'];
const interviewerCaps = ['interviews.manage', 'applications.review', 'applicants.identify'];
const voterCaps = ['applications.review', 'applicants.identify', 'decisions.vote'];
const weekly = { timezone: 'UTC', weeklySubmitted: true, weekly: Array.from({ length: 7 }, () => [[0, 1440]]), exceptions: {} };

// Same module loader as the other native suites (tests/interview-booking-contention-native.test.cjs).
function loader(mocks) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name), mod, mod.exports);
    return mod.exports;
  }
  return load;
}
async function pool(items, size, fn) {
  const results = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); }
  }));
  return results;
}
// Deterministic round-1 scores: three reviewers around a base that falls by 0.5 every
// three applicants, so the top FINALISTS have a clear cutoff (8.5 versus 8.0).
const base = i => 10 - 0.5 * Math.floor(i / 3);
const scores = i => [base(i), Math.max(1, base(i) - 0.5), Math.min(10, base(i) + 0.5)];
const mean = values => values.reduce((a, b) => a + b, 0) / values.length;

test('mock recruiting cycle: 50 synthetic applicants from application to roster on disposable PostgreSQL', { skip: !databaseUrl, timeout: 600000 }, async t => {
  const url = new URL(databaseUrl);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.pathname, '/outclass_security_test', 'Requires the disposable security fixture database');
  const { PrismaClient } = require('@prisma/client');
  const operator = new PrismaClient({ datasourceUrl: databaseUrl, log: [] });
  const runtime = new URL(databaseUrl); runtime.username = 'outclass_production_app';
  const db = new PrismaClient({ datasourceUrl: runtime.toString(), log: [] });
  t.after(async () => { await db.$disconnect(); await operator.$disconnect(); });
  const [identity] = await db.$queryRaw`SELECT current_user AS role, current_database() AS name, inet_server_addr()='127.0.0.1'::inet AS loopback`;
  assert.deepEqual(identity, { role: 'outclass_production_app', name: 'outclass_security_test', loopback: true });

  class Client { constructor() { return db; } }
  const request = new AsyncLocalStorage();
  let hasPermission;
  const mocks = {
    '@prisma/client': { ...require('@prisma/client'), PrismaClient: Client },
    'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }), headers: async () => new Headers() },
    'next/cache': { revalidatePath() {}, revalidateTag() {}, unstable_cache: fn => fn },
    'next/server': { after() {} },
    'server-only': {},
    '@/utils/auth': {
      requireAuth: async () => { const user = request.getStore(); if (!user) throw Error('Unauthenticated'); return { user }; },
      getSessionUser: async () => request.getStore() ?? null,
      requireClubPermission: async (clubId, permissions = []) => {
        const actor = request.getStore(); if (!actor) throw Error('Unauthenticated');
        const user = await db.user.findUnique({ where: { id: actor.id } });
        const membership = await db.clubMember.findUnique({ where: { userId_clubId: { userId: actor.id, clubId } } });
        if (!user || user.disabledAt || !membership || membership.status !== 'ACTIVE' || !permissions.every(p => hasPermission(membership, p))) throw Error('Denied');
        return { user, membership };
      },
    },
  };
  // utils/prisma.ts caches its base client on globalThis outside production; keep it scoped to this suite.
  const previousBase = global.outclassPrismaBase; delete global.outclassPrismaBase;
  t.after(() => { if (previousBase === undefined) delete global.outclassPrismaBase; else global.outclassPrismaBase = previousBase; });
  const load = loader(mocks);
  ({ hasPermission } = load('lib/permissions.ts'));
  const applications = unwrapActions(load('actions/applications.ts')), evaluations = load('actions/evaluations.ts'), crm = unwrapActions(load('actions/crm.ts'));
  const display = load('actions/applicant-intelligence.ts'), rooms = unwrapActions(load('actions/interview-rooms.ts'));
  const proposals = unwrapActions(load('actions/panel-proposals.ts')), publication = load('actions/panel-publication.ts'), booking = load('actions/interview-booking-publication.ts');
  const voting = { ...load('actions/voting-room.ts'), ...load('actions/voting-room-setup.ts'), ...load('actions/voting-room-finalization.ts') };
  const offers = unwrapActions(load('actions/recruitment-offers.ts')), exportsRoute = load('app/api/club-exports/route.ts');
  const as = (user, fn) => request.run(user, fn);
  const okValue = r => { assert.equal(r.ok, true, r.error); return r.value; };
  const okRoom = r => { assert.equal(r.ok, true, JSON.stringify(r)); return r.result; };

  const tag = randomUUID().slice(0, 8);
  const person = async label => operator.user.create({ data: { email: `mock-${label}-${tag}@example.test` } });
  const timings = {};
  let broken = false;
  const stage = (name, fn) => t.test(name, { skip: broken && 'an earlier stage failed' }, async st => {
    const started = performance.now();
    try { await fn(st); } catch (error) { broken = true; throw error; }
    timings[name] = Math.round(performance.now() - started);
    st.diagnostic(`${name}: ${timings[name]} ms`);
  });

  // Club, cycle, two rounds (anonymous application review, identified interview) and staff.
  const club = await operator.club.create({ data: { name: 'Mock Recruiting Cycle Club', slug: `mock-cycle-${randomUUID()}`, tagline: '', description: '', color: '#142d45', category: 'Other', applicationOpen: true, features: { csvExport: true } } });
  const cycle = await operator.recruitmentCycle.create({ data: { clubId: club.id, name: 'Mock cycle' } });
  const reviewRound = await operator.pipelineRound.create({ data: { clubId: club.id, name: 'Application review', type: 'APPLICATION_REVIEW', order: 0, anonymousReview: true } });
  const interviewRound = await operator.pipelineRound.create({ data: { clubId: club.id, name: 'Interview', type: 'INTERVIEW', order: 1, anonymousReview: false } });
  const question = await operator.applicationQuestion.create({ data: { clubId: club.id, prompt: 'Why this club?', type: 'ESSAY', required: true, order: 0 } });
  const leader = await person('leader');
  const leaderMember = await operator.clubMember.create({ data: { clubId: club.id, userId: leader.id, isOwner: true, accessRole: 'OWNER', permissions: leaderCaps, interviewOffices: ['PRESIDENT'] } });
  const reviewers = [];
  for (let r = 0; r < REVIEWERS; r++) {
    const user = await person(`reviewer-${r}`);
    reviewers.push({ user, member: await operator.clubMember.create({ data: { clubId: club.id, userId: user.id, permissions: ['applications.review'] } }) });
  }
  // Applicants: clearly fake names and addresses.
  const applicants = [];
  for (let i = 0; i < APPLICANTS; i++) {
    const n = String(i).padStart(2, '0');
    const user = await person(`applicant-${n}`);
    await operator.studentProfile.create({ data: { userId: user.id, firstName: 'Testfirst', lastName: `Fakeperson${n}`, computingId: `mock${tag}${n}`, major: 'Undeclared', gradYear: 2029, phone: '+14345550123' } });
    applicants.push({ index: i, user, applicationId: null });
  }
  const applicantText = /Testfirst|Fakeperson|mock-applicant-/;
  const byApplication = id => applicants.find(a => a.applicationId === id);

  await stage('1. 50 applicants submit through submitApplication', async st => {
    await pool(applicants, 5, async a => {
      const result = await as(a.user, () => applications.submitApplication({ clubId: club.id, answers: [{ questionId: question.id, response: 'Synthetic answer for a mock recruiting cycle.' }] }));
      assert.equal(result.success, true); a.applicationId = result.applicationId;
    });
    const rows = await operator.application.findMany({ where: { clubId: club.id } });
    assert.equal(rows.length, APPLICANTS);
    assert.ok(rows.every(r => r.status === 'SUBMITTED' && r.roundId === reviewRound.id && r.recruitmentCycleId === cycle.id && r.submittedAt));
    assert.equal(new Set(rows.map(r => r.studentId)).size, APPLICANTS);
    assert.equal(await operator.applicationAnswer.count({ where: { application: { clubId: club.id } } }), APPLICANTS);
    st.diagnostic(`submitted ${rows.length}`);
  });

  await stage('2. anonymous round-1 review: reviewers score every applicant and never see identities', async st => {
    await Promise.all(reviewers.map((reviewer, r) => pool(applicants, 1, a => as(reviewer.user, async () => {
      const result = await evaluations.submitEvaluation({ clubId: club.id, applicationId: a.applicationId, roundId: reviewRound.id, roundName: reviewRound.name, score: scores(a.index)[r] });
      assert.equal(result.success, true);
    }))));
    const stored = await operator.evaluation.findMany({ where: { application: { clubId: club.id } } });
    assert.equal(stored.length, APPLICANTS * REVIEWERS);
    assert.ok(stored.every(e => e.roundId === reviewRound.id && e.submittedAt));
    assert.equal(new Set(stored.map(e => `${e.applicationId}:${e.interviewerId}`)).size, stored.length, 'one evaluation per reviewer and applicant');
    for (const a of applicants) {
      const own = stored.filter(e => e.applicationId === a.applicationId).map(e => e.score).sort((x, y) => x - y);
      assert.deepEqual(own, [...scores(a.index)].sort((x, y) => x - y));
    }
    // What the code enforces for a reviewer without applicants.identify in an anonymous round.
    const reviewer = reviewers[0].user, applicantIds = applicants.map(a => a.user.id);
    const ranked = await as(reviewer, () => crm.getRankedReviewRound(club.id, reviewRound.id));
    assert.equal(ranked.applications.length, APPLICANTS);
    const rankedJson = JSON.stringify(ranked);
    assert.doesNotMatch(rankedJson, applicantText); assert.ok(applicantIds.every(id => !rankedJson.includes(id)));
    assert.ok(ranked.applications.every(row => row.roundScore === null && row.student.email === ''), 'reviewers see neither identities nor the panel average');
    const pipelineJson = JSON.stringify(await as(reviewer, () => crm.getClubPipeline(club.id)));
    assert.doesNotMatch(pipelineJson, applicantText); assert.ok(applicantIds.every(id => !pipelineJson.includes(id)));
    for (const a of applicants.slice(0, 5)) {
      const shown = await as(reviewer, () => display.getApplicantDisplay({ clubId: club.id, applicationId: a.applicationId }));
      assert.equal(shown.anonymous, true); assert.doesNotMatch(JSON.stringify(shown), applicantText);
    }
    st.diagnostic(`evaluations ${stored.length}`);
  });

  let finalists = [], cut = [];
  await stage('3. leader ranks the anonymous round, advances the top 12 to interviews and rejects the rest', async st => {
    const ranked = await as(leader, () => crm.getRankedReviewRound(club.id, reviewRound.id));
    assert.equal(ranked.applications.length, APPLICANTS);
    assert.doesNotMatch(JSON.stringify(ranked), applicantText, 'the anonymous round stays anonymous for the leader too');
    for (const row of ranked.applications) {
      assert.equal(row.roundScore?.submitted, REVIEWERS);
      assert.ok(Math.abs(row.roundScore.average - mean(scores(byApplication(row.id).index))) < 0.05, 'panel average matches submitted scores');
    }
    const order = [...ranked.applications].sort((a, b) => b.roundScore.average - a.roundScore.average);
    finalists = order.slice(0, FINALISTS).map(row => byApplication(row.id));
    cut = order.slice(FINALISTS).map(row => byApplication(row.id));
    assert.deepEqual(finalists.map(a => a.index).sort((a, b) => a - b), Array.from({ length: FINALISTS }, (_, i) => i));
    await as(leader, async () => {
      for (const a of finalists) {
        await crm.moveApplicantRound({ clubId: club.id, applicationId: a.applicationId, newRoundId: interviewRound.id, expectedRoundId: reviewRound.id });
        await crm.setApplicationStatus({ clubId: club.id, applicationId: a.applicationId, status: 'INTERVIEWING', expectedStatus: 'SUBMITTED' });
      }
      for (const a of cut) await crm.setApplicationStatus({ clubId: club.id, applicationId: a.applicationId, status: 'REJECTED', expectedStatus: 'SUBMITTED' });
    });
    const rows = await operator.application.findMany({ where: { clubId: club.id } });
    const advanced = rows.filter(r => r.status === 'INTERVIEWING'), rejected = rows.filter(r => r.status === 'REJECTED');
    assert.equal(advanced.length, FINALISTS); assert.equal(rejected.length, APPLICANTS - FINALISTS);
    assert.ok(advanced.every(r => r.roundId === interviewRound.id && r.decisionVersion === 0));
    assert.ok(rejected.every(r => r.roundId === reviewRound.id && r.decisionVersion === 1));
    // Immediate decisions for the cut: one letter, one notification and one queued email each; no offers.
    const cutIds = cut.map(a => a.applicationId);
    assert.equal(await operator.decisionLetter.count({ where: { applicationId: { in: cutIds }, decision: 'REJECTED' } }), cut.length);
    assert.equal(await operator.userNotification.count({ where: { clubId: club.id, type: 'DECISION' } }), cut.length);
    assert.equal(await operator.notificationEmailOutbox.count({ where: { notification: { clubId: club.id, type: 'DECISION' } } }), cut.length);
    assert.equal(await operator.clubInvitation.count({ where: { clubId: club.id } }), 0);
    // Identified finalists are now outside the reviewer's anonymous-only view.
    const reviewer = reviewers[0].user;
    assert.equal((await as(reviewer, () => crm.getRankedReviewRound(club.id, interviewRound.id))).applications.length, 0);
    await assert.rejects(as(reviewer, () => display.getApplicantDisplay({ clubId: club.id, applicationId: finalists[0].applicationId })), /unavailable/i);
    const identified = await as(leader, () => crm.getRankedReviewRound(club.id, interviewRound.id));
    assert.equal(identified.applications.length, FINALISTS); assert.match(JSON.stringify(identified), /Fakeperson/);
    st.diagnostic(`advanced ${advanced.length}, rejected ${rejected.length}`);
  });

  await stage('4. interview panel published and every finalist books a distinct slot', async st => {
    // Rooms, slots and confirmed interviewer availability mirror the booking contention fixture.
    const perRoom = Math.ceil(FINALISTS / ROOMS), day = Date.UTC(2030, 9, 12, 8), slotIds = [];
    for (let i = 0; i < ROOMS + 2; i++) {
      const member = await operator.clubMember.create({ data: { clubId: club.id, userId: (await person(`interviewer-${i}`)).id, accessRole: 'INTERVIEWER', permissions: interviewerCaps } });
      await operator.interviewRoundParticipation.create({ data: { clubId: club.id, memberId: member.id, roundId: interviewRound.id, availability: weekly, confirmedAt: new Date() } });
    }
    for (let r = 0; r < ROOMS; r++) {
      const room = await operator.interviewRoom.create({ data: { clubId: club.id, roundId: interviewRound.id, name: `Room ${r}`, location: `Room ${r}`, kind: 'IN_PERSON', timezone: 'UTC', duration: 30, interviewersNeeded: 1 } });
      for (let s = 0; s < perRoom; s++)
        slotIds.push((await operator.interviewSlot.create({ data: { clubId: club.id, roomId: room.id, startTime: new Date(day + s * 3600000), endTime: new Date(day + s * 3600000 + 1800000), location: room.location } })).id);
    }
    const scope = { clubId: club.id, roundId: interviewRound.id };
    await as(leader, async () => {
      const window = { start: new Date(day - 3600000).toISOString(), end: new Date(day + (perRoom + 1) * 3600000).toISOString() };
      const draft = (await proposals.generatePanelProposal({ ...scope, revision: 0, window, options: { maxConsecutiveMinutes: null, breakMinutes: 15 }, mode: 'REGENERATE' })).proposal;
      assert.equal(draft.validation.filled, slotIds.length, JSON.stringify(draft.validation.issues?.slice(0, 3)));
      const current = (await proposals.getPanelProposalWorkspace(scope)).proposal;
      const reviewed = okValue(await publication.reviewPanelPublication({ ...scope, proposalId: current.id, revision: current.revision }));
      assert.equal(reviewed.unfilled, 0);
      okValue(await publication.publishPanelSchedule({ ...scope, proposalId: reviewed.proposalId, revision: reviewed.revision, approvalToken: reviewed.approvalToken }));
      await booking.setInterviewBookingPublication({ ...scope, revision: 0, action: 'PUBLISH', cycleId: cycle.id, allowCancellation: true, allowRescheduling: true });
    });
    const visible = await as(finalists[0].user, () => rooms.getApplicantSchedule(finalists[0].applicationId));
    assert.equal(visible.publicationState, 'PUBLISHED');
    const offered = visible.rooms.flatMap(r => r.slots.map(s => s.id));
    assert.equal(offered.length, slotIds.length);
    // Rejected applicants hold no interview invitation.
    await refused(as(cut[0].user, () => rooms.reserveInterview({ applicationId: cut[0].applicationId, slotId: offered[0] })), /invitation is required/);
    await Promise.all(finalists.map((a, i) => as(a.user, () => rooms.reserveInterview({ applicationId: a.applicationId, slotId: offered[i] }))));
    const bookings = await operator.interviewBooking.findMany({ where: { application: { clubId: club.id } } });
    assert.equal(bookings.length, FINALISTS);
    assert.deepEqual(new Set(bookings.map(b => b.applicationId)), new Set(finalists.map(a => a.applicationId)));
    assert.equal(new Set(bookings.map(b => b.slotId)).size, FINALISTS, 'one finalist per session');
    assert.ok(bookings.every(b => b.roundId === interviewRound.id));
    st.diagnostic(`booked ${bookings.length} of ${slotIds.length} sessions`);
  });

  const admitted = () => finalists.slice(0, ADMITTED), declined = () => finalists.slice(ADMITTED);
  let sessionId;
  await stage('5. live voting room runs on the finalists and finalizes admission decisions', async st => {
    const voters = [];
    for (let v = 0; v < VOTERS; v++) {
      const user = await person(`voter-${v}`);
      voters.push({ user, member: await operator.clubMember.create({ data: { clubId: club.id, userId: user.id, permissions: voterCaps } }) });
    }
    sessionId = randomUUID();
    const scope = { clubId: club.id, sessionId };
    await as(leader, () => voting.createLiveVotingRoom({ ...scope, cycleId: cycle.id, roundId: interviewRound.id, applicationIds: finalists.map(a => a.applicationId), participantIds: voters.map(v => v.member.id), leaderMemberIds: [leaderMember.id], targetSize: ADMITTED }));
    const read = () => as(leader, () => voting.getLiveVotingRoom(scope));
    const command = async (action, extra = {}) => okRoom(await as(leader, async () => voting.commandLiveVotingRoom({ ...scope, action, requestId: randomUUID(), revision: (await voting.getLiveVotingRoom(scope)).revision, confirmed: true, ...extra })));
    const vote = (user, choice) => as(user, async () => {
      const s = await voting.getLiveVotingRoom(scope);
      const entry = s.history.find(p => p.number === s.passNumber).candidates.find(c => c.applicationId === s.currentApplicantId);
      return okRoom(await voting.castLiveVotingBallot({ ...scope, applicationId: s.currentApplicantId, passNumber: s.passNumber, ballotRevision: entry.ownBallot?.revision ?? null, choice, requestId: randomUUID() }));
    });
    await command('START');
    for (const v of voters) await as(v.user, () => voting.joinLiveVotingRoom(scope));
    const accept = new Set(admitted().map(a => a.applicationId));
    for (let i = 0; i < FINALISTS; i++) {
      const current = (await read()).currentApplicantId;
      assert.ok(finalists.some(a => a.applicationId === current), 'room presents a finalist');
      const choice = accept.has(current) ? 'ACCEPT' : 'REJECT';
      await command('OPEN_VOTING');
      for (const v of voters) await vote(v.user, choice);
      await command('CLOSE_VOTING');
      await command('CONFIRM', { choice, reason: 'Mock cycle panel outcome' });
      await command('ADVANCE');
    }
    await command('END');
    const ended = await read();
    assert.equal(ended.status, 'COMPLETED'); assert.equal(ended.accepted, ADMITTED);
    assert.equal(await operator.votingBallot.count({ where: { sessionId } }), FINALISTS * VOTERS);
    const mapping = { kind: 'ADMISSION' };
    const plan = await as(leader, () => voting.previewLiveVotingFinalization({ ...scope, mapping }));
    assert.equal(plan.stale.length, 0); assert.equal(plan.changes.length, FINALISTS);
    assert.equal(plan.changes.filter(c => c.toStatus === 'ACCEPTED').length, ADMITTED);
    okRoom(await as(leader, () => voting.finalizeLiveVotingRoom({ ...scope, mapping, guard: plan.guard, revision: plan.revision, requestId: randomUUID(), confirmed: true })));
    const rows = await operator.application.findMany({ where: { id: { in: finalists.map(a => a.applicationId) } } });
    assert.deepEqual(new Set(rows.filter(r => r.status === 'ACCEPTED').map(r => r.id)), accept);
    assert.equal(rows.filter(r => r.status === 'REJECTED').length, FINALISTS - ADMITTED);
    // Finalization defers applicant communication until it is explicitly released.
    assert.equal(await operator.userNotification.count({ where: { clubId: club.id, type: 'DECISION' } }), APPLICANTS - FINALISTS);
    assert.equal(await operator.decisionLetter.count({ where: { applicationId: { in: finalists.map(a => a.applicationId) } } }), 0);
    assert.equal(await operator.clubInvitation.count({ where: { clubId: club.id, status: 'PENDING' } }), ADMITTED);
    st.diagnostic(`ballots ${FINALISTS * VOTERS}, admitted ${ADMITTED}`);
  });

  await stage('6. decisions released: one letter, notification and queued email per applicant', async st => {
    const released = await as(leader, () => voting.sendLiveVotingNotifications({ clubId: club.id, sessionId, requestId: randomUUID(), confirmed: true }));
    assert.equal(released.sent, FINALISTS);
    const rows = await operator.application.findMany({ where: { clubId: club.id }, include: { decisionLetters: true } });
    for (const row of rows) {
      assert.ok(['ACCEPTED', 'REJECTED'].includes(row.status)); assert.equal(row.decisionVersion, 1);
      assert.equal(row.decisionLetters.length, 1, 'exactly one decision letter');
      assert.equal(row.decisionLetters[0].decision, row.status, 'letter matches the final decision');
      assert.equal(await operator.userNotification.count({ where: { userId: row.studentId, clubId: club.id, eventKey: `decision:${row.id}:1` } }), 1);
    }
    assert.equal(await operator.userNotification.count({ where: { clubId: club.id, type: 'DECISION' } }), APPLICANTS);
    assert.equal(await operator.notificationEmailOutbox.count({ where: { notification: { clubId: club.id, type: 'DECISION' } } }), APPLICANTS);
    st.diagnostic(`letters ${rows.length}`);
  });

  await stage('7. admitted students accept their offers and become members', async st => {
    const accepting = admitted().slice(0, ADMITTED - 1), declining = admitted().slice(ADMITTED - 1);
    for (const a of accepting) assert.equal((await as(a.user, () => offers.respondToOffer(a.applicationId, 'ACCEPT'))).status, 'ACCEPTED');
    for (const a of declining) assert.equal((await as(a.user, () => offers.respondToOffer(a.applicationId, 'DECLINE'))).status, 'DECLINED');
    // A rejected applicant has no offer to accept.
    await refused(as(declined()[0].user, () => offers.respondToOffer(declined()[0].applicationId, 'ACCEPT')), /unavailable/i);
    const members = await operator.clubMember.findMany({ where: { clubId: club.id, userId: { in: applicants.map(a => a.user.id) } } });
    assert.deepEqual(new Set(members.map(m => m.userId)), new Set(accepting.map(a => a.user.id)));
    assert.ok(members.every(m => m.status === 'ACTIVE' && m.accessRole === 'MEMBER' && !m.isOwner && m.permissions.length === 0));
    const invitations = await operator.clubInvitation.findMany({ where: { clubId: club.id } });
    assert.equal(invitations.length, ADMITTED);
    assert.equal(invitations.filter(o => o.status === 'ACCEPTED').length, accepting.length);
    assert.equal(invitations.filter(o => o.status === 'DECLINED').length, declining.length);
    st.diagnostic(`members ${members.length}, declined ${declining.length}`);
  });

  await stage('8. final states are exclusive and the roster CSV export reflects the new members', async st => {
    const rows = await operator.application.findMany({ where: { clubId: club.id }, include: { decisionLetters: true } });
    assert.equal(rows.length, APPLICANTS);
    const accepted = rows.filter(r => r.status === 'ACCEPTED'), rejected = rows.filter(r => r.status === 'REJECTED');
    assert.equal(accepted.length, ADMITTED); assert.equal(rejected.length, APPLICANTS - ADMITTED);
    assert.equal(accepted.length + rejected.length, APPLICANTS, 'no applicant left in a non-final state');
    // No applicant appears in two final states: one decision per application, letters agree, and only
    // accepted applicants hold offers or memberships.
    assert.equal(new Set(rows.map(r => r.id)).size, APPLICANTS);
    for (const row of rows) assert.deepEqual([...new Set(row.decisionLetters.map(l => l.decision))], [row.status]);
    const offerApps = new Set((await operator.clubInvitation.findMany({ where: { clubId: club.id } })).map(o => o.applicationId));
    assert.ok(rejected.every(r => !offerApps.has(r.id)));
    const memberUsers = new Set((await operator.clubMember.findMany({ where: { clubId: club.id } })).map(m => m.userId));
    assert.ok(rejected.every(r => !memberUsers.has(r.studentId)));
    // Roster export through the real route handler.
    const response = await as(leader, () => exportsRoute.GET(new Request(`http://127.0.0.1/api/club-exports?clubId=${club.id}&kind=roster`)));
    assert.equal(response.status, 200); assert.match(response.headers.get('Content-Type'), /text\/csv/);
    const csv = await response.text(), lines = csv.trim().split(/\r?\n/);
    const memberEmails = admitted().slice(0, ADMITTED - 1).map(a => a.user.email);
    assert.ok(memberEmails.every(email => csv.includes(email)), 'every new member is on the roster');
    assert.equal(lines.filter(line => line.includes('mock-applicant-')).length, memberEmails.length, 'only accepted members appear');
    assert.ok(!csv.includes(admitted()[ADMITTED - 1].user.email), 'a declined offer is not on the roster');
    assert.equal(await operator.auditLog.count({ where: { clubId: club.id, action: 'club.export.roster' } }), 1);
    // Unauthorized roster export is refused.
    const denied = await as(reviewers[0].user, () => exportsRoute.GET(new Request(`http://127.0.0.1/api/club-exports?clubId=${club.id}&kind=roster`)));
    assert.equal(denied.status, 403);
    st.diagnostic(`roster rows ${lines.length - 1}`);
  });

  t.diagnostic(`mock recruiting cycle baseline (${APPLICANTS} applicants, ${REVIEWERS} reviewers, ${FINALISTS} finalists, ms): ${JSON.stringify(timings)}`);
});
