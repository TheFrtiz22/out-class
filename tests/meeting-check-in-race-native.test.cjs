const {unwrapActions}=require('./helpers/action-result.cjs');
// Two simultaneous QR check-ins by the same member on isolated native PostgreSQL,
// through the real issueMeetingCheckIn and checkInMeeting (meeting row FOR UPDATE,
// unique (eventId, studentId)). Run: node scripts/run-disposable-postgres.cjs security
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { databaseUrl, raceFixture } = require('./helpers/race-native.cjs');

test('two simultaneous check-ins by one member record one attendance', { skip: !databaseUrl, timeout: 120000 }, async t => {
  const { operator, load, as, race, user, club } = await raceFixture(t);
  const meetings = unwrapActions(load('actions/meetings.ts'));
  const c = await club();
  const leader = await user('leader'), member = await user('member');
  await operator.clubMember.create({ data: { clubId: c.id, userId: leader.id, isOwner: true } });
  await operator.clubMember.create({ data: { clubId: c.id, userId: member.id } });
  const meeting = await operator.meeting.create({ data: { clubId: c.id, title: 'General meeting', date: new Date(), location: 'Rice Hall', audience: 'MEMBERS', isPublic: false } });
  const { token } = await as(leader, () => meetings.issueMeetingCheckIn(c.id, meeting.id));

  const results = await race([member, () => meetings.checkInMeeting(meeting.id, token)], [member, () => meetings.checkInMeeting(meeting.id, token)]);
  assert.ok(results.every(r => r.ok), JSON.stringify(results));
  assert.deepEqual(results.map(r => r.value.status).sort(), ['already-checked-in', 'checked-in']);
  assert.equal(results[0].value.checkedInAt, results[1].value.checkedInAt, 'both report the stored check-in');
  assert.equal(await operator.eventAttendance.count({ where: { eventId: meeting.id, studentId: member.id } }), 1);
});
