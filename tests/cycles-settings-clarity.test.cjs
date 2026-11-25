const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const src = fs.readFileSync(path.join(__dirname, "..", "components/recruitment-cycles.tsx"), "utf8")

test("cycles settings explain cycles in plain words", () => {
  assert.doesNotMatch(src, /Unknown historical cycles remain unassigned/)
  assert.doesNotMatch(src, /membership joining cohorts/)
  assert.match(src, /A cycle groups one recruiting season’s applications/)
})

test("existing cycles sit under their own heading", () => {
  assert.match(src, /<h3 className="text-sm font-medium" data-cycle-list-heading>Your cycles<\/h3><ul/)
})

test("Start from last cycle shows a chevron so it reads as expandable", () => {
  const summary = src.match(/<summary[^>]*>[\s\S]*?<\/summary>/)[0]
  assert.match(summary, /Start from last cycle<ChevronDown aria-hidden="true"/)
  assert.match(summary, /details\[open\]_&\]:rotate-180/)
})
