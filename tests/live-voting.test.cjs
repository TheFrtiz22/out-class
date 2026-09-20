const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const Module = require("node:module")
const path = require("node:path")
const filename = path.resolve(__dirname, "../lib/live-voting.ts")
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const model = new Module(filename, module)
model._compile(compiled, filename)
const { votingReducer, applicantTally, votingProgress, validateVotingSetup, joinError, connectedParticipants } = model.exports

function session(memberCount = 3) {
  return { id: "test", pin: "123456", clubId: "vvf", eligibleMembers: ["one", "two", "three"].map(id => ({ id, email: `${id}@virginia.edu`, name: id, initials: id[0] })), participants: [], applicants: ["a", "b", "c"].map(id => ({ id, name: id })), quota: { min: 1, max: 2 }, memberCount, activeIndex: 0, slideRevision: 0, revision: 0, status: "live", votes: {}, memberIds: ["one", "two", "three"].slice(0, memberCount) }
}
function vote(state, memberId, choice = "pass", overrides = {}) {
  return votingReducer(state, { type: "vote", applicantId: state.applicants[state.activeIndex].id, slideRevision: state.slideRevision, memberId, choice, ...overrides })
}
test("majority uses the configured electorate, not only received votes", () => {
  let state = vote(session(), "one")
  assert.equal(applicantTally(state, "a").result, "pending")
  assert.equal(votingProgress(state).passed, 0)
  state = vote(state, "two")
  assert.equal(applicantTally(state, "a").result, "passed")
  assert.deepEqual(votingProgress(state), { passed: 1, noPass: 0, remaining: 2, percent: 50, range: "within" })
})
test("a tie stays unresolved and No Pass removes an applicant from the remaining pool", () => {
  const tied = vote(vote(session(2), "one"), "two", "no-pass")
  assert.equal(applicantTally(tied, "a").result, "tied")
  assert.equal(votingProgress(tied).remaining, 3)
  const rejected = vote(vote(session(), "one", "no-pass"), "two", "no-pass")
  assert.equal(votingProgress(rejected).noPass, 1)
  assert.equal(votingProgress(rejected).remaining, 2)
})
test("duplicate votes, stale slides, capacity, and ended sessions are rejected", () => {
  const first = vote(session(1), "one")
  assert.equal(vote(first, "one", "no-pass"), first)
  assert.equal(vote(first, "two"), first)
  const next = votingReducer(first, { type: "navigate", index: 1 })
  assert.equal(vote(next, "one", "pass", { applicantId: "a", slideRevision: 0 }), next)
  const back = votingReducer(next, { type: "navigate", index: 0 })
  assert.equal(vote(back, "one", "no-pass"), back)
  assert.equal(vote(back, "one", "pass", { slideRevision: 0 }), back)
  const ended = votingReducer(next, { type: "end" })
  assert.equal(vote(ended, "one"), ended)
  assert.equal(votingReducer(ended, { type: "navigate", index: 2 }), ended)
})
test("simultaneous members accumulate and an over-quota count keeps the bar bounded", () => {
  let state = session(3)
  for (let index = 0; index < 3; index++) {
    state = votingReducer(state, { type: "navigate", index })
    state = vote(vote(vote(state, "one"), "two"), "three", "no-pass")
    assert.equal(applicantTally(state, state.applicants[index].id).total, 3)
  }
  assert.deepEqual(votingProgress(state), { passed: 3, noPass: 0, remaining: 0, percent: 100, range: "above" })
})
test("validates quotas, member counts, empty pools, and navigation bounds", () => {
  assert.equal(validateVotingSetup(35, 15, 20, 5), null)
  for (const args of [[0,1,1,1], [3,2,1,1], [3,1,4,1], [3,0,1,1], [3,1,2,0], [3,1.2,2,1], [3,1,2,501]]) assert.ok(validateVotingSetup(...args))
  const state = session()
  for (const index of [-1, 3, 0, 0.5]) assert.equal(votingReducer(state, { type: "navigate", index }), state)
})

function lobby() { return { ...session(2), status: "lobby", participants: [], memberIds: [] } }
function join(state, email = "one@virginia.edu", extra = {}) {
  return votingReducer(state, { type: "join", email, pin: "123456", connectionId: "tab-one", now: 100, ...extra })
}
test("lobby rejects votes and cannot begin until a connected member joins", () => {
  const empty = lobby()
  assert.equal(vote(empty, "one"), empty)
  assert.equal(votingReducer(empty, { type: "begin", now: 100 }), empty)
  const joined = join(empty)
  assert.equal(joined.participants.length, 1)
  assert.equal(votingReducer(joined, { type: "begin", now: 101 }).status, "live")
  assert.equal(votingReducer(joined, { type: "begin", now: 20000 }), joined)
})
test("joins enforce PIN, membership, capacity, and ended status", () => {
  const empty = lobby()
  assert.equal(join(empty, "one@virginia.edu", { pin: "000000" }), empty)
  assert.equal(join(empty, "stranger@virginia.edu"), empty)
  assert.equal(join(empty, "one@virginia.edu", { pin: "", demoVerifiedClubId: "other" }), empty)
  assert.equal(join(empty, "one@virginia.edu", { pin: "", demoVerifiedClubId: "vvf" }).participants.length, 1)
  const full = join(join(empty), "two@virginia.edu", { connectionId: "tab-two" })
  assert.equal(join(full, "three@virginia.edu"), full)
  const ended = votingReducer(full, { type: "end" })
  assert.equal(join(ended), ended)
})
test("duplicate joins and tabs share identity, presence expires and reconnects", () => {
  let state = join(join(lobby()), " ONE@virginia.edu ", { connectionId: "tab-two", now: 200 })
  assert.equal(state.participants.length, 1)
  assert.equal(state.memberIds.length, 1)
  assert.equal(connectedParticipants(state, 200).length, 1)
  state = votingReducer(state, { type: "leave", memberId: "one", connectionId: "tab-one" })
  assert.equal(connectedParticipants(state, 200).length, 1)
  state = votingReducer(state, { type: "expire", now: 10200 })
  assert.equal(connectedParticipants(state, 10200).length, 0)
  state = votingReducer(state, { type: "presence", memberId: "one", connectionId: "tab-two", now: 10300 })
  assert.equal(connectedParticipants(state, 10300).length, 1)
  assert.equal(state.memberIds.length, 1)
})
