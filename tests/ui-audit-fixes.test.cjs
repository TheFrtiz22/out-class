// UI/UX audit fixes (2026-11-12): shared helpers and copy that the browser audit found inconsistent.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { loadComponent } = require("./helpers/component-module.cjs")
const read = file => fs.readFileSync(file, "utf8")

test("P0-c: day keys render as long dates, never raw ISO beside Eastern Time", () => {
  const { formatLongDay } = loadComponent("lib/date-picker.ts")
  assert.equal(formatLongDay("2026-10-15"), "Thursday, October 15, 2026")
  assert.equal(formatLongDay("2026-01-01"), "Thursday, January 1, 2026")
  const preview = read("components/interviews/panel-preview-workspace.tsx")
  assert.match(preview, /\{formatLongDay\(day\)\} · \{SCHEDULING_TIMEZONE_LABEL\}/)
  assert.doesNotMatch(preview, /\{day\} · \{SCHEDULING_TIMEZONE_LABEL\}/)
  assert.doesNotMatch(preview, /covers \{dayKey\(/)
  assert.doesNotMatch(read("components/interviews/panel-publication-history.tsx"), /\{dayKey\(/)
})

test("item 4: a draft for a closed club is never promoted as work to finish", () => {
  const { applicationIntakeClosed } = loadComponent("lib/recruitment-presentation.ts")
  const now = Date.parse("2026-11-12T12:00:00Z")
  assert.equal(applicationIntakeClosed({ applicationOpen: false }, now), true)
  assert.equal(applicationIntakeClosed({ applicationOpen: true, applicationDeadline: "2026-11-11T12:00:00Z" }, now), true)
  assert.equal(applicationIntakeClosed({ applicationOpen: true, applicationDeadline: "2026-11-13T12:00:00Z" }, now), false)
  assert.equal(applicationIntakeClosed({ applicationOpen: true, applicationDeadline: null }, now), false)
  const { homeApplications, nextHomeAction } = loadComponent("lib/student-home.ts")
  const source = (id, club) => ({ id, clubId: id, status: "DRAFTING", club: { name: id, ...club } })
  const apps = homeApplications([source("closed", { applicationOpen: false }), source("open", { applicationOpen: true })], [], [])
  assert.deepEqual(apps.map(a => [a.id, a.intakeClosed]).sort(), [["closed", true], ["open", false]])
  const next = nextHomeAction(apps, [], new Date(now))
  assert.equal(next.application.id, "open")
  assert.equal(nextHomeAction(apps.filter(a => a.id === "closed"), [], new Date(now)).kind, "explore")
  // Home's Needs-you card and the management card use the same predicate.
  assert.match(read("components/views/student-dashboard-view.tsx"), /const drafts = applications\.filter\(app => app\.draft && !app\.intakeClosed/)
  assert.match(read("components/applications/application-management-card.tsx"), /const closed = applicationIntakeClosed\(/)
})

test("items 3 and 8: count labels name what they count, with the shared pluralize", () => {
  const model = loadComponent("components/club-home/club-home-model.ts")
  assert.equal(model.recruitingStripText({ applicants: 1, attention: 2 }), "1 applicant · 2 recruiting items need you")
  assert.equal(model.recruitingStripText({ applicants: 3, attention: 1 }), "3 applicants · 1 recruiting item needs you")
  assert.equal(model.recruitingStripText({ applicants: 3, attention: 0 }), "3 applicants")
  const { pluralize } = loadComponent("lib/copy/terms.ts")
  const stages = model.pipeline([{ status: "SUBMITTED", count: 1 }, { status: "INTERVIEWING", count: 1 }, { status: "ACCEPTED", count: 1 }]).stages
  assert.deepEqual(stages.slice(1).map(stage => pluralize(stage.count, ...stage.noun)), ["1 in review", "1 interview", "1 offer"])
  assert.doesNotMatch(read("components/recruiting-overview.tsx"), /stage\.label\.toLowerCase\(\)/)
})

test("items 5 and 6: open slots are not candidates; the palette counts every row it shows", () => {
  const list = read("components/interviews/interview-rooms-list.tsx")
  assert.match(list, /<span className="oc-dt-muted">Open slot<\/span>/)
  assert.doesNotMatch(list, /cell: row => <span className="oc-dt-name"[^>]*>\{row\.candidate \|\| row\.roomName\}/)
  assert.match(read("components/shell/navigation-search.tsx"), /pluralize\(pages\.length \+ linkPages\.length \+ results\.length, "result"\)/)
})
