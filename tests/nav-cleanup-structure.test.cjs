// Structural rules from the navigation cleanup: one fixed phone bar, one name per destination.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

function load(file) {
  const resolved = [file, `${file}.ts`, `${file}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(resolved, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function("require", "module", "exports", code)(name => name.startsWith("@/components/icons") ? new Proxy({}, { get: () => "Icon" }) : name.startsWith("@/") ? load(path.join(name.slice(2))) : require(name), mod, mod.exports)
  return mod.exports
}
const nav = load("lib/navigation.ts")
const club = "club"

test("the club phone bar is one fixed set on every page: Home · Recruiting · Meetings · Members", () => {
  const owner = nav.leaderRailSections({ isOwner: true }, club)
  const bar = nav.bottomBarItems(owner, "leader", "applicants")
  assert.deepEqual(bar.map(item => item.label), ["Club home", "Recruiting", "Meetings", "Members"])
  for (const active of ["club-home", "applicants", "interviews", "decisions", "meetings", "tasks", "settings", "announcements"])
    assert.deepEqual(nav.bottomBarItems(owner, "leader", active).map(item => item.id), bar.map(item => item.id), active)
  const recruiting = bar.find(item => item.id === "recruiting")
  assert.match(recruiting.href, /section=recruitment&tool=overview/)
  for (const id of ["overview", "applicants", "interviews", "decisions"]) assert.ok(recruiting.matches.includes(id), id)
})

test("members without a destination get the next club page instead", () => {
  const reviewer = nav.leaderRailSections({ permissions: ["applications.review", "meetings.manage"] }, club)
  assert.deepEqual(nav.bottomBarItems(reviewer, "leader", "applicants").map(item => item.label), ["Club home", "Recruiting", "Meetings", "Tasks"])
  const meetingsOnly = nav.leaderRailSections({ permissions: ["meetings.manage"] }, club)
  assert.deepEqual(nav.bottomBarItems(meetingsOnly, "leader", "club-home").map(item => item.label), ["Club home", "Meetings", "Tasks", "Announcements"])
})

test("every phone bar link has an accessible name and the bar marks Recruiting active for its pages", () => {
  const source = fs.readFileSync("components/shell/mobile-navigation.tsx", "utf8")
  assert.match(source, /"aria-label": item\.label/)
  assert.match(source, /item\.matches\?\.includes\(active\)/)
  assert.match(source, /aria-label="More sections"/)
})

test("one SectionTabs look for Decisions, phone Recruiting tabs and Interviews", () => {
  assert.match(fs.readFileSync("components/live-voting/decisions-navigation.tsx", "utf8"), /<SectionTabs label="Decisions navigation"/)
  assert.match(fs.readFileSync("components/club-workspace.tsx", "utf8"), /<SectionTabs label="Recruiting sections"/)
  assert.match(fs.readFileSync("components/interview-management-tabs.tsx", "utf8"), /sectionTabsListClass/)
})

test("Settings is configuration only and Members has one Add members menu", () => {
  const settings = fs.readFileSync("components/club-settings-workspace.tsx", "utf8")
  assert.doesNotMatch(settings, /<Members clubId/)
  assert.match(settings, /Roles and permissions/)
  assert.match(fs.readFileSync("lib/club-settings.ts", "utf8"), /id: "general", label: "Public profile"/)
  const members = fs.readFileSync("components/organization-member-management.tsx", "utf8")
  assert.match(members, /aria-label="More ways to add members"/)
  assert.doesNotMatch(members, /trigger="Settings"|trigger="Import CSV"/)
})

test("Club home creates directly: New announcement opens the composer, New meeting the form", () => {
  const actions = fs.readFileSync("components/club-home/club-home-actions.tsx", "utf8")
  assert.match(actions, /announcements\}&compose=1/)
  assert.match(actions, /meetings\}&new=1/)
  assert.match(fs.readFileSync("components/club-announcements.tsx", "utf8"), /get\("compose"\)==="1"/)
  assert.match(fs.readFileSync("components/events/club-meetings-workspace.tsx", "utf8"), /openCreate=\{params\.get\("new"\) === "1"\}/)
})

test("⌘K offers every rail destination once and no removed page", () => {
  const shell = fs.readFileSync("components/shell/product-shell.tsx", "utf8")
  assert.match(shell, /links=\{\[\.\.\.railItems\(railSections\)\.filter\(item => item\.href\)/)
  assert.match(shell, /item\.id === "leader-dashboard"\) return false/)
  const search = fs.readFileSync("components/shell/navigation-search.tsx", "utf8")
  assert.match(search, /links\.filter\(link => !items\.some\(item => item\.title === link\.title\)/)
  const views = load("lib/views.ts")
  const titles = [...views.studentNav, ...views.adminNav].map(item => item.title)
  for (const removed of ["Messages", "Interview workspace", "Notifications", "Status", "Corkboard"]) assert.ok(!titles.includes(removed), removed)
  assert.ok(views.adminNav.some(item => item.title === "Interview room"))
  assert.ok(views.adminNav.some(item => item.title === "Announcements"))
  const report = JSON.parse(fs.readFileSync("docs/nav-cleanup-screens/report.json", "utf8"))
  assert.ok(report.search["personal-home"].includes("Inbox"))
  assert.equal(report.report.filter(row => row.findings.length).length, 0, "the last screenshot audit found nothing")
})

test("Public profile: the roster count is a suggestion and never remounts the editor (edits in progress survive)", () => {
  const settings = fs.readFileSync("components/club-profile-settings.tsx", "utf8")
  assert.match(settings, /<ClubProfileEditor clubId=\{clubId\} key=\{clubId\} rosterCount=\{rosterCount\}/)
  assert.doesNotMatch(settings, /rosterCount \?\? ""\}`|withRosterCount/)
  const editor = fs.readFileSync("components/clubs/club-profile-editor.tsx", "utf8")
  assert.match(editor, /placeholder=\{rosterCount != null \? String\(rosterCount\) : undefined\}/)
  assert.match(editor, /Use roster count \(\{rosterCount\}\)/)
})

test("Settings → Organizations keeps its sign-in and profile-completion gate before redirecting", () => {
  const page = fs.readFileSync("app/(workspace)/settings/organizations/page.tsx", "utf8")
  assert.ok(page.indexOf("requireCompletedStudentProfile(user.id, \"/settings/organizations\")") < page.indexOf("redirect(`/clubs"))
  assert.match(page, /requireAuth\(\{ verifyEmail: true \}\)/)
})
