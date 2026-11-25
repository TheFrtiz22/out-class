const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const src = fs.readFileSync(path.join(__dirname, "..", "components/clubs/club-profile-editor.tsx"), "utf8")

test("repeatable record lists use the same small label as line lists", () => {
  const records = src.slice(src.indexOf("function Records"), src.indexOf("const sections"))
  const lines = src.slice(src.indexOf("function Lines"), src.indexOf("function Records"))
  assert.match(lines, /<p className="text-sm font-medium">\{label\}<\/p>/)
  assert.match(records, /<h4 className="text-sm font-medium"[^>]*>\{title\}<\/h4>/)
  assert.doesNotMatch(records, /oc-card-heading/)
})
