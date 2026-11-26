// Under the "My interviews" tab, a visible "My interviews" heading repeated the tab right below it.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const list = fs.readFileSync("components/interviews/interview-rooms-list.tsx", "utf8")
const tabs = fs.readFileSync("components/interview-management-tabs.tsx", "utf8")

test("organizers see the My interviews tab once; the heading stays for screen readers", () => {
  assert.match(tabs, /<InterviewRoomsList clubId=\{clubId\} tabbed=\{organizer\}/)
  assert.match(list, /<h2 className=\{tabbed \? "sr-only" : "oc-section-heading"\}>My interviews<\/h2>/)
  // The header row only takes space when it holds the round filter.
  assert.match(list, /<header className=\{tabbed && usedRounds\.length < 2 \? "sr-only" : "flex flex-wrap items-center justify-between gap-3"\}>/)
})

test("someone who only interviews (no tabs) still sees the heading", () => {
  assert.match(list, /tabbed = false/)
})
