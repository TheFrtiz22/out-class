const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { unwrapActions } = require('./helpers/action-result.cjs');
function load(file, mocks = {}) {
  const m = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/') ? load(n.slice(2) + '.ts', mocks) : require(n), m, m.exports);
  return m.exports;
}
const id = n => `123e4567-e89b-12d3-a456-${String(n).padStart(12, '0')}`;
const clubId = id(1), applicationId = id(2), roundId = id(3), questionId = id(4), viewerUser = id(5), viewerMember = id(6), peerMember = id(7);

// Revealing an applicant's identity is about who they are. It must not hand out more review data than the
// canonical pipeline detail (lib/pipeline-detail.ts): peers' scores only to closing leadership, nothing to a
// member who stepped out of the applicant, and never a reviewer's grades on their own application.
function fixture({ offices = [], recused = false, applicant = 'student', answers } = {}) {
  const app = { id: applicationId, clubId, studentId: applicant, status: 'IN_REVIEW', roundId, decisionVersion: 1, decisionStateRevision: 1,
    club: { profileFieldVisibility: null },
    round: { id: roundId, name: 'Review', type: 'REVIEW', anonymousReview: true, applicantDisplay: null, archivedAt: null },
    student: { id: applicant, email: 'applicant@virginia.edu', role: 'STUDENT', createdAt: new Date(), disabledAt: null,
      studentProfile: { id: id(8), userId: applicant, firstName: 'Ada', lastName: 'Lee', computingId: 'al1', major: 'Math', gradYear: 2028, headshotUrl: null, experiences: [] } },
    evaluations: [{ id: id(9), applicationId, interviewerId: peerMember, roundId, round: 'Review', score: 9, rubricScores: { fit: 5 }, submittedAt: new Date(), createdAt: new Date() }],
    interviewAssignments: [],
    answers: answers ?? [{ id: id(10), applicationId, questionId, response: 'Private essay', question: { id: questionId, clubId, type: 'ESSAY', prompt: 'Why?', options: [], order: 0, showIf: null } }],
    bookings: [] };
  const member = { id: viewerMember, userId: viewerUser, clubId, status: 'ACTIVE', isOwner: false, permissions: ['applications.review', 'applicants.identify'], interviewOffices: offices, alumniSince: null };
  const tx = {
    $queryRaw: async () => [],
    // Rows come back in storage order unless the query asks for question order, as PostgreSQL may.
    application: { findFirst: async ({ where, include }) => {
      if (where.id !== applicationId || where.clubId !== clubId) return null;
      const order = include?.answers?.orderBy;
      const byQuestion = Array.isArray(order) && order.some(o => o.question?.order === 'asc');
      return byQuestion ? { ...app, answers: [...app.answers].sort((a, b) => a.question.order - b.question.order) } : app;
    } },
    applicantRecusal: { findFirst: async ({ where }) => recused && where.applicationId === applicationId && where.memberId === viewerMember && where.liftedAt === null ? { id: 'recusal' } : null },
    auditLog: { create: async () => ({}) },
  };
  const crm = unwrapActions(load('actions/crm.ts', {
    '@/utils/auth': { requireClubPermission: async () => ({ user: { id: viewerUser }, membership: member }) },
    '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx) } },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => member },
    'next/cache': { revalidatePath() {} },
  }));
  return () => crm.revealApplicantIdentity(clubId, applicationId, 'Resolve a scheduling conflict');
}

test('a plain reviewer who reveals an identity does not receive other reviewers\' scores', async () => {
  const revealed = await fixture()();
  assert.equal(revealed.student.studentProfile.firstName, 'Ada', 'the identity is revealed');
  assert.deepEqual(revealed.evaluations, [], 'a peer\'s score is not part of the reveal');
  assert.doesNotMatch(JSON.stringify(revealed), /rubricScores|"score":9/);
});
test('a member who stepped out of the applicant gets no scores or answers from a reveal', async () => {
  const revealed = await fixture({ offices: ['PRESIDENT'], recused: true })();
  assert.deepEqual(revealed.evaluations, []);
  assert.deepEqual(revealed.answers, []);
  assert.doesNotMatch(JSON.stringify(revealed), /Private essay/);
});
test('a reviewer revealing their own application sees none of the grades about them', async () => {
  const revealed = await fixture({ offices: ['PRESIDENT'], applicant: viewerUser })();
  assert.deepEqual(revealed.evaluations, []);
});
test('closing leadership still sees submitted scores and answers after a reveal', async () => {
  const revealed = await fixture({ offices: ['PRESIDENT'] })();
  assert.equal(revealed.evaluations.length, 1);
  assert.equal(revealed.evaluations[0].score, 9);
  assert.equal(revealed.answers[0].response, 'Private essay');
});
test('a reveal keeps a follow-up answer that the database returns before its parent question', async () => {
  const parentId = id(11), followUpId = id(12);
  const parent = { id: parentId, clubId, type: 'MULTIPLE_CHOICE', prompt: 'Have you led a team?', options: ['Yes', 'No'], order: 0, showIf: null };
  const followUp = { id: followUpId, clubId, type: 'ESSAY', prompt: 'Tell us about it', options: [], order: 1, showIf: { questionId: parentId, anyOf: ['Yes'] } };
  const revealed = await fixture({ offices: ['PRESIDENT'], answers: [
    { id: id(13), applicationId, questionId: followUpId, response: 'Ran the robotics club', question: followUp },
    { id: id(14), applicationId, questionId: parentId, response: 'Yes', question: parent },
  ] })();
  assert.deepEqual(revealed.answers.map(a => a.response).sort(), ['Ran the robotics club', 'Yes'], 'the visible follow-up is part of the reveal');
});
