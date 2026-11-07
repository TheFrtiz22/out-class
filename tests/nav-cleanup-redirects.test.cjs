// Every URL removed or renamed by the navigation cleanup redirects to its new home and keeps its other parameters.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

function load(file) {
  const resolved = [file, `${file}.ts`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(resolved, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "module", "exports", code)(name => name.startsWith("@/") ? load(path.join(name.slice(2))) : require(name), mod, mod.exports)
  return mod.exports
}
const routes = load("lib/workspace-routes.ts")
const club = "00000000-0000-4000-8000-000000000001"
const workspace = query => routes.canonicalClubWorkspaceHref(club, new URLSearchParams(query))
const at = query => `/club/${club}/workspace?${query}`

test("club workspace: removed tools and tabs redirect, keeping other parameters", () => {
  const cases = {
    // Rejected Applicants → Applicants filtered to Rejected
    "section=recruitment&tool=rejected": "section=recruitment&tool=applicants&decision=rejected",
    "section=recruitment&tool=rejected&roundId=r1&applicantId=a1": "section=recruitment&tool=applicants&roundId=r1&applicantId=a1&decision=rejected",
    // Decisions → Overview → Applicants decision filter
    "section=recruitment&tool=decisions&decisionTab=overview": "section=recruitment&tool=applicants",
    "section=recruitment&tool=decisions&decisionTab=overview&cycleId=c1": "section=recruitment&tool=applicants&cycleId=c1",
    // The Applicants ballot modal opens from the Voting room
    "section=recruitment&tool=applicants&voting=1&sessionId=s1": "section=recruitment&tool=decisions&sessionId=s1&decisionTab=voting",
    "section=recruitment&voting=1": "section=recruitment&tool=decisions&decisionTab=voting",
    // Older bookmarks kept working before; they still do
    "section=recruitment&tool=voting": "section=recruitment&tool=decisions&decisionTab=voting",
    "section=recruitment&tool=letters": "section=recruitment&tool=decisions&decisionTab=letters",
    "section=recruitment&tool=decision-letters": "section=recruitment&tool=decisions&decisionTab=letters",
    "section=recruitment&tool=cycles": "section=settings&setting=cycles",
    "section=events": "section=meetings",
    "section=settings&setting=interviews&interviewTab=rooms": "section=recruitment&interviewTab=rooms&tool=interviews",
    "section=settings&setting=interviews&interviewTab=availability": "section=recruitment&interviewTab=schedule&tool=interviews",
  }
  for (const [from, to] of Object.entries(cases)) assert.equal(workspace(from), at(to), from)
})

test("club workspace: canonical URLs are left alone", () => {
  for (const query of ["", "section=overview", "section=recruitment&tool=applicants", "section=recruitment&tool=applicants&decision=rejected",
    "section=recruitment&tool=decisions&decisionTab=voting", "section=recruitment&tool=decisions&decisionTab=voting&sessionId=s1",
    "section=recruitment&tool=decisions&decisionTab=letters", "section=recruitment&tool=interviews&interviewTab=schedule"]) {
    assert.equal(workspace(query), null, query || "(empty)")
  }
})

test("the server page and the client workspace both apply the same redirects", () => {
  assert.match(fs.readFileSync("app/club/[clubId]/workspace/page.tsx", "utf8"), /canonicalClubWorkspaceHref\(clubId, search\)[\s\S]*redirect\(moved\)/)
  assert.match(fs.readFileSync("components/club-workspace.tsx", "utf8"), /canonicalClubWorkspaceHref\(clubId, params\)/)
})

test("no navigation or dashboard link points at a removed club workspace value", () => {
  const files = ["lib/product-navigation.ts", "lib/navigation.ts", "components/club-home/club-home-model.ts", "components/recruiting-overview.tsx", "components/live-voting/room-landing.tsx", "components/views/leader-dashboard/live-leader-workspace.tsx", "components/club-workspace.tsx"]
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8")
    assert.doesNotMatch(source, /tool=rejected|decisionTab=overview|voting=1|item\("rejected"/, file)
  }
})
