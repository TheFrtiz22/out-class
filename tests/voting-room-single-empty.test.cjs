const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const src = fs.readFileSync(path.join(__dirname, "..", "components/live-voting/room-landing.tsx"), "utf8")

test("a club with no voting sessions sees one empty state, not three empty headings", () => {
  // One empty state: the ready count when known (tests/voting-empty-ready-count.test.cjs), otherwise the plain line.
  assert.match(src, /:!rooms\.length\?\(readyNow\?<div [^>]*data-voting-empty>/)
  assert.match(src, /:<p className="py-3 text-sm text-muted-foreground" data-voting-empty>No voting sessions yet\. Start one when applicants are ready for a vote\.<\/p>\):<>/)
})

test("once any session exists, the scheduled, active and past groups still show", () => {
  assert.match(src, /\(\["draft","scheduled","active","past"\] as const\)\.map/)
  assert.match(src, /No past sessions\./)
})
