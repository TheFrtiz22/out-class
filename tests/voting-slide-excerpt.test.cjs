const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const Module = require("node:module")
const path = require("node:path")
function load(file) {
  const filename = path.resolve(__dirname, "..", file)
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = new Module(filename, module)
  mod.require = (name) => require(name)
  mod._compile(output, filename)
  return mod.exports
}
const slide = load("lib/voting-slide-excerpt.ts")
const { slideExcerpt, feedbackExcerpt, feedbackBudget, SLIDE_FEEDBACK_CHARS, SLIDE_FEEDBACK_LINES, SLIDE_FEEDBACK_MIN_CHARS, SLIDE_FEEDBACK_MIN_LINES } = slide

const long = "Thoughtful, prepared and calm under pressure. ".repeat(40)
const lines = Array.from({ length: 12 }, (_, i) => `- point ${i + 1} about the candidate`).join("\n")

test("text that fits is returned unchanged", () => {
  assert.equal(slideExcerpt("Short and complete."), "Short and complete.")
  assert.equal(feedbackExcerpt("Short and complete.", 6), "Short and complete.")
})

test("interviewers share one feedback budget; adding interviewers never grows the section past main's per-entry floor", () => {
  for (let n = 2; n <= 12; n++) {
    const { chars, lines: lineBudget } = feedbackBudget(n)
    const shown = Array.from({ length: n }, () => feedbackExcerpt(long, n))
    const total = shown.reduce((sum, s) => sum + Array.from(s).length, 0)
    // Within the shared budget, or at most main's 100 characters per interviewer once that runs out.
    assert.ok(total <= Math.max(SLIDE_FEEDBACK_CHARS, n * SLIDE_FEEDBACK_MIN_CHARS) + n, `${n} interviewers show ${total} characters`)
    assert.ok(chars >= SLIDE_FEEDBACK_MIN_CHARS && lineBudget >= SLIDE_FEEDBACK_MIN_LINES, "each entry stays readable")
    const totalLines = Array.from({ length: n }, () => feedbackExcerpt(lines, n).split("\n").length).reduce((a, b) => a + b, 0)
    assert.ok(totalLines <= Math.max(SLIDE_FEEDBACK_LINES, n * SLIDE_FEEDBACK_MIN_LINES), `${n} interviewers show ${totalLines} lines`)
  }
  // The regression this guards: before, each of 6 interviewers kept at least 160 characters and 3 lines.
  assert.ok(feedbackBudget(6).chars < 160 && feedbackBudget(6).lines < 3)
})

test("cuts end with an ellipsis at a word boundary and never split an emoji", () => {
  const cut = slideExcerpt(long, 120, 8)
  assert.ok(cut.endsWith("…") && Array.from(cut).length <= 120)
  assert.doesNotMatch(cut, /\s…$/)
  const emoji = "👍".repeat(200)
  const out = slideExcerpt(emoji, 50, 8)
  assert.ok(out.endsWith("…"))
  assert.doesNotMatch(out, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/, "no lone high surrogate at the cut")
})

test("line budget cuts after the allowed number of lines", () => {
  const out = slideExcerpt(lines, 1000, 3)
  assert.equal(out.split("\n").length, 3)
  assert.ok(out.endsWith("…"))
})

test("short projectors (1280×720) use smaller budgets than the normal slide, never larger, and keep the per-entry floor", () => {
  const { evidenceExcerpt, SLIDE_SHORT_QUERY, SLIDE_SHORT_EVIDENCE_CHARS, SLIDE_SHORT_EVIDENCE_LINES, SLIDE_EVIDENCE_CHARS, SLIDE_EVIDENCE_LINES } = slide
  assert.equal(SLIDE_SHORT_QUERY, "(min-width: 1100px) and (min-height: 650px) and (max-height: 767.98px)")
  const css = fs.readFileSync(path.resolve(__dirname, "../components/live-voting/room.css"), "utf8")
  assert.ok(css.includes("@media(min-width:1100px) and (min-height:650px) and (max-height:767.98px)"), "room.css uses the same query")
  assert.equal(evidenceExcerpt(long), slideExcerpt(long), "normal budget unchanged")
  assert.ok(Array.from(evidenceExcerpt(long, true)).length <= SLIDE_SHORT_EVIDENCE_CHARS)
  assert.equal(evidenceExcerpt(lines, true).split("\n").length, SLIDE_SHORT_EVIDENCE_LINES)
  assert.equal(evidenceExcerpt("Short and complete.", true), "Short and complete.")
  for (let n = 1; n <= 12; n++) {
    const normal = feedbackBudget(n), short = feedbackBudget(n, true)
    assert.ok(short.chars <= normal.chars && short.lines <= normal.lines, `${n} entries`)
    assert.ok(short.chars >= (n > 1 ? SLIDE_FEEDBACK_MIN_CHARS : 1) && short.lines >= (n > 1 ? SLIDE_FEEDBACK_MIN_LINES : 1))
  }
  assert.ok(SLIDE_SHORT_EVIDENCE_CHARS < SLIDE_EVIDENCE_CHARS && SLIDE_SHORT_EVIDENCE_LINES < SLIDE_EVIDENCE_LINES)
})
