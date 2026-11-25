const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// In-app labels use sentence case, like the rest of the workspace since the 2026-11-12 UI audit.
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const cases = [
  ['components/communications/template-editor.tsx', ['Decision letters'], ['Decision Letters']],
  ['components/events/event-schedule-fields.tsx', ['Start date', 'Start time', 'End date'], ['Start Date', 'Start Time', 'End Date', 'End Time']],
  ['lib/campus-events.ts', ['End date must be on or after the start date.', 'End time must be after the start time.'], ['End Date must', 'End Time must']],
  ['components/customization/crm-view-manager.tsx', ['View settings', 'Table view', 'Board view'], ['View Settings', 'Table View', 'Board View']],
  ['components/events/smart-event-card.tsx', ['View event'], ['View Event']],
  ['components/views/scheduler/student-booking-preview.tsx', ['Interview confirmed'], ['Interview Confirmed']],
]
for (const [file, present, absent] of cases) {
  test(`${file} labels are in sentence case`, () => {
    const src = read(file)
    for (const label of present) assert.ok(src.includes(label), `expected "${label}"`)
    for (const label of absent) assert.ok(!src.includes(label), `unexpected "${label}"`)
  })
}
