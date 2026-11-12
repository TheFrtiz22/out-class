// Decide → Overview: the default tab, who sees it, and figures that count each applicant once.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")

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
// Renders Overview's own markup with its reads and Demo context stubbed (no effects run on the server render).
function loadOverview() {
  const mocks = {
    "@/contexts/demo-context": { useDemoMode: () => ({ isDemoEnabled: false, ready: false }) },
    "@/lib/voting-room-api": { getRoundTargetSummary: async () => { throw Error("not in tests") } },
    "@/lib/workspace-api": { getDecisionTemplates: async () => { throw Error("not in tests") } },
    "@/lib/voting-room": { liveRoomPath: () => "/voting" },
    "next/link": { __esModule: true, default: ({ href, children, scroll: _scroll, ...rest }) => React.createElement("a", { href, ...rest }, children) },
  }
  const loadTsx = file => {
    const resolved = [file, `${file}.ts`, `${file}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
    const mod = { exports: {} }
    const code = ts.transpileModule(fs.readFileSync(resolved, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    new Function("require", "module", "exports", code)(name => name in mocks ? mocks[name] : name === "@/components/icons" ? require("./helpers/icons.cjs") : name.endsWith(".css") ? {} : name.startsWith("@/") ? loadTsx(path.join(name.slice(2))) : require(name), mod, mod.exports)
    return mod.exports
  }
  return loadTsx("components/live-voting/decide-overview.tsx")
}
const tabFor = (permissions, requested = null) => decide.decideTab(requested, product.decideAccess({ permissions }))

test("Overview is the first Decide tab and the default for anyone who can open Decide", () => {
  assert.deepEqual(decide.decideTabs.map(tab => [tab.id, tab.label]), [["overview", "Overview"], ["review", "Review"], ["voting", "Vote"], ["letters", "Send"]])
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
  // Tab and round changes both push history through go(), so Back/Forward restore round and tab.
  assert.match(page, /onValueChange=\{value => go\(decisionsHref\(clubId, value as DecideTab, search\)\)\}/)
  assert.match(page, /go\(`\/club\/\$\{encodeURIComponent\(clubId\)\}\/workspace\?\$\{next\}`\);/)
  assert.doesNotMatch(page, /workspace\?\$\{next\}`, true\)/)
  // Overview's step links are real links that keep the unsaved-work guard.
  assert.match(page, /stepHref=\{step => decisionsHref\(clubId, step, search\)\}/)
  const overview = fs.readFileSync("components/live-voting/decide-overview.tsx", "utf8")
  assert.match(overview, /<Link href=\{href\} scroll=\{false\} onClick=\{event => \{ if \(!canLeaveWorkspace\(\)\) \{ event\.preventDefault\(\); return \} handleClubLink\(event, href\) \}\}>/)
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

test("Overview's send figures are session counts, never applicants or letters", () => {
  const rooms = [
    { roundId: "r", roundName: "R", state: "COMPLETED", mode: "LIVE", publishedAt: null, applicantCount: 6 },
    { roundId: "r", roundName: "R", state: "COMPLETED", mode: "LIVE", publishedAt: "2026-11-01T00:00:00Z", applicantCount: 4 },
    { roundId: "r", roundName: "R", state: "COMPLETED", mode: "LEGACY", publishedAt: null, applicantCount: 5 },
    { roundId: "r", roundName: "R", state: "OPEN", mode: "LIVE", publishedAt: null, applicantCount: 9 },
  ]
  assert.deepEqual(decide.overviewSendCounts(rooms), { ready: 1, sent: 1 })
  // Two ready sessions that share an applicant (a Hold re-vote) are two sessions, not 2 + 3 applicants.
  const shared = [
    { roundId: "r", roundName: "R", state: "COMPLETED", mode: "LIVE", publishedAt: null, applicantCount: 2 },
    { roundId: "r", roundName: "R", state: "COMPLETED", mode: "LIVE", publishedAt: null, applicantCount: 3 },
  ]
  assert.deepEqual(decide.overviewSendCounts(shared), { ready: 2, sent: 0 })
  const source = fs.readFileSync("components/live-voting/decide-overview.tsx", "utf8")
  assert.match(source, /const showSends = access\.canVote && !!roundId;/)
  assert.match(source, /Sessions ready to send <span className="font-medium tabular-nums">\{send\.ready\}<\/span> · Sessions sent/)
  assert.doesNotMatch(source, /label="Ready to send"|label="Sent"/)
})

const scope = round => `club:cycle:${round}:false:applications.review,decisions.vote`
const summaryFor = pass => ({ scope: "round", revision: 1, target: { label: "Advancement target for R", value: 3 }, pass: { kind: "advance", label: "Pass means advance to a later round." },
  decisions: { pass, hold: 1, notPass: 2, unreviewed: 3, total: pass + 6 }, progress: summary.targetProgress(pass, 3), sessions: 1, partial: false })

test("a refused identified round is a quiet state; an outage keeps Retry", () => {
  const state = over => decide.overviewSummaryState({ roundId: "r2", scope: scope("r2"), loaded: { scope: scope("r2"), value: null }, canIdentify: false, rooms: [], ...over })
  // decisions.vote without applicants.identify on a non-anonymous round: the read refuses and none of their sessions is listed.
  assert.deepEqual(state({}), { kind: "denied" })
  assert.deepEqual(state({ rooms: [{ roundId: "anonymous-round" }] }), { kind: "denied" })
  // The member's sessions for this round are listed (so it is anonymous to them): a failure is an outage.
  assert.deepEqual(state({ rooms: [{ roundId: "r2" }] }), { kind: "failed" })
  assert.deepEqual(state({ canIdentify: true }), { kind: "failed" })
  assert.deepEqual(state({ roundId: "" }), { kind: "choose" })

  const { DecisionTotals } = loadOverview()
  const html = s => renderToStaticMarkup(React.createElement(DecisionTotals, { state: s, onRetry: () => {} }))
  const denied = html(state({}))
  assert.match(denied, /Decision totals aren’t available with your access\./)
  assert.doesNotMatch(denied, /role="alert"|Retry/)
  const failed = html(state({ canIdentify: true }))
  assert.match(failed, /role="alert"/); assert.match(failed, />Retry</)
  const ready = html({ kind: "ready", value: summaryFor(2) })
  assert.match(ready, /<dt[^>]*>Undecided<span class="block">in voting sessions<\/span><\/dt><dd[^>]*>3<\/dd>/)
  assert.match(ready, /aria-label="Round target"/)
})

test("changing roundId mid-request never shows the old round's figures", () => {
  // r1's response arrives after the member switched to r2: it is keyed to r1's scope, so r2 shows Loading.
  const late = { scope: scope("r1"), value: summaryFor(9) }
  assert.deepEqual(decide.overviewSummaryState({ roundId: "r2", scope: scope("r2"), loaded: late, canIdentify: true, rooms: [] }), { kind: "loading" })
  const lateFailure = { scope: scope("r1"), value: null }
  assert.deepEqual(decide.overviewSummaryState({ roundId: "r2", scope: scope("r2"), loaded: lateFailure, canIdentify: false, rooms: [] }), { kind: "loading" })
  const own = { scope: scope("r2"), value: summaryFor(1) }
  assert.equal(decide.overviewSummaryState({ roundId: "r2", scope: scope("r2"), loaded: own, canIdentify: true, rooms: [] }).value.decisions.pass, 1)
  // The effect drops responses after cleanup, and focus re-runs both reads like DecidePage's rooms read.
  const source = fs.readFileSync("components/live-voting/decide-overview.tsx", "utf8").replace(/\r\n/g, "\n")
  assert.match(source, /\.then\(value => \{ if \(current\) setSummary\(\{ scope, value \}\) \}\)/)
  assert.match(source, /return \(\) => \{ current = false \};\n  \}, \[scope, clubId, roundId, cycleId, access\.canVote, demo\.ready, summaryReload\]\);/)
  assert.match(source, /\}, \[lettersScope, clubId, canLetters, demo\.ready, lettersReload\]\);/)
  assert.match(source, /window\.addEventListener\("focus", onFocus\)/)
})

