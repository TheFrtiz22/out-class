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

// A whole room scans the same QR code within seconds. Each check-in may serialize with
// the leader closing or rotating the code, but members must not queue behind each other.
async function checkInFixture(t, options) {
  const fixture = await raceFixture(t, options);
  const meetings = unwrapActions(fixture.load('actions/meetings.ts'));
  const c = await fixture.club(), leader = await fixture.user('leader');
  await fixture.operator.clubMember.create({ data: { clubId: c.id, userId: leader.id, isOwner: true } });
  const meeting = await fixture.operator.meeting.create({ data: { clubId: c.id, title: 'Info session', date: new Date(), location: 'Rice Hall', audience: 'MEMBERS', isPublic: false } });
  const { token } = await fixture.as(leader, () => meetings.issueMeetingCheckIn(c.id, meeting.id));
  const member = async label => { const u = await fixture.user(label); await fixture.operator.clubMember.create({ data: { clubId: c.id, userId: u.id } }); return u; };
  return { ...fixture, meetings, meeting, token, member };
}

test('one member held inside check-in does not block another member', { skip: !databaseUrl, timeout: 120000 }, async t => {
  let holdUser = null, held, release;
  const holding = new Promise(resolve => { held = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const keep = setInterval(() => {}, 1000); t.after(() => clearInterval(keep));
  const f = await checkInFixture(t, { roundTripMs: 0, beforeStatement: async ({ model, operation, args }) => {
    if (holdUser) console.error('DEBUG hook', model, operation, JSON.stringify(args?.where ?? null));
    // Pause the first member after their transaction has taken its meeting lock.
    if (holdUser && model === 'EventAttendance' && operation === 'findUnique' && args?.where?.eventId_studentId?.studentId === holdUser) { held(); await gate; }
  } });
  const first = await f.member('first'), second = await f.member('second');
  holdUser = first.id;
  const firstCall = f.as(first, () => f.meetings.checkInMeeting(f.meeting.id, f.token));
  const early = await Promise.race([holding.then(() => 'held'), firstCall.then(r => 'settled ' + JSON.stringify(r), e => 'threw ' + e.message), new Promise(r => setTimeout(() => r('timeout'), 8000))]);
  console.error('DEBUG early', early);
  const locks = await f.operator.$queryRawUnsafe(`SELECT l.locktype, l.mode, l.granted, l.relation::regclass::text AS rel, a.state, left(a.query, 120) AS q FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid WHERE a.datname = current_database() AND a.pid <> pg_backend_pid() AND l.locktype IN ('relation','tuple','transactionid')`);
  console.error('DEBUG locks', JSON.stringify(locks));
  await holding;
  const secondCall = f.as(second, () => f.meetings.checkInMeeting(f.meeting.id, f.token));
  const outcome = await Promise.race([secondCall.then(r => r.status), new Promise(resolve => setTimeout(() => resolve('waited'), 3000))]);
  release();
  await Promise.all([firstCall, secondCall]);
  assert.equal(outcome, 'checked-in', 'the second member checked in while the first was still in progress');
  assert.equal(await f.operator.eventAttendance.count({ where: { eventId: f.meeting.id } }), 2);
});

test('closing check-in still waits for check-ins in progress', { skip: !databaseUrl, timeout: 120000 }, async t => {
  let holdUser = null, held, release;
  const holding = new Promise(resolve => { held = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const f = await checkInFixture(t, { roundTripMs: 0, beforeStatement: async ({ model, operation, args }) => {
    if (holdUser && model === 'EventAttendance' && operation === 'findUnique' && args?.where?.eventId_studentId?.studentId === holdUser) { held(); await gate; }
  } });
  const first = await f.member('first'); holdUser = first.id;
  const firstCall = f.as(first, () => f.meetings.checkInMeeting(f.meeting.id, f.token));
  await holding;
  const leader = await f.operator.clubMember.findFirst({ where: { clubId: f.meeting.clubId, isOwner: true } });
  const leaderUser = await f.operator.user.findUnique({ where: { id: leader.userId } });
  let closed = false;
  const closeCall = f.as(leaderUser, () => f.meetings.closeMeetingCheckIn(f.meeting.clubId, f.meeting.id)).then(() => { closed = true; });
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(closed, false, 'closing waits for the check-in that already holds the meeting');
  release();
  assert.equal((await firstCall).status, 'checked-in');
  await closeCall;
});

// Real numbers for the launch question "can a full room check in at once?". The 2 ms
// round trip is the co-located pdx1 functions to us-west-2 database path
// (docs/performance/region-co-location-20261104.md). OUTCLASS_CHECKIN_BURST=60,150 overrides sizes.
test('a room-sized burst of QR check-ins records each member exactly once', { skip: !databaseUrl, timeout: 600000 }, async t => {
  const sizes = (process.env.OUTCLASS_CHECKIN_BURST || '60,150').split(',').map(Number);
  for (const size of sizes) {
    const f = await checkInFixture(t, { roundTripMs: 2 });
    const members = [];
    for (let i = 0; i < size; i++) members.push(await f.member(`burst${i}`));
    const started = Date.now();
    const results = await f.race(...members.map(m => [m, async () => { const at = Date.now(); const r = await f.meetings.checkInMeeting(f.meeting.id, f.token); return { ...r, ms: Date.now() - at }; }]));
    const wall = Date.now() - started;
    const good = results.filter(r => r.ok).map(r => r.value.ms).sort((a, b) => a - b);
    const failed = results.filter(r => !r.ok);
    const pct = p => good.length ? good[Math.min(good.length - 1, Math.floor(p * good.length))] : null;
    const stored = await f.operator.eventAttendance.count({ where: { eventId: f.meeting.id } });
    t.diagnostic(`check-in burst members=${size}: ${good.length}/${size} checked in, stored ${stored}, p50=${pct(0.5)}ms p95=${pct(0.95)}ms max=${pct(1)}ms wall=${wall}ms errors=${JSON.stringify([...new Set(failed.map(r => r.error))])}`);
    assert.equal(stored, good.length, 'every successful check-in is stored exactly once');
    assert.equal(failed.length, 0, `every member in a ${size}-person room checks in`);
  }
});
