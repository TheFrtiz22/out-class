const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// The web calendar treats a panel slot (id "panel-…", lib/student-calendar-data.ts) like the mobile app does:
// "You’re on the panel" and "Open interview tools", without the person's own application details.
const src = fs.readFileSync(path.join(__dirname, '../components/views/calendar-view.tsx'), 'utf8')

test('panel slots read as the person’s panel, not their own interview', () => {
  assert.match(src, /const isPanelEvent = \(event: ClubEvent\) => event\.id\.startsWith\("panel-"\)/)
  assert.match(src, /const application = selectedPanel \? undefined : trackedApps\.find/)
  assert.match(src, /isPanelEvent\(event\) \? " · You’re on the panel" : " · Confirmed"/)
  assert.match(src, /selected\.readOnly && !selectedPanel &&/)
  assert.match(src, /<Link href=\{clubInterviewHref\(selected\.clubId\)\}>Open interview tools<\/Link>/)
})
