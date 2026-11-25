const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, mocks = {}) {
  const m = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/') ? load(n.slice(2) + '.ts', mocks) : require(n), m, m.exports);
  return m.exports;
}
const id = n => `123e4567-e89b-12d3-a456-${String(n).padStart(12, '0')}`;
const clubId = id(1), applicationId = id(2), roundId = id(3), nextRoundId = id(4), leaderUser = id(5), leaderMember = id(6), scheduleId = id(7);
const { decisionPublicationGuard } = load('lib/decision-publication-guard.ts');

// The staged decision path refuses a leader's own application and an applicant they stepped out of
// (actions/review-decisions.ts). Every direct decision path must refuse the same two cases.
function fixture({ applicant = 'student', recused = false, status = 'IN_REVIEW' } = {}) {
  const state = { published: 0, updates: 0, scheduled: 0 };
  const app = { id: applicationId, clubId, studentId: applicant, status, roundId, decisionVersion: 1, decisionStateRevision: 1, recruitmentCycleId: null,
    round: { id: roundId, name: 'Review', type: 'REVIEW', anonymousReview: false, archivedAt: null },
    student: { studentProfile: { firstName: 'Ada', lastName: 'Lee' } } };
  const member = { id: leaderMember, userId: leaderUser, status: 'ACTIVE', permissions: ['decisions.manage', 'applicants.identify', 'recruitment.manage'], interviewOffices: [] };
  const tx = {
    $queryRaw: async () => [],
    application: {
      findFirst: async ({ where }) => {
        if (where.studentId) return null; // no other application by this student (reconsider)
        if (where.id !== app.id || (where.clubId && where.clubId !== clubId)) return null;
        if (typeof where.status === 'string' && where.status !== app.status) return null;
        return app;
      },
      findMany: async () => [app],
      updateMany: async () => { state.updates++; return { count: 1 }; },
    },
    applicantRecusal: {
      findFirst: async ({ where }) => recused && where.applicationId === applicationId && where.memberId === leaderMember && where.liftedAt === null ? { id: 'recusal' } : null,
      findMany: async () => [],
    },
    pipelineRound: { findFirst: async ({ where }) => where.id === nextRoundId ? { id: nextRoundId, clubId, type: 'INTERVIEW', archivedAt: null } : null },
    scheduledCommunication: { findUnique: async () => null, count: async () => 0, create: async () => { state.scheduled++; } },
    club: { findUniqueOrThrow: async () => ({ sendFormalDecisionLetters: false, decisionLetterTemplates: null, name: 'Club', color: '#123456', logoUrl: null }) },
    auditLog: { create: async () => ({}) },
  };
  const mocks = {
    '@/utils/auth': { requireClubPermission: async club => { assert.equal(club, clubId); return { user: { id: leaderUser }, membership: member }; } },
    '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx) } },
    '@/utils/club-write-transaction': { clubWriteTransaction: async fn => fn(tx) },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => member },
    '@/utils/recruitment-offers': { publishRecruitmentDecision: async (_tx, input) => { state.published++; return { previousStatus: app.status, status: input.status }; } },
    '@/utils/support-audit': { supportContext: async () => null, auditSupportAction: async () => {} },
    '@/utils/decision-scheduling': { roundPublicationKey: round => round.id },
    'next/cache': { revalidatePath() {}, revalidateTag() {} },
  };
  const crm = load('actions/crm.ts', mocks);
  const management = load('actions/recruitment-management.ts', mocks);
  const schedules = load('actions/decision-schedules.ts', mocks);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return {
    state,
    decide: () => crm.setApplicationStatus({ clubId, applicationId, status: 'ACCEPTED', expectedStatus: status }),
    move: () => crm.moveApplicantRound({ clubId, applicationId, newRoundId: nextRoundId, expectedRoundId: roundId }),
    reconsider: () => management.reconsiderRejectedApplication({ clubId, applicationId, expectedGuard: decisionPublicationGuard(app), reason: 'Second look after new information' }),
    schedule: () => schedules.scheduleDecisionPublication({ id: scheduleId, clubId, localTime: `${tomorrow}T12:00`, timeZone: 'America/New_York', occurrence: 'EARLIER',
      selection: { kind: 'DIRECT', applicationId, expectedGuard: decisionPublicationGuard(app), status: 'ACCEPTED' } }),
  };
}
const refused = (result, pattern) => { assert.equal(result?.ok, false, 'the action is refused'); assert.match(result.error, pattern); };
const OWN = /your own application/i, RECUSED = /stepped out of reviewing this applicant/i;

test('a leader cannot accept their own application directly', async () => {
  const f = fixture({ applicant: leaderUser });
  refused(await f.decide(), OWN);
  assert.equal(f.state.published, 0, 'no decision is published');
});
test('a recused leader cannot decide that applicant directly', async () => {
  const f = fixture({ recused: true });
  refused(await f.decide(), RECUSED);
  assert.equal(f.state.published, 0);
});
test('a leader cannot move their own application, or a recused applicant, to another round', async () => {
  for (const [options, pattern] of [[{ applicant: leaderUser }, OWN], [{ recused: true }, RECUSED]]) {
    const f = fixture(options);
    refused(await f.move(), pattern);
    assert.equal(f.state.updates, 0, 'the application is not moved');
  }
});
test('a leader cannot reopen their own rejected application, or a recused applicant\'s', async () => {
  for (const [options, pattern] of [[{ applicant: leaderUser, status: 'REJECTED' }, OWN], [{ recused: true, status: 'REJECTED' }, RECUSED]]) {
    const f = fixture(options);
    refused(await f.reconsider(), pattern);
    assert.equal(f.state.updates, 0, 'the decision is not reopened');
  }
});
test('a leader cannot schedule a direct decision on their own application, or a recused applicant\'s', async () => {
  for (const [options, pattern] of [[{ applicant: leaderUser }, OWN], [{ recused: true }, RECUSED]]) {
    const f = fixture(options);
    refused(await f.schedule(), pattern);
    assert.equal(f.state.scheduled, 0, 'nothing is scheduled');
  }
});
test('the same paths still work for another applicant the leader has not stepped out of', async () => {
  let f = fixture(); assert.equal((await f.decide()).ok, true); assert.equal(f.state.published, 1);
  f = fixture(); assert.equal((await f.move()).ok, true); assert.equal(f.state.updates, 1);
  f = fixture({ status: 'REJECTED' }); assert.equal((await f.reconsider()).ok, true); assert.equal(f.state.updates, 1);
  f = fixture(); assert.equal((await f.schedule()).ok, true); assert.equal(f.state.scheduled, 1);
});
