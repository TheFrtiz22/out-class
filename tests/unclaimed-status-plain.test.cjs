const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

test("Explore cards say a club isn't recruiting here, not the internal word Unclaimed", () => {
  const src = fs.readFileSync("lib/recruitment-presentation.ts", "utf8")
  assert.match(src, /club\.claimed === false \? "Not recruiting on OutClass"/)
  assert.doesNotMatch(src, /"Unclaimed"/)
})
