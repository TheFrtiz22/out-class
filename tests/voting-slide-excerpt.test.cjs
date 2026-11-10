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
