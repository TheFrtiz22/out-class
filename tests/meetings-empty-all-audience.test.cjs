'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// With the Audience filter on All there is no audience to blame, so "No upcoming meetings for this audience"
// reads as a filter the leader never set. Only a narrowed audience names it.
test('meetings empty state names the audience only when one is picked', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'components/meeting-workspace.tsx'), 'utf8')
  assert.match(src, /audience === "ALL"\s*(\/\/[^\n]*\n\s*)?\? <EmptyState[^>]*title=\{`No \$\{period\} meetings`\}[^>]*description=\{period === "upcoming" \? "Nothing is scheduled yet\." : "No meetings have happened yet\."\}/)
  assert.match(src, /title=\{`No \$\{period\} meetings for this audience`\}/, 'a picked audience still says so')
})
