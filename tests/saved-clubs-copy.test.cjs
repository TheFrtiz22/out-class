const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

// The Saved clubs page's buttons and loading line read as plain sentences, not as a page name dropped into a verb.
test("Saved clubs page uses plain button and loading copy", () => {
  const source = fs.readFileSync("components/views/saved-clubs-view.tsx", "utf8")
  for (const stale of ["Retry Saved clubs", "Loading Saved clubs", "Browse Explore"]) assert.ok(!source.includes(stale), `still says ${stale}`)
  assert.equal(source.match(/>\s*Try again\s*</g)?.length, 2)
  assert.match(source, /label="Loading saved clubs…"/)
  assert.match(source, />Browse clubs</)
})
