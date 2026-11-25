const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const src = fs.readFileSync(path.join(__dirname, "..", "components/applications/application-management-card.tsx"), "utf8")

test("a draft with no deadline says plainly whether it can still be sent", () => {
  assert.doesNotMatch(src, /Deadline not published/)
  const line = src.match(/<p data-deadline-line>[\s\S]*?<\/p>/)[0]
  assert.match(line, /: closed \? <strong className="font-medium">Applications closed<\/strong> : "No deadline yet"/)
  assert.match(line, /recruitmentDate\(due\)\}`\}\{closed && <strong className="font-medium"> · Applications closed<\/strong>\}/)
})
