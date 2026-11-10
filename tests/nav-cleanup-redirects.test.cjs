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
    // Club events have their own section (FE-12); the old Meetings tab redirects there, keeping other parameters
    "section=meetings&meetingTab=events": "section=events",
    "section=meetings&meetingTab=events&new=1": "section=events&new=1",
    "section=settings&setting=interviews&interviewTab=rooms": "section=recruitment&interviewTab=rooms&tool=interviews",
    "section=settings&setting=interviews&interviewTab=availability": "section=recruitment&interviewTab=schedule&tool=interviews",
    // Settings → Interviews only repeated the Interviews tool
    "section=settings&setting=interviews": "section=recruitment&tool=interviews&interviewTab=kits",
    "section=settings&setting=interviews&interviewTab=kits&roundId=r1": "section=recruitment&interviewTab=kits&roundId=r1&tool=interviews",
    "section=settings&setting=interviews&interviewTab=access": "section=recruitment&interviewTab=access&tool=interviews",
  }
  for (const [from, to] of Object.entries(cases)) assert.equal(workspace(from), at(to), from)
})

test("club workspace: canonical URLs are left alone", () => {
  for (const query of ["", "section=overview", "section=recruitment&tool=applicants", "section=recruitment&tool=applicants&decision=rejected",
    "section=recruitment&tool=decisions&decisionTab=voting", "section=recruitment&tool=decisions&decisionTab=voting&sessionId=s1",
    "section=recruitment&tool=decisions&decisionTab=letters", "section=recruitment&tool=interviews&interviewTab=schedule",
    "section=events", "section=events&new=1", "section=meetings", "section=meetings&meetingTab=members",
    // meetingTab was only ever read inside Meetings, so it redirects only there
    "section=overview&meetingTab=events", "section=tasks&meetingTab=events"]) {
    assert.equal(workspace(query), null, query || "(empty)")
  }
})

test("the server page and the client workspace both apply the same redirects", () => {
  assert.match(fs.readFileSync("app/(workspace)/club/[clubId]/workspace/page.tsx", "utf8"), /canonicalClubWorkspaceHref\(clubId, search\)[\s\S]*redirect\(moved\)/)
  assert.match(fs.readFileSync("components/club-workspace.tsx", "utf8"), /canonicalClubWorkspaceHref\(clubId, params\)/)
})

test("no navigation or dashboard link points at a removed club workspace value", () => {
  const files = ["lib/product-navigation.ts", "lib/navigation.ts", "components/club-home/club-home-model.ts", "components/recruiting-overview.tsx", "components/live-voting/room-landing.tsx", "components/views/leader-dashboard/live-leader-workspace.tsx", "components/club-workspace.tsx"]
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8")
    assert.doesNotMatch(source, /tool=rejected|decisionTab=overview|voting=1|item\("rejected"/, file)
  }
})

test("interview room links start from a clean URL and keep only interview filters", () => {
  const entry = load("lib/interview-entry.ts")
  const room = new URL(entry.clubInterviewHref(club, "section=settings&setting=members&applicationId=a1&roundId=r1&interviewDate=2026-10-20"), "https://x.test")
  assert.equal(room.pathname, `/club/${club}/interview`)
  assert.deepEqual([...room.searchParams.keys()], ["applicationId", "roundId", "interviewDate"])
  const list = new URL(entry.interviewListHref(club, "setting=members&meetingTab=events&applicationId=a1&interviewDate=2026-10-20&interviewTab=rooms"), "https://x.test")
  assert.equal(list.searchParams.get("setting"), null)
  assert.equal(list.searchParams.get("meetingTab"), null)
  assert.equal(list.searchParams.get("applicationId"), null)
  assert.equal(list.searchParams.get("interviewDate"), "2026-10-20")
  assert.equal(list.searchParams.get("tool"), "interviews")
})

test("interview setup links open the Interviews tool, never Settings", () => {
  const { interviewSetupHref } = load("lib/interview-setup.ts")
  for (const tab of ["kits", "access", "schedule", "rooms"]) {
    const url = new URL(interviewSetupHref(club, "r1", tab), "https://x.test")
    assert.equal(url.searchParams.get("section"), "recruitment")
    assert.equal(url.searchParams.get("interviewTab"), tab)
  }
})

test("personal workspace: folded pages redirect with their focus parameters", () => {
  const student = load("lib/student-routes.ts")
  assert.equal(student.movedStudentHref("/applications/status"), "/applications?tab=in-review")
  assert.equal(student.movedStudentHref("/applications/status", new URLSearchParams("applicationId=a1&tag=x&tag=y")), "/applications?applicationId=a1&tag=x&tag=y&tab=in-review")
  assert.equal(student.movedStudentHref("/applications/status", new URLSearchParams("tab=decisions")), "/applications?tab=decisions")
  assert.equal(student.movedStudentHref("/clubs/meetings"), "/calendar?type=meeting")
  assert.equal(student.movedStudentHref("/clubs/meetings", new URLSearchParams("clubId=c1")), "/calendar?clubId=c1&type=meeting")
  assert.equal(student.movedStudentHref("/clubs/tasks"), null, "/clubs/tasks stays routable")
  // Old homepage URLs from email and notifications land on the new homes too.
  assert.equal(student.legacyStudentRedirect(new URLSearchParams("workspace=student&view=status&section=status&applicationId=a1")), "/applications?applicationId=a1&tab=in-review")
  assert.equal(student.legacyStudentRedirect(new URLSearchParams("workspace=student&view=my-clubs&section=meetings")), "/calendar?type=meeting")
  assert.equal(student.applicantStatusHref(new URLSearchParams("applicationId=a1")), "/applications?applicationId=a1&tab=in-review")
})

test("personal pages folded into others redirect on the server", () => {
  const page = file => fs.readFileSync(file, "utf8")
  assert.match(page("app/(workspace)/applications/status/page.tsx"), /redirect\(movedStudentHref\("\/applications\/status", params\)!\)/)
  assert.match(page("app/(workspace)/clubs/meetings/page.tsx"), /redirect\(movedStudentHref\("\/clubs\/meetings", params\)!\)/)
  assert.match(page("app/(workspace)/settings/profile/page.tsx"), /redirect\(`\/profile/)
  assert.match(page("app/(workspace)/settings/organizations/page.tsx"), /redirect\(`\/clubs/)
  assert.match(page("app/(workspace)/inbox/page.tsx"), /tab === "preferences"\) redirect\("\/settings\/notifications"\)/)
})
