const test = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
// "Undecided / in voting sessions" takes two lines, so its number sat a line lower than Passed, Held and Not passed.
// Each figure is a column whose number is pushed to the bottom, so the four numbers in a row line up.
test("Decide overview figures keep their numbers on one line across the row", () => {
  const src = readFileSync("components/live-voting/decide-overview.tsx", "utf8")
  const figure = src.match(/function Figure[\s\S]*?\n}/)[0]
  assert.match(figure, /<div className="flex min-w-0 flex-col">/)
  assert.match(figure, /<dd className="m-0 mt-auto /)
})
