const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const source = fs.readFileSync(path.join(__dirname, "..", "components/admin/admin-directory.tsx"), "utf8")

test("admin record table headers stay on one line on a phone", () => {
  assert.match(source, /<th scope="col" className="whitespace-nowrap p-4">Status<\/th>/)
  assert.match(source, /<th scope="col" className="whitespace-nowrap p-4">Inspect<\/th>/)
  assert.doesNotMatch(source, /Status \/ details/)
})

test("a long email in the record column can wrap instead of squeezing the other columns", () => {
  assert.match(source, /<td className="max-w-80 p-4 \[overflow-wrap:anywhere\]">/)
})
