// Decide → Overview: the default tab, who sees it, and figures that count each applicant once.
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
const decide = load("lib/decide.ts")
const product = load("lib/product-navigation.ts")
const summary = load("lib/voting-target-summary.ts")
const tabFor = (permissions, requested = null) => decide.decideTab(requested, product.decideAccess({ permissions }))

test("Overview is the first Decide tab and the default for anyone who can open Decide", () => {
  assert.deepEqual(decide.decideTabs.map(tab => [tab.id, tab.label]), [["overview", "Overview"], ["voting", "Vote"], ["letters", "Send"]])
  // decisions.view / decisions.start / decisions.vote each need applications.review (decideAccess).
  for (const p of ["decisions.view", "decisions.start", "decisions.vote"]) assert.equal(tabFor(["applications.review", p]), "overview", p)
  assert.equal(tabFor(["recruitment.manage"]), "overview")
  assert.equal(tabFor(["decisions.publish", "applicants.identify"]), "overview")
  assert.equal(tabFor(["applications.review", "decisions.vote"], "overview"), "overview")
  assert.equal(tabFor(["applications.review", "decisions.vote"], "voting"), "voting")
  // A step this member can't open falls back to Overview, not to another step.
  assert.equal(tabFor(["applications.review", "decisions.vote"], "letters"), "overview")
  assert.equal(tabFor(["recruitment.manage"], "voting"), "overview")
})

test("members without Decide access get no tab, so the page shows the unavailable state", () => {
  for (const permissions of [[], ["applications.review"], ["decisions.vote"], ["decisions.publish"], ["applicants.identify"]]) {
    assert.equal(tabFor(permissions), null, permissions.join() || "(none)")
    assert.equal(tabFor(permissions, "overview"), null)
  }
  const page = fs.readFileSync("components/live-voting/decide-page.tsx", "utf8")
  assert.match(page, /if \(!tab\) return <p role="alert">Decide is unavailable with your current access\.<\/p>;/)
})

test("the Decide link, tab changes and Back/Forward keep the round in the URL", () => {
  const nav = load("lib/voting-navigation.ts")
  const href = new URL(nav.decisionsHref("c", "overview", "cycleId=cy&roundId=r&demo=1&sessionId=s"), "https://x.test")
  assert.deepEqual(Object.fromEntries(href.searchParams), { section: "recruitment", tool: "decisions", decisionTab: "overview", cycleId: "cy", roundId: "r", demo: "1" })
  assert.equal(product.managerNavigation({ isOwner: true }, "c", "recruiting", "roundId=r").find(i => i.id === "decisions").href, "/club/c/workspace?section=recruitment&tool=decisions&decisionTab=overview&roundId=r")
  const page = fs.readFileSync("components/live-voting/decide-page.tsx", "utf8")
  // Tab changes and Overview's step links push history through the same go() (replace only for the round picker).
  assert.match(page, /onValueChange=\{value => go\(decisionsHref\(clubId, value as DecideTab, search\)\)\}/)
  assert.match(page, /onOpen=\{step => go\(decisionsHref\(clubId, step, search\)\)\}/)
  assert.equal(load("lib/workspace-routes.ts").canonicalClubWorkspaceHref("c", new URLSearchParams("section=recruitment&tool=decisions&decisionTab=overview")), null)
})

test("decision counts come from canonical outcomes, each applicant once across a round's sessions", () => {
  const sessions = [
    { id: "s1", createdAt: "2026-11-01T10:00:00Z", revision: 2, targetSize: 3, outcomes: [{ applicationId: "a", outcome: "HOLD" }, { applicationId: "b", outcome: "ACCEPT" }, { applicationId: "c", outcome: null }] },
    // A later Hold re-vote decides "a"; "b" is on both rosters but counted once.
    { id: "s2", createdAt: "2026-11-02T10:00:00Z", revision: 1, targetSize: 3, outcomes: [{ applicationId: "a", outcome: "ACCEPT" }, { applicationId: "b", outcome: null }, { applicationId: "d", outcome: "REJECT" }] },
  ]
  const round = summary.roundTargetSummary({ sessions, round: { name: "Final", final: true } })
  assert.deepEqual(round.decisions, { pass: 2, hold: 0, notPass: 1, unreviewed: 1, total: 4 })
  assert.equal(round.decisions.pass + round.decisions.hold + round.decisions.notPass + round.decisions.unreviewed, round.decisions.total)
  assert.equal(round.target.value, 3)
  assert.equal(round.progress.text, "2 passed · Target 3")
  // Ballot-like duplicates inside one list never count twice.
  assert.deepEqual(summary.decisionCounts([{ applicationId: "x", outcome: "ACCEPT" }, { applicationId: "x", outcome: "REJECT" }]), { pass: 1, hold: 0, notPass: 0, unreviewed: 0, total: 1 })
})

