// Club workspace navigation reorganization (ui/nav-reorg): rail items and order, distinct icons, Decide, Calendar,
// Recruiting settings drawer, mobile bar and More, and every old URL landing on its new home.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

function load(file) {
  const resolved = [file, `${file}.ts`, `${file}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(resolved, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function("require", "module", "exports", code)(name => name.startsWith("@/components/icons") ? new Proxy({}, { get: (_, key) => key }) : name.startsWith("@/") ? load(path.join(name.slice(2))) : require(name), mod, mod.exports)
  return mod.exports
}
const nav = load("lib/navigation.ts")
const routes = load("lib/workspace-routes.ts")
const decide = load("lib/decide.ts")
const product = load("lib/product-navigation.ts")
const home = load("components/club-home/club-home-model.ts")
const club = "club"
const owner = { isOwner: true }
const labels = sections => sections.map(section => [section.label ?? section.name, section.items.map(item => item.label)])

test("rail: Recruiting (Overview, Applicants, Interviews, Decide), Club (Home, Calendar, Tasks, Members), Settings pinned", () => {
  const sections = nav.leaderRailSections(owner, club)
  assert.deepEqual(labels(sections), [
    ["Recruiting", ["Overview", "Applicants", "Interviews", "Decide"]],
    ["Club", ["Home", "Calendar", "Tasks", "Members"]],
    ["Settings", ["Settings"]],
  ])
  assert.equal(sections.at(-1).pinned, true)
  assert.equal(nav.railItems(sections).length, 9)
  // No flyouts, no drawer items, no Announcements, no separate Meetings/Events in the rail.
  for (const id of ["rounds", "rules", "announcements", "meetings", "events", "scheduled-decisions", "resumes", "reviews"])
    assert.ok(!nav.railItems(sections).some(item => item.id === id), id)
  assert.ok(nav.railItems(sections).every(item => item.href && !("navGroup" in item) && !("quiet" in item)))
})

test("each rail item has its own icon: Overview ≠ Home, Applicants ≠ Members, one calendar", () => {
  const source = fs.readFileSync("components/shell/product-shell.tsx", "utf8")
  const map = Object.fromEntries([...source.matchAll(/(?:"([a-z-]+)"|\b([a-z]+)): (\w+)/g)].map(m => [m[1] ?? m[2], m[3]]))
  const ids = ["overview", "applicants", "interviews", "decisions", "club-home", "calendar", "tasks", "members", "settings"]
  const icons = ids.map(id => map[id])
  assert.equal(new Set(icons).size, ids.length, JSON.stringify(Object.fromEntries(ids.map((id, i) => [id, icons[i]]))))
  const phone = fs.readFileSync("components/shell/mobile-navigation.tsx", "utf8")
  assert.match(phone, /overview: Gauge/); assert.match(phone, /applicants: IdCard/); assert.match(phone, /decisions: Gavel/)
})

test("the rail renders plain links: no RailGroup flyout remains", () => {
  const rail = fs.readFileSync("components/shell/navigation-rail.tsx", "utf8")
  assert.doesNotMatch(rail, /RailGroup|Popover|navGroup/)
  assert.match(rail, /data-pinned=\{section\.pinned \|\| undefined\}/)
  // The #225 tooltip fix is kept.
  assert.match(rail, /document\.addEventListener\("pointermove", away, true\)/)
})

test("permissions are unchanged: Decide, Members, Settings and the drawer gates", () => {
  const reviewer = { permissions: ["applications.review"] }
  assert.ok(!product.managerNavigation(reviewer, club, "recruiting").some(item => item.id === "decisions"))
  assert.ok(product.managerNavigation({ permissions: ["applications.review", "decisions.vote"] }, club, "recruiting").some(item => item.id === "decisions"))
  assert.ok(product.managerNavigation({ permissions: ["recruitment.manage"] }, club, "recruiting").some(item => item.id === "decisions"))
  assert.deepEqual(product.decideAccess({ permissions: ["applications.review", "decisions.vote"] }), { canVote: true, canLetters: false, canScheduled: false, canSend: false })
  assert.deepEqual(product.decideAccess({ permissions: ["decisions.publish", "applicants.identify"] }), { canVote: false, canLetters: false, canScheduled: true, canSend: true })
  assert.ok(!product.managerNavigation({ permissions: ["meetings.manage"] }, club, "club").some(item => item.id === "members"))
  const settings = load("lib/recruiting-settings.ts")
  assert.equal(settings.canOpenRecruitingSettings({ permissions: ["applications.review"] }), false)
  assert.equal(settings.canOpenRecruitingSettings({ permissions: ["recruitment.manage"] }), true)
})

test("phone bar: Home · Recruiting · Calendar · Members, then More lists the rest in rail order", () => {
  const sections = nav.leaderRailSections(owner, club)
  const bar = nav.bottomBarItems(sections, "leader", "applicants")
  assert.deepEqual(bar.map(item => item.label), ["Home", "Recruiting", "Calendar", "Members"])
  assert.ok(bar[1].matches.includes("decisions") && bar[1].matches.includes("resumes"))
  assert.deepEqual(labels(nav.moreSections(sections, bar)), [
    ["Recruiting", ["Overview", "Applicants", "Interviews", "Decide"]],
    ["Club", ["Tasks"]],
    ["Settings", ["Settings"]],
  ])
  // Without Members access the bar falls back to the next club page.
  const meetingsOnly = nav.leaderRailSections({ permissions: ["meetings.manage"] }, club)
  assert.deepEqual(nav.bottomBarItems(meetingsOnly, "leader", "club-home").map(item => item.label), ["Home", "Calendar", "Tasks"])
})

test("the URL decides the highlighted item, including pages without a rail entry", () => {
  const at = query => nav.activeNavItem("/club/c/workspace", new URLSearchParams(query))
  assert.equal(at("section=recruitment&tool=applicants&recruitingSettings=rules"), "applicants")
  assert.equal(at("section=recruitment&tool=resumes"), "applicants")
  assert.equal(at("section=recruitment&tool=decisions&decisionTab=letters"), "decisions")
  assert.equal(at("section=recruitment&tool=scheduled-decisions"), "decisions")
  assert.equal(at("section=calendar&type=events"), "calendar")
  assert.equal(at("section=overview&focus=announcements"), "club-home")
  assert.equal(nav.activeNavItem("/club/c/workspace", new URLSearchParams("section=calendar&type=meetings"), { member: true }), "club-meetings")
})

test("every old URL maps to its new home (server redirect and client replace share this)", () => {
  const canonical = query => { const q = routes.canonicalClubWorkspaceQuery(new URLSearchParams(query)); return q && Object.fromEntries(q) }
  assert.deepEqual(canonical("section=recruitment&tool=decisions&decisionTab=voting"), null)
  assert.deepEqual(canonical("section=recruitment&tool=decisions&decisionTab=letters"), null)
  assert.deepEqual(canonical("section=recruitment&tool=decisions&decisionTab=send"), { section: "recruitment", tool: "decisions", decisionTab: "letters" })
  assert.deepEqual(canonical("section=recruitment&tool=voting&roundId=r"), { section: "recruitment", tool: "decisions", decisionTab: "voting", roundId: "r" })
  assert.deepEqual(canonical("section=recruitment&tool=scheduled-decisions"), { section: "recruitment", tool: "decisions", decisionTab: "letters" })
  assert.deepEqual(canonical("section=recruitment&tool=rounds"), { section: "recruitment", tool: "applicants", recruitingSettings: "anonymous" })
  assert.deepEqual(canonical("section=recruitment&tool=rules"), { section: "recruitment", tool: "applicants", recruitingSettings: "rules" })
  assert.deepEqual(canonical("section=meetings"), { section: "calendar", type: "meetings" })
  assert.deepEqual(canonical("section=meetings&new=1"), { section: "calendar", new: "1", type: "meetings" })
  assert.deepEqual(canonical("section=meetings&meetingTab=events"), { section: "calendar", type: "events" })
  assert.deepEqual(canonical("section=events"), { section: "calendar", type: "events" })
  assert.deepEqual(canonical("section=announcements&mode=recruiting&compose=1"), { section: "overview", compose: "1", focus: "announcements" })
  // section=overview is already Home.
  assert.equal(canonical("section=overview"), null)
  assert.equal(routes.clubWorkspaceTitle(new URLSearchParams("section=recruitment&tool=decisions&decisionTab=letters")), "Decide")
  assert.equal(routes.clubWorkspaceTitle(new URLSearchParams("section=calendar")), "Calendar")
  assert.equal(routes.clubWorkspaceTitle(new URLSearchParams("section=overview")), "Home")
})

test("Decide: tab choice respects access; counts are per round", () => {
  assert.equal(decide.decideTab("letters", { canVote: true, canSend: false }), "voting")
  assert.equal(decide.decideTab(null, { canVote: false, canSend: true }), "letters")
  assert.equal(decide.decideTab("voting", { canVote: false, canSend: false }), null)
  const rooms = [
    { roundId: "a", roundName: "A", state: "OPEN", applicantCount: 9 },
    { roundId: "a", roundName: "A", state: "DRAFT", applicantCount: 3 },
    { roundId: "b", roundName: "B", state: "COMPLETED", publishedAt: null, applicantCount: 6 },
    { roundId: "b", roundName: "B", state: "COMPLETED", publishedAt: "2026-11-01T00:00:00Z", applicantCount: 4 },
  ]
  assert.deepEqual(decide.decideCounts(rooms), { voting: 2, letters: 6 })
  // Closed board sessions are read-only history, so they never count as waiting to be sent.
  const closedBoard = { roundId: "b", roundName: "B", state: "COMPLETED", mode: "LEGACY", publishedAt: null, applicantCount: 5 }
  assert.equal(decide.readyToSend(closedBoard), false)
  assert.deepEqual(decide.decideCounts([...rooms, closedBoard]), { voting: 2, letters: 6 })
  assert.deepEqual(decide.roundsFromRooms(rooms), [{ id: "a", name: "A" }, { id: "b", name: "B" }])
})

test("Overview review card opens Applicants on the busiest round with quick review", () => {
  const href = home.quickReviewHref("/club/c/workspace?section=recruitment&tool=applicants", [{ id: "r1", pending: 2 }, { id: "r2", pending: 5 }, { id: "r3", pending: 5 }])
  assert.equal(href, "/club/c/workspace?section=recruitment&tool=applicants&roundId=r2&quickReview=1")
  assert.match(fs.readFileSync("components/views/leader-dashboard/live-leader-workspace.tsx", "utf8"), />Start quick review<\/Button>/)
})

test("tutorial steps only point at rail items that still exist", () => {
  const { tutorialSteps } = load("lib/tutorials.ts")
  const ids = new Set(nav.railItems(nav.leaderRailSections(owner, club)).map(item => `nav-${item.id}`))
  for (const step of tutorialSteps.leader) {
    if (step.anchor.startsWith("nav-")) assert.ok(ids.has(step.anchor), step.anchor)
    else assert.ok(["mode-recruiting", "mode-club"].includes(step.anchor), step.anchor)
  }
})
