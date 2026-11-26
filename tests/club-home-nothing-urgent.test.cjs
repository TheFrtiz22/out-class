const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")

test("club home's Needs you doesn't say no work needs you while the welcome line says tasks are ready", () => {
  // The welcome line counts every open task ("You have tasks ready to work on."); Needs you lists only
  // overdue tasks, submissions and meetings, so its empty state must not claim there is no work.
  assert.match(read("lib/welcome.ts"), /"You have tasks ready to work on\."/)
  const overview = read("components/manager-overview.tsx")
  assert.doesNotMatch(overview, /No club work needs you/)
  assert.match(overview, /<strong>Nothing urgent in club work\.<\/strong> Recruiting items are on the Recruiting overview\./)
})
