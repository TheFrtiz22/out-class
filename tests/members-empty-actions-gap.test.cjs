// Members: the "Member actions" row is empty once Add member moves into the page header (its dialogs render in
// portals), and the empty row still took a 24px gap above the search bar.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

test("the member actions row takes no space when it has nothing in it", () => {
  const source = fs.readFileSync("components/organization-member-management.tsx", "utf8")
  assert.match(source, /<div className="flex flex-wrap gap-2 empty:hidden" role="group" aria-label="Member actions">/)
})
