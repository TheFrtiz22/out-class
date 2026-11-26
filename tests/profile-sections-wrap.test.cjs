const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

test("Edit profile shows every section on a phone instead of scrolling some past the right edge", () => {
  const dialog = fs.readFileSync("components/edit-student-profile-dialog.tsx", "utf8")
  // A plain wrapper: the dialog grid sizes its row from the wrapper, so the wrapped second row is not clipped.
  assert.match(dialog, /<div className="oc-profile-section-picker"><SegmentedControl label="Profile section"/)
  const css = fs.readFileSync("styles/product-components.css", "utf8")
  const rule = css.match(/@media \(max-width: 639px\) \{ \.oc-profile-section-picker > \.oc-segmented-control:not\(\[data-sliding\]\) \{([^}]*)\}/)
  assert.ok(rule, "a phone rule targets the profile section picker")
  assert.match(rule[1], /flex-wrap:\s*wrap/)
  assert.match(rule[1], /overflow:\s*visible/)
})