test("Overview lists active and scheduled live sessions with Resume, Join or View details", () => {
  const room = (over) => ({ roundId: "r", roundName: "R", applicantCount: 4, mode: "LIVE", state: "OPEN", view: "present", meeting: null, ...over })
  assert.equal(decide.overviewSessionGroup(room({})), "active")
  assert.equal(decide.overviewSessionGroup(room({ state: "PAUSED" })), "active")
  assert.equal(decide.overviewSessionGroup(room({ state: "DRAFT", meeting: { status: "SCHEDULED" } })), "scheduled")
  assert.equal(decide.overviewSessionGroup(room({ state: "DRAFT" })), null)
  assert.equal(decide.overviewSessionGroup(room({ state: "DRAFT", meeting: { status: "CANCELLED" } })), null)
  assert.equal(decide.overviewSessionGroup(room({ state: "COMPLETED" })), null)
  assert.equal(decide.overviewSessionGroup(room({ mode: "LEGACY" })), null)
  assert.equal(decide.overviewSessionAction(room({ view: "leader" })), "Resume")
  assert.equal(decide.overviewSessionAction(room({ view: "member" })), "Join")
  assert.equal(decide.overviewSessionAction(room({ view: "present" })), "View details")
  assert.equal(decide.overviewSessionAction(room({ view: "leader", state: "DRAFT", meeting: { status: "SCHEDULED" } })), "View details")
})

test("Overview's letter figures: ready to send and sent, from closed live sessions only", () => {
  const rooms = [
    { roundId: "r", roundName: "R", state: "COMPLETED", mode: "LIVE", publishedAt: null, applicantCount: 6 },
    { roundId: "r", roundName: "R", state: "COMPLETED", mode: "LIVE", publishedAt: "2026-11-01T00:00:00Z", applicantCount: 4 },
    { roundId: "r", roundName: "R", state: "COMPLETED", mode: "LEGACY", publishedAt: null, applicantCount: 5 },
    { roundId: "r", roundName: "R", state: "OPEN", mode: "LIVE", publishedAt: null, applicantCount: 9 },
  ]
  assert.deepEqual(decide.overviewSendCounts(rooms), { ready: { sessions: 1, applicants: 6 }, sent: { sessions: 1, applicants: 4 } })
})

test("Overview reuses the existing reads, Demo routing and permission gates", () => {
  const source = fs.readFileSync("components/live-voting/decide-overview.tsx", "utf8")
  // Demo-gated adapters, never the server actions directly.
  assert.match(source, /import \{ getRoundTargetSummary, type listLiveVotingRooms \} from "@\/lib\/voting-room-api"/)
  assert.match(source, /import \{ getDecisionTemplates \} from "@\/lib\/workspace-api"/)
  assert.doesNotMatch(source, /@\/actions\//)
  assert.match(source, /<VotingTargetSummary label="Round target" target=\{round\.value\} \/>/)
  assert.match(source, /canLetters = hasPermission\(member, "recruitment\.manage"\)/)
  assert.match(source, /if \(!access\.canVote \|\| !roundId \|\| !demo\.ready\) return;/)
  assert.match(source, /if \(!canLetters \|\| !demo\.ready\) return;/)
  assert.match(source, /from "@\/components\/icons"/)
  assert.doesNotMatch(source, /lucide/)
  assert.match(source, /liveRoomPath\(clubId, r\.id, r\.view, demo\.isDemoEnabled\)/)
  // The server read itself still enforces voting access per session and applicant identity rules.
  const action = fs.readFileSync("actions/voting-target-summary.ts", "utf8")
  assert.match(action, /requireClubPermission\(d\.clubId, \["applications\.review"\]\)/)
  assert.match(fs.readFileSync("lib/voting-room-projection.ts", "utf8"), /!round\.anonymousReview && !hasPermission\(m, "applicants\.identify"\)/)
  assert.match(fs.readFileSync("actions/communications.ts", "utf8"), /getDecisionTemplates\(clubId:string\) \{\s*z\.string\(\)\.uuid\(\)\.parse\(clubId\);await requireClubPermission\(clubId,\['recruitment\.manage'\]\)/)
})
