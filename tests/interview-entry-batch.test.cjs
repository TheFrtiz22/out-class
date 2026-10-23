const { test } = require('node:test'), assert = require('node:assert/strict');
const { harness, id } = require('./helpers/interview-harness.cjs');

function fixture(count = 24) {
  const h = harness(), reads = [], member = h.members[0];
  for (const m of h.members) { m.club = { name: 'Synthetic', suspendedAt: null }; m.user.studentProfile = { firstName: 'Reviewer', lastName: m.id }; }
  const room = { id: id(6), clubId: h.scope.clubId, roundId: h.round.id, round: h.round, name: 'Room', location: 'Room', timezone: 'UTC', isOpen: true, panelApprovedBy: member.userId, panelMemberIds: h.members.map(m => m.id), approvedPanelMemberIds: h.members.map(m => m.id) };
  const slots = Array.from({ length: count }, (_, n) => {
    const app = { ...h.app, id: id(1000 + n), student: { studentProfile: { firstName: 'Candidate', lastName: String(n) } } };
    return { id: id(2000 + n), clubId: room.clubId, roomId: room.id, room, panelScheduleVersionId: null, panelScheduleVersion: null, startTime: new Date(1800000000000 + n * 1800000), endTime: new Date(1800001200000 + n * 1800000), bookings: [{ id: id(3000 + n), applicationId: app.id, roundId: h.round.id, application: app }] };
  });
  h.assignments.splice(0, h.assignments.length, ...slots.map(s => ({ applicationId: s.bookings[0].applicationId, roundId: h.round.id, memberId: member.id, revokedAt: null })));
  const matches = (value, where) => Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return expected.some(w => matches(value, w));
    if (expected && typeof expected === 'object') { if ('in' in expected) return expected.in.includes(value[key]); if ('not' in expected) return value[key] !== expected.not; return matches(value[key] || {}, expected); }
    return value[key] === expected;
  });
  h.tx.interviewSlot = { findMany: async ({ where }) => where.room.isOpen ? slots.filter(s => s.room.isOpen) : slots };
  h.tx.clubMember.findMany = async ({ where }) => h.members.filter(m => matches(m, where));
  h.tx.interviewPanelAssignment.findMany = async ({ where }) => h.assignments.filter(a => matches({ ...a, application: { clubId: h.scope.clubId } }, where));
  h.tx.interviewRecord.findMany = async ({ where }) => h.state.records.filter(r => matches({ ...r, application: { clubId: h.scope.clubId } }, where));
  for (const model of ['clubMember', 'interviewPanelAssignment', 'interviewRecord']) for (const method of ['findMany', 'findUnique', 'findFirst']) {
    if (!h.tx[model][method]) continue;
    const original = h.tx[model][method]; h.tx[model][method] = async args => { reads.push({ model, method, args }); return original(args); };
  }
  return { ...h, slots, room, reads, read: () => h.load('actions/interview-entry.ts').getAssignedInterviewRooms(h.scope.clubId) };
}
test('assigned room database reads grow by bounded batches, with exact grant/record scopes and no private drafts', async () => {
  for (const count of [1, 24, 129]) {
    const h = fixture(count), rows = await h.read(); assert.equal(rows.length, count); assert.ok(rows.every(r => r.canOpen && r.interviewers.length === 2));
    const grants = h.reads.filter(r => r.model === 'interviewPanelAssignment');
    assert.equal(grants.length, Math.ceil(count / 128));
    for (const query of grants) { assert.equal(query.method, 'findMany'); assert.equal(query.args.where.memberId, h.members[0].id); assert.equal(query.args.where.revokedAt, null); assert.deepEqual(query.args.where.application, { clubId: h.scope.clubId }); assert.ok(query.args.where.OR.length <= 128); }
    const records = h.reads.filter(r => r.model === 'interviewRecord'); assert.equal(records.length, 1 + Math.ceil(count / 128));
    assert.ok(records.every(r => r.method === 'findMany')); assert.ok(records.every(r => !r.args.select.draft && !r.args.select.questions));
    assert.equal(h.reads.filter(r => r.model === 'clubMember').length, 3 + 2 * Math.ceil(count / 128));
  }
});
test('mixed privacy, retained completion, round changes, own applications, cancellation and empty slots preserve projections', async () => {
  const h = fixture(8), bookings = h.slots.map(s => s.bookings[0]), member = h.members[0];
  const record = n => ({ id: id(4000 + n), interviewerId: member.id, applicationId: bookings[n].applicationId, roundId: h.round.id, completedAt: new Date(), anonymousReview: false });
  h.state.records.push(record(1), { ...record(2), completedAt: null }, { ...record(3), anonymousReview: true });
  h.slots[0].room = { ...h.room, round: { ...h.round, anonymousReview: true } };
  bookings[1].application = { ...bookings[1].application, roundId: id(90) };
  bookings[2].application = { ...bookings[2].application, roundId: id(90) };
  bookings[4].application.studentId = member.userId;
  bookings[5].application.status = 'DRAFTING';
  h.slots[6].room = { ...h.room, isOpen: false };
  h.slots[7].bookings = [];
  const rows = await h.read(), byId = new Map(rows.map(r => [r.id, r]));
  for (const n of [0, 3]) { const row = byId.get(bookings[n].id); assert.equal(row.applicationId, n === 3 ? bookings[n].applicationId : null); assert.notEqual(row.candidate, 'Candidate ' + n); assert.deepEqual(row.interviewers, []); }
  assert.equal(byId.get(bookings[3].id).reviewId, id(4003)); // owner closing-review authority
  assert.equal(byId.get(bookings[1].id).canOpen, true); assert.equal(byId.get(bookings[1].id).completed, true);
  assert.equal(byId.get(bookings[2].id).canOpen, false); assert.equal(byId.get(bookings[2].id).started, true); assert.deepEqual(byId.get(bookings[2].id).interviewers, []);
  assert.ok(!byId.has(bookings[4].id) && !byId.has(bookings[5].id));
  assert.equal(byId.get(h.slots[6].id).cancelled, true); assert.equal(byId.get(h.slots[6].id).candidate, null);
  assert.equal(byId.get(h.slots[7].id).bookingId, null);
});
test('every later request rechecks grants, owner status, account status and panel-specific enabled colleagues', async () => {
  const h = fixture(2); h.slots[1].room = { ...h.room, panelMemberIds: [h.members[0].id, h.members[2].id], approvedPanelMemberIds: [h.members[0].id, h.members[2].id] };
  assert.deepEqual((await h.read()).map(r => r.interviewers.length), [2, 1]);
  h.members[1].user.disabledAt = new Date(); assert.deepEqual((await h.read()).map(r => r.interviewers.length), [1, 1]);
  h.assignments[0].revokedAt = new Date(); assert.equal((await h.read()).length, 1);
  h.members[0].isOwner = false; assert.deepEqual(await h.read(), []);
  h.members[0].isOwner = true; h.members[0].user.disabledAt = new Date(); await assert.rejects(h.read(), /unavailable/);
});
test('anonymous completed records require live closing-review authority and never disclose colleague names', async () => {
  const h = fixture(2), member = h.members[1]; h.as(11);
  for (const grant of h.assignments) grant.memberId = member.id;
  h.state.records.push({ id: id(4000), interviewerId: member.id, applicationId: h.slots[0].bookings[0].applicationId, roundId: h.round.id, completedAt: new Date(), anonymousReview: true });
  const rows = await h.read(), anonymous = rows.find(r => r.id === h.slots[0].bookings[0].id);
  assert.equal(anonymous.canOpen, false); assert.equal(anonymous.applicationId, null); assert.equal(anonymous.reviewId, undefined); assert.deepEqual(anonymous.interviewers, []); assert.notEqual(anonymous.candidate, 'Candidate 0');
  assert.equal(rows.find(r => r.id === h.slots[1].bookings[0].id).canOpen, true);
});
test('bulk published approval matches single-booking authority and never falls back to legacy approval', async () => {
  const h = fixture(1), { approvedBookingPanel, approvedBookingPanels } = h.load('utils/interview-collaboration.ts');
  const slot = h.slots[0], booking = slot.bookings[0], scope = { ...h.scope, applicationId: booking.applicationId };
  slot.panelScheduleVersionId = id(70); slot.publishedPanelMemberIds = [h.members[0].id];
  slot.panelScheduleVersion = { id: id(70), clubId: scope.clubId, roundId: scope.roundId, publishedBy: h.members[0].userId };
  h.tx.clubMember.findFirst = async ({ where }) => h.members.find(m => m.clubId === where.clubId && m.userId === where.userId && m.isOwner && m.status === 'ACTIVE' && !m.user.disabledAt);
  const compare = async () => { const payload = { ...booking, slot }, single = await approvedBookingPanel(h.tx, scope, payload), bulk = (await approvedBookingPanels(h.tx, [{ scope, booking: payload }])).get(booking.id) || null; assert.deepEqual(bulk, single); return single; };
  assert.deepEqual(await compare(), [h.members[0].id]);
  for (const change of [{ id: id(71) }, { clubId: id(71) }, { roundId: id(71) }, { publishedBy: h.members[1].userId }]) { const original = slot.panelScheduleVersion; slot.panelScheduleVersion = { ...original, ...change }; assert.equal(await compare(), null); slot.panelScheduleVersion = original; }
  slot.panelScheduleVersion = null; assert.equal(await compare(), null);
  slot.panelScheduleVersionId = null; assert.equal((await compare()).length, 3);
});
