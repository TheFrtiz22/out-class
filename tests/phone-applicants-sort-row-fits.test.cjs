const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const css = fs.readFileSync("components/applicant-review/applicant-review.css", "utf8")
const phone = () => css.match(/@container \(max-width: 520px\) \{([\s\S]*?)\n\}/)?.[1] ?? ""

// Live at 390px the row needed 335px for Sort (185) + gap + Filters and More (140) but had 330, so Filters and More
// wrapped onto a row of their own. Sort now takes the space that is left and truncates its value instead.
test("phone applicants sort row shrinks Sort instead of wrapping Filters and More", () => {
  const rules = phone()
  assert.match(rules, /\.oc-toolbar-sort \{ flex: 1 1 0; min-width: 0; \}/)
  assert.match(rules, /\.oc-toolbar-sort \.oc-pill-select-trigger \{ min-width: 0; \}/)
  assert.match(rules, /\.oc-toolbar-sort \[data-slot="select-value"\] \{[^}]*text-overflow: ellipsis/)
  assert.match(rules, /\.oc-toolbar-tools \{ order: 7; gap: \.25rem; \}/)
})

test("phone applicants toolbar has no extra row gap above search", () => {
  assert.match(phone(), /\.oc-applicants-toolbar::before \{ display: none; \}/)
})
