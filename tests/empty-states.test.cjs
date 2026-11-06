const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs"), ts = require("typescript")
const mod = { exports: {} }
new Function("module", "exports", ts.transpileModule(fs.readFileSync("lib/empty-states.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(mod, mod.exports)
const { eventBoardEmptyState, directoryEmptyState, personalTasksEmptyState, meetingListEmptyState, memberDirectoryEmptyState } = mod.exports
const none = { query: "", period: "All", category: "", clubId: "", date: "", location: "", required: false, savedOnly: false }

test("Corkboard offers Show all events only when a search, filter, period, or saved view narrows it", () => {
  const empty = eventBoardEmptyState(none, true)
  assert.equal(empty.title, "No upcoming events yet.")
  assert.equal(empty.action, null)
  for (const narrowed of [{ query: "jazz" }, { period: "This week" }, { category: "Sports" }, { clubId: "c" }, { date: "2030-01-01" }, { location: "Rotunda" }, { required: true }, { savedOnly: true }])
    assert.equal(eventBoardEmptyState({ ...none, ...narrowed }, true).action, "show-all", JSON.stringify(narrowed))
  assert.equal(eventBoardEmptyState({ ...none, query: "jazz" }, true).title, "No events match your search.")
  assert.equal(eventBoardEmptyState({ ...none, query: "jazz", category: "Sports" }, true).title, "No events match your filters.")
  assert.equal(eventBoardEmptyState({ ...none, savedOnly: true }, true).title, "No saved events here yet.")
  // A signed-out visitor's stale saved flag is not a filter the board applies.
  assert.equal(eventBoardEmptyState({ ...none, savedOnly: true }, false).action, null)
})

test("Explore clears filters only when clubs exist outside the active search", () => {
  assert.deepEqual([directoryEmptyState(0, 2).title, directoryEmptyState(0, 2).action], ["No clubs available yet.", null])
  assert.equal(directoryEmptyState(12, 1).action, "clear")
  assert.equal(directoryEmptyState(12, 0).action, null)
})

test("personal tasks distinguish nothing assigned, filtered-empty, and caught up", () => {
  assert.deepEqual(personalTasksEmptyState({ assigned: 0, query: "x", filter: "due" }), { title: "No tasks assigned yet.", description: "When a club leader assigns you work, it will appear here.", action: null })
  assert.equal(personalTasksEmptyState({ assigned: 3, query: "x", filter: "open" }).action, "clear")
  assert.equal(personalTasksEmptyState({ assigned: 3, query: "", filter: "submitted" }).action, "clear")
  assert.equal(personalTasksEmptyState({ assigned: 3, query: "x", filter: "all" }).action, "clear-search")
  assert.equal(personalTasksEmptyState({ assigned: 3, query: "", filter: "open" }).action, "view-all")
})

test("meeting lists only offer another audience or period when it has meetings", () => {
  assert.equal(meetingListEmptyState({ period: "upcoming", audience: "MEMBERS", inPeriod: 2, otherPeriod: 0 }).action, "all-audiences")
  assert.deepEqual(meetingListEmptyState({ period: "upcoming", audience: "ALL", inPeriod: 0, otherPeriod: 0 }).action, null)
  assert.equal(meetingListEmptyState({ period: "upcoming", audience: "ALL", inPeriod: 0, otherPeriod: 4 }).action, "other-period")
  assert.equal(meetingListEmptyState({ period: "past", audience: "MEMBERS", inPeriod: 0, otherPeriod: 1 }).action, "other-period")
  assert.equal(meetingListEmptyState({ period: "past", audience: "ALL", inPeriod: 0, otherPeriod: 0 }).title, "No past meetings")
})

test("member and invitation lists say what is missing and clear only active filters", () => {
  assert.deepEqual(memberDirectoryEmptyState({ invitations: true, history: false, filtered: false }), { title: "No pending invitations.", description: "", action: null })
  assert.equal(memberDirectoryEmptyState({ invitations: true, history: true, filtered: false }).title, "No invitations have been sent yet.")
  assert.deepEqual([memberDirectoryEmptyState({ invitations: false, history: false, filtered: true }).title, memberDirectoryEmptyState({ invitations: false, history: false, filtered: true }).action], ["No members match these filters.", "clear"])
})
