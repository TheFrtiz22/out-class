const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const source = fs.readFileSync(path.join(__dirname, "..", "components/shell/navigation-search.tsx"), "utf8")

test("the search footer's keyboard hint is hidden on touchscreens", () => {
  const hint = source.match(/<span className="([^"]*)"><ArrowUp size=\{14\}[^\n]*to browse · Enter to open · Esc to close<\/span>/)
  assert.ok(hint, "the keyboard hint is still there for keyboards")
  assert.match(hint[1], /\bpointer-coarse:hidden\b/)
})
