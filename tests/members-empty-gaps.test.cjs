const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

const src = fs.readFileSync("components/organization-member-management.tsx", "utf8")

// Live on a phone, the Member actions group (its Add member button is portaled into the page header) and the export
// row (empty when CSV export is off) rendered as empty divs, and each still took a full space-y gap: 24px above search
// and 20px above the member count. Empty, they now take no space.
test("member directory's empty action and export rows take no space", () => {
  assert.match(src, /<div className="flex flex-wrap gap-2 empty:hidden" role="group" aria-label="Member actions">/)
  assert.match(src, /<div className="flex flex-wrap items-center gap-3 empty:hidden"><ClubExportLink clubId=\{clubId\} kind="roster"/)
})
