// Two simultaneous accepts of one legacy email invitation on isolated native
// PostgreSQL, through the real acceptClubInvitation (clubWriteTransaction, club row
// FOR UPDATE, invitation re-read after the lock). Run: node scripts/run-disposable-postgres.cjs security
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { databaseUrl, raceFixture } = require('./helpers/race-native.cjs');

test('two simultaneous accepts of one invitation create one membership', { skip: !databaseUrl, timeout: 120000 }, async t => {
  const { operator, load, race, user, club } = await raceFixture(t);
  const access = load('actions/club-access.ts');
  const c = await club();
  const owner = await user('owner'), invitee = await user('invitee');
  await operator.clubMember.create({ data: { clubId: c.id, userId: owner.id, isOwner: true } });
  const invitation = await operator.clubInvitation.create({ data: { clubId: c.id, email: invitee.email, invitedBy: owner.id, permissions: ['meetings.manage'], expiresAt: new Date(Date.now() + 86400000) } });

  const results = await race([invitee, () => access.acceptClubInvitation(invitation.id)], [invitee, () => access.acceptClubInvitation(invitation.id)]);
  assert.equal(results.filter(r => r.ok).length, 1, JSON.stringify(results));
  assert.deepEqual(results.find(r => r.ok).value, { clubId: c.id });
  assert.match(results.find(r => !r.ok).error, /unavailable or expired/);

  const members = await operator.clubMember.findMany({ where: { clubId: c.id, userId: invitee.id } });
  assert.equal(members.length, 1);
  assert.deepEqual(members[0].permissions, ['meetings.manage']);
  const stored = await operator.clubInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
  assert.equal(stored.status, 'ACCEPTED'); assert.equal(stored.claimedUserId, invitee.id);
  assert.equal(await operator.auditLog.count({ where: { targetId: invitation.id, action: 'club.invite.accept' } }), 1);
});
