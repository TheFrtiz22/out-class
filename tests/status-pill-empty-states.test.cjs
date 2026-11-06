// StatusPill, empty-state rules, the review-gated score label, interview day spans and date math.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { loadComponent } = require("./helpers/component-module.cjs")
const read = file => fs.readFileSync(file, "utf8")

test("StatusPill: one pill per application state, token colors only, stored codes and legacy labels", () => {
  const React = require("react"), { renderToStaticMarkup } = require("react-dom/server")
  const { StatusPill } = loadComponent("components/ui/status-pill.tsx")
  const html = status => renderToStaticMarkup(React.createElement(StatusPill, { status }))
  const expected = { DRAFTING: "Draft", SUBMITTED: "Submitted", IN_REVIEW: "In review", INTERVIEWING: "Interview", ACCEPTED: "Accepted", REJECTED: "Not selected", WAITLISTED: "Waitlisted" }
  for (const [code, label] of Object.entries(expected)) assert.equal(html(code), `<span data-slot="status-pill" data-status="${code}" class="oc-status-pill">${label}</span>`)
  // Legacy display strings from Home and the tracker map to the same pill.
  for (const [legacy, code] of [["In Review", "IN_REVIEW"], ["Interviewing", "INTERVIEWING"], ["Rejected", "REJECTED"], ["Drafting", "DRAFTING"]]) assert.match(html(legacy), new RegExp(`data-status="${code}"`), legacy)
  const css = read("styles/interface-primitives.css")
  for (const code of Object.keys(expected)) {
    const rule = css.match(new RegExp(`^\\.oc-status-pill\\[data-status="${code}"\\] \\{([^}]*)\\}`, "m"))
    assert.ok(rule, code); assert.doesNotMatch(rule[1], /#[0-9a-f]{3,8}\b|rgb\(/i, `${code} uses tokens`)
  }
})

test("Applications, Home and the leader Applicants table all show StatusPill; the thin left bar is gone", () => {
  for (const file of ["components/applications/application-management-card.tsx", "components/applications/application-status-card.tsx", "components/views/student-dashboard-view.tsx", "components/views/leader-dashboard/live-applicant-views.tsx"]) assert.match(read(file), /<StatusPill status=\{app\.status\}/, file)
  const leader = read("components/views/leader-dashboard/live-applicant-views.tsx")
  assert.equal((leader.match(/<StatusPill status=\{app\.status\}/g) || []).length, 4, "table, mobile list, board and decisions")
  assert.doesNotMatch(leader, /data-application-status|<Badge /)
  assert.ok(!fs.existsSync("components/status-badge.tsx"))
  const css = read("styles/product-components.css") + read("styles/product-workflows.css") + read("components/applications/application-tracker.css")
  assert.doesNotMatch(css, /data-status-code|data-application-status|oc-application-row\[data-status|oc-status-card\[data-status/)
})

test("leader scores hidden before your own review show a lock and a short label", () => {
  const leader = read("components/views/leader-dashboard/live-applicant-views.tsx")
  assert.doesNotMatch(leader, /Submit your own review to see round scores/)
  assert.match(leader, /<Lock aria-hidden="true" size=\{14\} \/>Hidden until you review/)
})

test("Corkboard empty state never offers 'show all' when everything is already shown", () => {
  const { eventBoardEmpty } = loadComponent("lib/event-board-empty.ts")
  const base = { query: "", period: "All", category: "", clubId: "", date: "", location: "", required: false, savedOnly: false }
  assert.equal(eventBoardEmpty(base).action.kind, "explore-clubs", "nothing filtered: go find clubs, not 'show all'")
  assert.equal(eventBoardEmpty({ ...base, savedOnly: true }).action.kind, "show-all-events")
  assert.equal(eventBoardEmpty({ ...base, period: "Today" }).action.kind, "clear-filters")
  assert.equal(eventBoardEmpty({ ...base, query: "jazz" }).title, "No events match “jazz”.")
  assert.equal(eventBoardEmpty({ ...base, savedOnly: true, category: "Arts" }).action.kind, "clear-filters")
  assert.doesNotMatch(read("components/events/public-event-board.tsx"), />\s*Show all events\s*</)
})

test("empty states say why and offer one different next step", () => {
  const cases = [
    ["components/views/student-dashboard-view.tsx", /onNavigate\("explore"\)\}>Explore clubs/],
    ["components/views/student-dashboard-view.tsx", /onNavigate\("corkboard"\)\}>Browse events/],
    ["components/views/application-tracker-view.tsx", /onClick=\{\(\) => setFilter\("All"\)\}>Show all applications/],
    ["components/views/explore-view.tsx", /onNavigate\("corkboard"\)\}>See campus events/],
    ["components/views/calendar-view.tsx", /function CalendarEmptyAction/],
    ["components/views/inbox-view.tsx", /setTab\("preferences"\)\}>Email preferences/],
    ["components/meeting-workspace.tsx", /See past meetings/],
    ["components/interviews/interview-rooms-list.tsx", />Show all dates</],
    ["components/shell/notification-center.tsx", /Show all updates/],
    ["components/views/leader-dashboard/live-leader-workspace.tsx", /onClick=\{clearApplicantFilters\}>Clear filters/],
    ["components/recruiting-overview.tsx", /Show all rounds/],
    ["components/club-members.tsx", /Clear search/],
    ["components/admin/admin-directory.tsx", /Clear search and filter/],
  ]
  for (const [file, rule] of cases) assert.match(read(file), rule, file)
  // The calendar only offers to clear filters when something is filtered.
  assert.match(read("components/views/calendar-view.tsx"), /return filtered\s*\? <Button[^\n]*?onClick=\{onClear\}>Clear filters<\/Button>\s*: onNavigate \? <Button[^\n]*?onNavigate\("corkboard"\)/)
})

