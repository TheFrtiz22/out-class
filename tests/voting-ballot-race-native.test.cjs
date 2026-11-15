// One voter casting from two devices at once, and a replayed ballot request, on isolated
// native PostgreSQL through the real castLiveVotingBallot (session row lock, ballot revision
// check, unique (sessionId, passNumber, applicationId, memberId), request receipts).
// Run: node scripts/run-disposable-postgres.cjs security
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { databaseUrl, raceFixture } = require('./helpers/race-native.cjs');

const caps = ['applications.review', 'applicants.identify', 'decisions.vote', 'decisions.start', 'decisions.manage', 'decisions.finish', 'decisions.publish', 'recruitment.manage'];

test('one member voting from two devices records one ballot; a replayed request is applied once', { skip: !databaseUrl, timeout: 120000 }, async t => {
  const { operator, load, as, race, user, club } = await raceFixture(t);
  const api = Object.assign({}, load('actions/voting-room.ts'), load('actions/voting-room-setup.ts'));
  const c = await club();
  const cycle = await operator.recruitmentCycle.create({ data: { clubId: c.id, name: 'Cycle' } });
  const round = await operator.pipelineRound.create({ data: { clubId: c.id, name: 'Interview', type: 'INTERVIEW', order: 0 } });
  const leaderUser = await user('leader'), voterUser = await user('voter'), applicant = await user('applicant');
  const leader = await operator.clubMember.create({ data: { clubId: c.id, userId: leaderUser.id, permissions: caps } });
  const voter = await operator.clubMember.create({ data: { clubId: c.id, userId: voterUser.id, permissions: ['applications.review', 'applicants.identify', 'decisions.vote'] } });
  const app = await operator.application.create({ data: { clubId: c.id, studentId: applicant.id, roundId: round.id, recruitmentCycleId: cycle.id, status: 'IN_REVIEW', submittedAt: new Date() } });
  const scope = { clubId: c.id, sessionId: randomUUID() };
  const created = await as(leaderUser, () => api.createLiveVotingRoom({ ...scope, cycleId: cycle.id, roundId: round.id, applicationIds: [app.id], participantIds: [leader.id, voter.id], leaderMemberIds: [leader.id], targetSize: 1, presentationOptions: { fields: ['name'], highlights: {} } }));
  assert.equal(created.sessionId, scope.sessionId, JSON.stringify(created));
  const command = async action => {
    const result = await as(leaderUser, async () => api.commandLiveVotingRoom({ ...scope, action, requestId: randomUUID(), revision: (await api.getLiveVotingRoom(scope)).revision, confirmed: true }));
    assert.equal(result.ok, true, JSON.stringify(result));
  };
  await command('START');
  await as(voterUser, () => api.joinLiveVotingRoom(scope));
  await command('OPEN_VOTING');
  const ballot = extra => ({ ...scope, applicationId: app.id, passNumber: 1, ...extra });
  const stored = () => operator.votingBallot.findMany({ where: { sessionId: scope.sessionId, memberId: voter.id } });

  // Two devices, both believing no ballot exists yet: one is recorded, the other is told to reload.
  const first = await race(
    [voterUser, () => api.castLiveVotingBallot(ballot({ ballotRevision: null, choice: 'ACCEPT', requestId: randomUUID() }))],
    [voterUser, () => api.castLiveVotingBallot(ballot({ ballotRevision: null, choice: 'REJECT', requestId: randomUUID() }))],
  );
  assert.ok(first.every(r => r.ok), JSON.stringify(first));
  assert.equal(first.filter(r => r.value.ok).length, 1, JSON.stringify(first));
  assert.equal(first.find(r => !r.value.ok).value.code, 'STALE_BALLOT');
  let rows = await stored();
  assert.equal(rows.length, 1); assert.equal(rows[0].revision, 0);

  // The same request delivered twice (network retry): one change, both answers identical.
  const retry = ballot({ ballotRevision: 0, choice: 'HOLD', requestId: randomUUID() });
  const replay = await race([voterUser, () => api.castLiveVotingBallot(retry)], [voterUser, () => api.castLiveVotingBallot(retry)]);
  assert.ok(replay.every(r => r.ok && r.value.ok), JSON.stringify(replay));
  assert.deepEqual(replay.map(r => r.value.result.ballotRevision), [1, 1]);
  rows = await stored();
  assert.equal(rows.length, 1); assert.equal(rows[0].revision, 1);
  assert.equal(await operator.votingRoomCommand.count({ where: { sessionId: scope.sessionId, requestId: retry.requestId } }), 1);
  assert.equal(await operator.auditLog.count({ where: { targetId: scope.sessionId, action: 'voting.room.ballot.changed' } }), 1);
});
