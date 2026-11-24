// Student Home's calendar holds the student's own events, not every public meeting at the school.
// Run: node scripts/run-disposable-postgres.cjs security
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { databaseUrl, raceFixture } = require('./helpers/race-native.cjs');
const { schoolScope } = require('./helpers/school-scope.cjs');

test('student Home calendar: own clubs, applied clubs, RSVPs and saves only', { skip: !databaseUrl, timeout: 120000 }, async t => {
  const { operator, load, as, user, club } = await raceFixture(t, { mocks: { '@/utils/school-scope': schoolScope() } });
  const applications = load('actions/applications.ts');
  await operator.school.upsert({ where: { id: 'school-uva' }, update: {}, create: { id: 'school-uva', key: 'uva', name: 'University of Virginia' } });
  const student = await user('calendar-student');
  const soon = new Date(Date.now() + 3 * 86400000);
  const meeting = (c, title, data = {}) => operator.meeting.create({ data: { clubId: c.id, title, date: soon, location: 'Rice Hall', ...data } });

  const member = await club({ name: 'Member club' });
  await operator.clubMember.create({ data: { userId: student.id, clubId: member.id } });
  const applied = await club({ name: 'Applied club' });
  const round = await operator.pipelineRound.create({ data: { clubId: applied.id, name: 'Written', order: 1 } }).catch(() => null);
  await operator.application.create({ data: { studentId: student.id, clubId: applied.id, ...(round ? { roundId: round.id } : {}) } });
  const rsvpClub = await club({ name: 'RSVP club' }), savedClub = await club({ name: 'Saved club' }), other = await club({ name: 'Other club' });

  const expected = [
    await meeting(member, 'Member meeting', { audience: 'MEMBERS', isPublic: false }),
    await meeting(member, 'Member interest meeting'),
    await meeting(applied, 'Applied interest meeting'),
  ];
  await meeting(applied, 'Applied club members-only', { audience: 'MEMBERS', isPublic: false });
  const rsvpd = await meeting(rsvpClub, 'RSVP event');
  await operator.eventPublication.create({ data: { eventId: rsvpd.id, status: 'PUBLISHED', approvedRevision: 0, publishedAt: new Date(), reviewedAt: new Date(), reviewedBy: (await user('reviewer')).id } });
  await operator.eventRsvp.create({ data: { eventId: rsvpd.id, userId: student.id } });
  await meeting(rsvpClub, 'RSVP club other event');
  const saved = await meeting(savedClub, 'Saved event');
  await operator.savedCampusEvent.create({ data: { eventId: saved.id, userId: student.id } });
  await meeting(other, 'Other club interest meeting');
  expected.push(rsvpd, saved);

  const data = await as(student, () => applications.getStudentDashboardData());
  assert.deepEqual(data.meetings.map(m => m.title).sort(), expected.map(m => m.title).sort());
});