test("interview day rows show the first and last slot time", () => {
  const harness = require("./helpers/interview-harness.cjs").harness()
  const dates = harness.load("lib/interview-room-dates.ts")
  const row = (id, startTime) => ({ id, startTime, endTime: startTime, timezone: "America/New_York", roundId: "r" })
  const [day] = dates.groupInterviewDates([row("b", "2026-11-10T21:30:00Z"), row("a", "2026-11-10T14:00:00Z"), row("c", "2026-11-10T17:00:00Z")])
  assert.equal(day.span, "First 9:00 AM · last 4:30 PM EST")
  assert.equal(dates.interviewDaySpan([row("a", "2026-11-10T14:00:00Z")], "America/New_York"), "9:00 AM EST")
  assert.match(read("components/interviews/interview-rooms-list.tsx"), /\{span && <span className="oc-interview-day-span">\{span\}<\/span>\}/)
  assert.doesNotMatch(read("components/interviews/interview-rooms-list.tsx"), /type="date"/)
  assert.match(read("components/interviews/interview-rooms-list.tsx"), /<DatePicker label="Filter assigned interview date"/)
})

test("date picker math works on plain days, independent of the browser time zone", () => {
  const d = loadComponent("lib/date-picker.ts")
  assert.equal(d.addDays("2026-03-08", 1), "2026-03-09", "DST does not skip or repeat days")
  assert.equal(d.addMonths("2026-01-31", 1), "2026-02-28"); assert.equal(d.addMonths("2024-01-31", 1), "2024-02-29")
  const grid = d.monthGrid("2026-11-15")
  assert.equal(grid.length, 6); assert.equal(grid[0][0], "2026-11-01"); assert.ok(grid.every(week => week.length === 7))
  assert.equal(d.moveDay("2026-11-15", "ArrowDown"), "2026-11-22"); assert.equal(d.moveDay("2026-11-15", "Home"), "2026-11-15"); assert.equal(d.moveDay("2026-11-18", "End"), "2026-11-21")
  assert.equal(d.moveDay("2026-11-15", "PageUp"), "2026-10-15"); assert.equal(d.moveDay("2026-11-15", "PageDown", true), "2027-11-15"); assert.equal(d.moveDay("2026-11-15", "a"), null)
  assert.equal(d.todayIn("America/New_York", new Date("2026-11-07T03:00:00Z")), "2026-11-06", "Eastern day, not UTC")
  assert.equal(d.isIsoDay("2026-02-30"), false); assert.equal(d.isIsoDay("2026-02-28"), true)
})
