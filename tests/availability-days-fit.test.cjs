const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const root = path.join(__dirname, "..")
const read = file => fs.readFileSync(path.join(root, file), "utf8")

test("the phone day picker shares the row so the weekend is visible without scrolling", () => {
  const calendar = read("components/availability/weekly-calendar.tsx")
  assert.match(calendar, /<SegmentedControl label="Day to edit"[^>]*className="oc-availability-day-picker"/)
  const css = read("styles/product-workflows.css")
  const rule = css.match(/\.oc-availability-calendar \.oc-segmented-control\.oc-availability-day-picker > button\[data-segment\] \{([^}]*)\}/)
  assert.ok(rule, "day picker buttons have their own rule")
  assert.match(rule[1], /flex: 1 0 auto;/, "buttons grow to share the row but never shrink below their label")
  assert.match(rule[1], /padding-inline: \.25rem;/, "tighter padding lets seven days fit a 390px phone")
})
