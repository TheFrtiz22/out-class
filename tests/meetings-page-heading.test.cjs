const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const source = fs.readFileSync(path.join(__dirname, "..", "components/meeting-workspace.tsx"), "utf8")

test("the Meetings page has a level-one heading", () => {
  assert.match(source, /<h1 className="oc-section-heading">Club meetings<\/h1>/)
  assert.doesNotMatch(source, /<h2 className="oc-section-heading ?">Club meetings<\/h2>/)
})

test("'All available meetings' shows only when the list is filtered to one club, so it never links the page to itself", () => {
  assert.match(source, /\{clubId && <Link className="text-sm underline" href="\/meetings">All available meetings<\/Link>\}/)
})
