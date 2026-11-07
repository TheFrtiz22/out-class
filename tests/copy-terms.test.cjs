const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

function load(file) {
  const resolved = [file, `${file}.ts`].find(candidate => fs.existsSync(candidate))
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(resolved, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "module", "exports", code)(name => name.startsWith("@/") ? load(path.join(name.slice(2))) : require(name), mod, mod.exports)
  return mod.exports
}
const terms = load("lib/copy/terms.ts")
const routes = load("lib/workspace-routes.ts")

test("pluralize never says '1 applicants'", () => {
  assert.equal(terms.pluralize(1, "applicant"), "1 applicant")
  assert.equal(terms.pluralize(0, "applicant"), "0 applicants")
  assert.equal(terms.pluralize(2, "result"), "2 results")
  assert.equal(terms.pluralize(1, "class", "classes"), "1 class")
  assert.equal(terms.pluralize(1200, "application"), "1,200 applications")
  assert.equal(terms.plural(1, "voter"), "voter")
})

test("short date-time drops seconds", () => {
  const text = terms.formatDateTime("2026-10-21T21:06:42Z", { timeZone: "America/New_York" })
  assert.equal(text, "Oct 21, 2026, 5:06 PM")
  assert.doesNotMatch(text, /:\d\d:\d\d/)
})

test("one role label for My Clubs and Settings", () => {
  assert.equal(terms.membershipRoleLabel({ isOwner: true, accessRole: "MEMBER" }), "Owner")
  assert.equal(terms.membershipRoleLabel({ accessRole: "ADMIN" }), "Admin")
  assert.equal(terms.membershipRoleLabel({ accessRole: "RECRUITING_ADMIN" }), "Recruiting Lead")
  assert.equal(terms.membershipRoleLabel({}), "Member")
  for (const file of ["components/personal-clubs.tsx", "components/organization-memberships.tsx"]) {
    const source = fs.readFileSync(file, "utf8")
    assert.match(source, /membershipRoleLabel\(member\)/, file)
    assert.doesNotMatch(source, /"Leader"/, file)
  }
})

test("club workspace pages have their own title, not the club name", () => {
  const cases = {
    "section=overview": "Club home",
    "": "Club home",
    "section=recruitment&tool=overview": "Recruiting",
    "section=recruitment&tool=applicants": "Applicants",
    "section=recruitment&tool=interviews": "Interviews",
    "section=recruitment&tool=decisions&decisionTab=voting": "Voting room",
    "section=recruitment&tool=decisions&decisionTab=letters": "Decision letters",
    "section=announcements": "Announcements",
    "section=settings&setting=general": "Settings",
  }
  for (const [query, title] of Object.entries(cases)) assert.equal(routes.clubWorkspaceTitle(new URLSearchParams(query)), title, query)
  assert.equal(routes.clubWorkspaceTitle({ section: ["tasks", "x"] }), "Tasks")
})

test("every personal and settings page sets a server title; the template adds ' · OutClass'", () => {
  assert.match(fs.readFileSync("app/layout.tsx", "utf8"), /template: "%s · OutClass"/)
  const pages = ["home", "explore", "explore/categories", "corkboard", "applications", "applications/status", "clubs", "clubs/meetings", "clubs/tasks", "calendar", "inbox", "profile"].map(p => `app/(product)/${p}/page.tsx`)
    .concat(["page", "account/page", "notifications/page", "organizations/page", "profile/page", "availability/page", "interviews/page"].map(p => `app/settings/${p}.tsx`))
  for (const file of pages) {
    const source = fs.readFileSync(file, "utf8")
    assert.match(source, /metadata[^=]*=\s*\{\s*title:\s*"[^"|]+"/, file)
    assert.doesNotMatch(source, /\| OutClass/, file)
  }
  assert.match(fs.readFileSync("app/(product)/inbox/page.tsx", "utf8"), /title: "Inbox"/)
  assert.match(fs.readFileSync("app/club/[clubId]/workspace/page.tsx", "utf8"), /generateMetadata[\s\S]*clubWorkspaceTitle/)
})

test("retired names do not come back in navigation, search or Home", () => {
  const views = fs.readFileSync("lib/views.ts", "utf8")
  assert.doesNotMatch(views, /title: "Messages"|Interview workspace|title: "Notifications"/)
  const bell = fs.readFileSync("components/shell/notification-center.tsx", "utf8")
  assert.doesNotMatch(bell, /View all notifications|Expand notifications/)
  assert.match(bell, /TERMS\.openInbox/)
  const home = fs.readFileSync("components/views/student-dashboard-view.tsx", "utf8")
  assert.doesNotMatch(home, /Updates for you|Find an event to attend/)
  const clubHome = fs.readFileSync("components/club-home/club-home-model.ts", "utf8") + fs.readFileSync("components/club-home/club-home-actions.tsx", "utf8")
  assert.doesNotMatch(clubHome, /Join voting|Open scheduler|Post update|assignment"/)
  assert.match(clubHome, /interviewTab=schedule/)
})
