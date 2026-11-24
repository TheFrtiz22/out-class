// Live voting polls stay cheap at scale: a 400-applicant, 30-voter room holds 12,000 ballots.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const room = fs.readFileSync('utils/voting-room.ts', 'utf8'), tracker = fs.readFileSync('actions/voting-target-summary.ts', 'utf8')
test('the room read loads ballots in one flat query, not as a nested include', () => {
  assert.match(room, /tx\.votingBallot\.findMany\(\{ where: \{ sessionId: room\.id \}/)
  assert.match(room, /votingSession\.findFirst\(\{ where: \{ id: sessionId, clubId, mode: "LIVE" \}, include: roomOutcomeInclude \}\)/)
  assert.doesNotMatch(room.match(/export const roomOutcomeInclude = .*/)[0], /ballots/)
})
test('the round tracker counts confirmed outcomes without reading any ballot', () => {
  assert.match(tracker, /include: roomOutcomeInclude/)
  assert.doesNotMatch(tracker, /roomInclude\b/)
})
test('ballots carry only the fields every projection, rule and tally reads', () => {
  assert.match(room, /roomBallotSelect = \{ memberId: true, decision: true, revision: true \}/)
})
