// Two simultaneous claim requests by one student for an unmanaged club on isolated
// native PostgreSQL, through the real requestClubClaim (club row FOR UPDATE, then a
// pending-claim lookup). ClubClaim has no unique index, so the club row lock is what
// prevents a duplicate. Run: node scripts/run-disposable-postgres.cjs security
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { databaseUrl, raceFixture } = require('./helpers/race-native.cjs');

test('two simultaneous claims by one student create one pending claim', { skip: !databaseUrl, timeout: 120000 }, async t => {
  const { operator, load, race, user, club } = await raceFixture(t);
  const workspace = load('actions/club-workspace.ts');
  const c = await club();
  const student = await user('claimant');
  const explanation = 'I am the current president of this organization.';

  const results = await race([student, () => workspace.requestClubClaim(c.id, explanation)], [student, () => workspace.requestClubClaim(c.id, explanation)]);
  // The second request is a no-op that returns the claim the first one created.
  assert.ok(results.every(r => r.ok), JSON.stringify(results));
  assert.equal(results[0].value.id, results[1].value.id);
  assert.equal(await operator.clubClaim.count({ where: { clubId: c.id, userId: student.id, status: 'PENDING' } }), 1);
  assert.equal(await operator.auditLog.count({ where: { clubId: c.id, action: 'club.claim.request' } }), 1);
});
