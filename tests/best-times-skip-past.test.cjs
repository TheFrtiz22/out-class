const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { loadComponent } = require("./helpers/component-module.cjs")
const planner = loadComponent("lib/meeting-time-planner.ts")

// Wednesday Nov 25 2026, 1:00 PM Eastern (18:00 UTC), in the week of Monday Nov 23.
const now = Date.parse("2026-11-25T18:00:00Z")
const grid = () => Array.from({ length: 7 }, () => Array(96).fill(0))

test("the earliest start is now for this week, nothing for a future week", () => {
  assert.deepEqual(planner.plannerEarliestStart("2026-11-23", now), { day: 2, minute: 780 })
  assert.equal(planner.plannerEarliestStart("2026-11-30", now), null)
  assert.deepEqual(planner.plannerEarliestStart("2026-11-16", now), { day: 7, minute: 0 })
})

test("best times never suggest a start that has already passed", () => {
  const free = grid()
  free[0][41] = 1 // Mon 10:15 AM (past)
  free[2][48] = 1 // Wed 12:00 PM (past, today)
  free[2][56] = 1 // Wed 2:00 PM (ahead)
  free[3][40] = 1 // Thu 10:00 AM (ahead)
  const best = planner.bestMeetingTimes(free, 60, 3, planner.plannerEarliestStart("2026-11-23", now))
  assert.deepEqual(best.map(t => `${t.day}:${t.slot}`), ["2:56", "3:40"])
  // A future week (earliest null) keeps every start, as before.
  assert.equal(planner.bestMeetingTimes(free, 60).length, 3)
})

test("the planner re-checks Best times every minute while it stays open", () => {
  const src = fs.readFileSync(path.join(__dirname, "../components/availability/meeting-time-planner.tsx"), "utf8")
  assert.match(src, /const now = useServerAnchoredNow\(\)/)
  assert.doesNotMatch(src, /setInterval/)
  assert.match(src, /plannerEarliestStart\(current\.week, now\)\) : \[\], \[current, now\]\)/)
})
