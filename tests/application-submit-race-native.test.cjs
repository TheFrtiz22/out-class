const {unwrapActions}=require('./helpers/action-result.cjs');
// Two simultaneous submits of the same application on isolated native PostgreSQL,
// through the real submitApplication (club FOR SHARE, student row FOR UPDATE,
// DRAFTING status predicate). Run: node scripts/run-disposable-postgres.cjs security
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { databaseUrl, raceFixture } = require('./helpers/race-native.cjs');

test('two simultaneous submits create one application', { skip: !databaseUrl, timeout: 120000 }, async t => {
  const { operator, load, as, race, user, club } = await raceFixture(t);
  const applications = unwrapActions(load('actions/applications.ts'));

  async function setup() {
    const c = await club({ applicationOpen: true });
    await operator.pipelineRound.create({ data: { clubId: c.id, name: 'Applied', order: 0 } });
    const question = await operator.applicationQuestion.create({ data: { clubId: c.id, prompt: 'Why?', type: 'ESSAY', required: true, order: 0 } });
    await operator.recruitmentCycle.create({ data: { clubId: c.id, name: 'Fall' } });
    const student = await user('student');
    await operator.studentProfile.create({ data: { userId: student.id, firstName: 'Race', lastName: 'Student', computingId: student.email.split('@')[0], major: 'Economics', gradYear: 2028 } });
    return { club: c, student, input: { clubId: c.id, answers: [{ questionId: question.id, response: 'Same answer' }] } };
  }
  async function assertOne(f, results) {
    assert.equal(results.filter(r => r.ok).length, 1, JSON.stringify(results));
    assert.match(results.find(r => !r.ok).error, /already been submitted/);
    // The loser is a returned { ok: false, code } refusal, not a thrown error.
    assert.equal(results.find(r => !r.ok).refused, true); assert.equal(results.find(r => !r.ok).code, 'ACTION_REFUSED');
    const rows = await operator.application.findMany({ where: { studentId: f.student.id, clubId: f.club.id }, include: { answers: true } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'SUBMITTED');
    assert.equal(rows[0].id, results.find(r => r.ok).value.applicationId);
    assert.equal(rows[0].answers.length, 1, 'answers are not duplicated');
  }

  await t.test('first submit without a saved draft', async () => {
    const f = await setup();
    await assertOne(f, await race([f.student, () => applications.submitApplication(f.input)], [f.student, () => applications.submitApplication(f.input)]));
  });

  await t.test('submit from an existing draft', async () => {
    const f = await setup();
    await as(f.student, () => applications.saveApplicationDraft(f.input));
    await assertOne(f, await race([f.student, () => applications.submitApplication(f.input)], [f.student, () => applications.submitApplication(f.input)]));
  });
});
