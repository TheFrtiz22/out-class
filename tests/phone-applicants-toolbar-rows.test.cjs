const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const css = fs.readFileSync("components/applicant-review/applicant-review.css", "utf8")

test("phone applicants toolbar keeps Filters and More on the sort row", () => {
  const block = css.match(/@container \(max-width: 520px\) \{([\s\S]*?)\n\}/)
  assert.ok(block, "a phone container rule for the applicants toolbar")
  assert.match(block[1], /\.oc-toolbar-search \{ flex-basis: 100%; \}/)
  // Sort is order 6, so the tools follow it on the same row rather than wrapping alone above the search.
  assert.match(block[1], /\.oc-toolbar-tools \{ order: 7; \}/)
})
