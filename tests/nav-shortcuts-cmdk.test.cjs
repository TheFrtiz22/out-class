// FE-11: the interview schedule in Settings navigation, permission-scoped Cmd-K entries for a club's Meetings,
// Events and Members, the "?" shortcut list, and the Applicants layout kept in the URL.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

const read = file => fs.readFileSync(file, "utf8")
function load(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function("require", "module", "exports", code)(name => name.startsWith("@/lib/") ? load(name.slice(2) + ".ts") : require(name), mod, mod.exports)
  return mod.exports
}

test("Settings navigation lists the interview schedule for signed-in accounts, not in Demo Mode", () => {
  const nav = load("lib/settings-navigation.ts")
  const entry = nav.personalSettingsSections.find(item => item.href === "/settings/interviews")
  assert.ok(entry, "the interview schedule has a Settings entry")
  assert.equal(entry.label, "Interview schedule")
  assert.deepEqual(nav.visiblePersonalSettingsSections(false).map(item => item.id), ["account", "notifications", "availability", "interests", "interviews"])
  assert.deepEqual(nav.visiblePersonalSettingsSections(true).map(item => item.id), ["account", "availability"])
  // The page exists and reads only the signed-in account's own assignments.
  assert.ok(fs.existsSync("app/(workspace)/settings/interviews/page.tsx"))
  assert.match(read("actions/official-panel-schedule.ts"), /getMyInterviewPanelSchedule\(\)\{const \{user\}=await requireAuth\(\);return prisma\.\$transaction\(tx=>ownPanelAssignments\(tx,user\.id\)\)/)
})

test("Cmd-K club entries follow the page gates: no capability, no entry", () => {
  const { clubSearchLinks } = load("lib/product-navigation.ts")
  const ids = member => clubSearchLinks(member, "club 1").map(link => link.id)
  // A plain member opens only the Calendar's meetings.
  assert.deepEqual(ids({ permissions: [] }), ["club-search-meetings"])
  assert.deepEqual(ids({ permissions: ["applications.review", "tasks.manage"] }), ["club-search-meetings"])
  assert.deepEqual(ids({ permissions: ["meetings.manage"] }), ["club-search-meetings", "club-search-events"])
  assert.deepEqual(ids({ permissions: ["members.manage"] }), ["club-search-meetings", "club-search-members"])
  assert.deepEqual(ids({ permissions: ["leaders.manage"] }), ["club-search-meetings", "club-search-members"])
  assert.deepEqual(ids({ isOwner: true }), ["club-search-meetings", "club-search-events", "club-search-members"])
  // A former member, a missing membership or no club gets nothing.
  assert.deepEqual(ids({ isOwner: true, status: "LEFT" }), [])
  assert.deepEqual(ids(undefined), [])
  assert.deepEqual(clubSearchLinks({ isOwner: true }, ""), [])
  const links = Object.fromEntries(clubSearchLinks({ isOwner: true }, "club 1").map(link => [link.id, link.href]))
  assert.equal(links["club-search-meetings"], "/club/club%201/workspace?section=calendar&type=meetings")
  assert.equal(links["club-search-events"], "/club/club%201/workspace?section=calendar&type=events")
  assert.equal(links["club-search-members"], "/club/club%201/workspace?section=members")
  // The shell passes them to Cmd-K only for an allowed, non-admin workspace, without repeating a rail address.
  const shell = read("components/shell/product-shell.tsx")
  assert.match(shell, /const clubLinks = allowed && !platform \? clubSearchLinks\(member, clubId\)\.filter\(link => !railLinks\.some\(rail => rail\.href === link\.href\)\) : \[\]/)
  assert.match(shell, /links=\{\[\.\.\.railLinks, \.\.\.clubLinks,/)
})

test("? opens the shortcut list, never while typing, with a modifier, or over another dialog", () => {
  const { opensShortcutList, keyboardShortcutGroups } = load("lib/keyboard-shortcuts.ts")
  const key = (over = {}) => ({ key: "?", metaKey: false, ctrlKey: false, altKey: false, defaultPrevented: false, isComposing: false, target: { tagName: "BODY", closest: () => null }, ...over })
  assert.equal(opensShortcutList(key()), true)
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) assert.equal(opensShortcutList(key({ target: { tagName, closest: () => null } })), false, tagName)
  assert.equal(opensShortcutList(key({ target: { tagName: "DIV", isContentEditable: true } })), false)
  assert.equal(opensShortcutList(key({ target: { tagName: "SPAN", closest: selector => selector.includes("[role=\"combobox\"]") ? {} : null } })), false)
  assert.equal(opensShortcutList(key({ metaKey: true })), false)
  assert.equal(opensShortcutList(key({ ctrlKey: true })), false)
  assert.equal(opensShortcutList(key({ key: "/" })), false)
  assert.equal(opensShortcutList(key({ isComposing: true })), false)
  assert.equal(opensShortcutList(key(), true), false, "another dialog is open")
  // Only shortcuts that already have listeners.
  const labels = keyboardShortcutGroups.flatMap(group => group.shortcuts.map(item => item.label))
  assert.deepEqual(labels, ["Search OutClass", "Keyboard shortcuts", "Search applicants", "Previous or next applicant in a review", "Previous or next submission"])
  assert.match(read("components/shell/product-shell.tsx"), /\(e\.metaKey \|\| e\.ctrlKey\) && e\.key\.toLowerCase\(\) === "k"/)
  const workspace = read("components/views/leader-dashboard/live-leader-workspace.tsx")
  assert.match(workspace, /event\.key === "\/" &&/)
  assert.match(workspace, /shortcut="\/"/, "the applicant search field shows the / hint")
  assert.match(read("components/tasks/task-review-workspace.tsx"), /if\(!event\.altKey/)
})

test("the shortcut dialog reuses the shared Dialog with a title and description", () => {
  const dialog = read("components/shell/keyboard-shortcuts.tsx")
  assert.match(dialog, /from "@\/components\/ui\/dialog"/)
  assert.match(dialog, /<DialogTitle[^>]*>Keyboard shortcuts<\/DialogTitle>/)
  assert.match(dialog, /<DialogDescription/)
  assert.match(dialog, /opensShortcutList\(event,/)
  assert.match(read("components/shell/product-shell.tsx"), /<KeyboardShortcuts \/>/)
})

test("the Applicants layout is kept in the URL; List stays out of it", () => {
  const { readApplicantView, writeApplicantView, APPLICANT_VIEW_PARAM } = load("lib/applicant-view.ts")
  assert.equal(APPLICANT_VIEW_PARAM, "applicantView")
  assert.equal(readApplicantView(new URLSearchParams("applicantView=kanban")), "kanban")
  assert.equal(readApplicantView(new URLSearchParams("applicantView=ranked")), "ranked")
  assert.equal(readApplicantView(new URLSearchParams("applicantView=board")), "list")
  assert.equal(readApplicantView(new URLSearchParams("")), "list")
  const url = new URL("https://outclass.test/club/c/workspace?section=recruitment&tool=applicants&decision=pending")
  assert.equal(writeApplicantView(url, "kanban").search, "?section=recruitment&tool=applicants&decision=pending&applicantView=kanban")
  assert.equal(writeApplicantView(url, "list").search, "?section=recruitment&tool=applicants&decision=pending")
  const workspace = read("components/views/leader-dashboard/live-leader-workspace.tsx")
  assert.match(workspace, /useState<ApplicantView>\(\(\) => decisionsOnly \? "list" : readApplicantView\(initialParams\.current\)\)/)
  assert.match(workspace, /window\.history\.replaceState\(window\.history\.state, "", writeApplicantView\(new URL\(window\.location\.href\), value\)\)/)
})
