// Ending a voting session: the confirmation names only the groups left unresolved, so a fully decided
// session doesn't read "0 Hold and 0 Unreviewed applicants will remain unresolved".
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/voting-room-harness.cjs');
const {endVotingDescription}=load('lib/voting-room.ts');

test('End voting copy names only non-empty unresolved groups', () => {
  assert.equal(endVotingDescription(0,0),'Every applicant has an outcome. No messages will be sent.');
  assert.equal(endVotingDescription(1,0),'1 held applicant will stay unresolved. No messages will be sent.');
  assert.equal(endVotingDescription(0,3),'3 unreviewed applicants will stay unresolved. No messages will be sent.');
  assert.equal(endVotingDescription(2,1),'2 held and 1 unreviewed applicants will stay unresolved. No messages will be sent.');
});

test('the leader confirmation uses the shared copy', () => {
  const src=require('node:fs').readFileSync('components/live-voting/room-meeting.tsx','utf8');
  assert.match(src,/description:endVotingDescription\(counts\("HOLD"\),counts\("UNREVIEWED"\)\)/);
  assert.doesNotMatch(src,/will remain unresolved/);
});
