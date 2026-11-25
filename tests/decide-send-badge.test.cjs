// Decide › Send badge: decisions saved during review (StagedDecision rows) wait on Send exactly like applicants in
// closed voting sessions. The badge counted only the sessions, so it read 0 beside "Send all 3".
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const code = ts.transpileModule(fs.readFileSync("lib/decide.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const decide = { exports: {} }
new Function("require", "module", "exports", code)(require, decide, decide.exports)
const { decideCounts } = decide.exports

test("Send counts decisions saved during review as well as closed sessions", () => {
  const rooms = [{ roundId: "b", roundName: "B", mode: "LIVE", state: "COMPLETED", publishedAt: null, applicantCount: 6 }]
  assert.deepEqual(decideCounts(rooms), { voting: 0, letters: 6 })
  assert.deepEqual(decideCounts(rooms, 3), { voting: 0, letters: 9 })
  // No voting sessions at all (the review-only path): the saved decisions are the whole count.
  assert.deepEqual(decideCounts([], 3), { voting: 0, letters: 3 })
})

test("Decide reads the saved decisions for the selected round into the Send badge", () => {
  const page = fs.readFileSync("components/live-voting/decide-page.tsx", "utf8")
  assert.match(page, /useStagedDecisions\(clubId/, "the page loads saved decisions")
  assert.match(page, /expectedRoundId === roundId/, "only the selected round's decisions are counted")
  assert.match(page, /decideCounts\(rows \?\? \[\], stagedCount\)/, "the count includes them")
})
