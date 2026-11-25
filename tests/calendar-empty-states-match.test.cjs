const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")

test("a club calendar's empty Meetings and Events look alike: outlined, compact, left-aligned, no full stop in the title", () => {
  const meetings = read("components/meeting-workspace.tsx"), events = read("components/events/club-events.tsx")
  assert.match(meetings, /<EmptyState tone="outlined" density="compact" align="start" title=\{`No \$\{period\} meetings`\}/)
  assert.match(meetings, /<EmptyState tone="outlined" density="compact" align="start" title=\{`No \$\{period\} meetings for this audience`\}/)
  assert.match(events, /<EmptyState tone="outlined" density="compact" align="start" title="No events yet" description="Use New event/)
  assert.doesNotMatch(events, /title="No events yet\."/)
})
