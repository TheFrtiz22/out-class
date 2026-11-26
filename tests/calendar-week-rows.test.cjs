const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const src = fs.readFileSync("components/views/calendar-view.tsx", "utf8")

test("week and day rows give the title the width and say the status in words", () => {
  const row = src.slice(src.indexOf('"flex w-full items-start gap-3 rounded-lg p-3'), src.indexOf("No events on this day match your filters"))
  assert.ok(row.length > 0, "the week/day event row is found")
  // A raw "confirmed" in a narrow right column squeezed the title to a few words a line on phones.
  assert.doesNotMatch(row, /event\.response \?\? event\.type/)
  assert.match(row, /<span className="w-20 shrink-0 font-medium">/)
  assert.match(row, /<span className="min-w-0 flex-1">/)
  assert.match(row, /\{eventStatusLine\(event\)\}/)
})

test("the agenda and week rows share one status line", () => {
  assert.equal(src.match(/\{eventStatusLine\(event\)\}/g).length, 2)
})