test("the letters panel: an Open Send line when there is nothing else to show; no Send action without send access", () => {
  const { DecideOverview } = loadOverview()
  const render = (permissions, roundId = "") => {
    const member = { permissions }
    return renderToStaticMarkup(React.createElement(DecideOverview, { clubId: "c", member, access: product.decideAccess(member), rows: null, failed: false, onRetry: () => {}, roundId, stepHref: step => `/club/c/workspace?decisionTab=${step}` }))
  }
  // Scheduled sends only: one Open Send line, no empty panel.
  const scheduler = render(["decisions.publish", "applicants.identify"])
  assert.doesNotMatch(scheduler, /Decision letters/)
  assert.match(scheduler, /<p><a [^>]*href="\/club\/c\/workspace\?decisionTab=letters"[^>]*>Open Send/)
  // Voters who can't send: no Send action anywhere; with a round, only the session counts.
  const voter = render(["applications.review", "decisions.vote"], "r")
  assert.doesNotMatch(voter, /Open Send|decisionTab=letters/)
  assert.match(voter, /Open Vote/)
  assert.doesNotMatch(render(["applications.review", "decisions.vote"]), /Decision letters/)
  // Template readers keep the panel with Open Send.
  assert.match(render(["recruitment.manage"]), /Decision letters[\s\S]*Open Send/)
})

test("Overview reuses the existing reads, Demo routing and permission gates", () => {
  const source = fs.readFileSync("components/live-voting/decide-overview.tsx", "utf8")
  // Demo-gated adapters, never the server actions directly.
  assert.match(source, /import \{ getRoundTargetSummary, type listLiveVotingRooms \} from "@\/lib\/voting-room-api"/)
  assert.match(source, /import \{ getDecisionTemplates \} from "@\/lib\/workspace-api"/)
  assert.doesNotMatch(source, /@\/actions\//)
  assert.match(source, /<VotingTargetSummary label="Round target" target=\{value\} \/>/)
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
