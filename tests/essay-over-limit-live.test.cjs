const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const src = fs.readFileSync(path.join(__dirname, "..", "components/applications/application-form.tsx"), "utf8")

test("the essay word count warns as soon as an answer passes the limit", () => {
  assert.match(src, /<EssayWordCount words=\{wordCount\(responses\[question\.id\] \|\| ""\)\} limit=\{question\.wordLimit\} \/>/)
  const fn = src.slice(src.indexOf("function EssayWordCount"))
  assert.match(fn, /const over = words - limit/)
  assert.match(fn, /if \(over > 0\) return <span className="font-medium text-destructive"[^>]*>\{words\} words · \{over\} over the \{limit\}-word limit\. Shorten your answer to submit\.<\/span>/)
  assert.match(fn, /\{limit\} maximum/)
})
