'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// On a phone the availability grid told people about arrow keys, Shift and Escape. Phones now see what a finger
// does (tap, and touch dragging for a range); the key list stays for screen readers in an sr-only span.
test('availability grid gives touch instructions on phones', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'components/availability/weekly-calendar.tsx'), 'utf8')
  assert.match(src, /: mobile\s*(\/\/[^\n]*\n\s*)?\? <>Tap a time to add or remove it\. To select a range, turn on touch dragging\.<span className="sr-only"> Arrow keys move; Space or Enter toggles; Shift \+ arrows extends\.<\/span><\/>/)
  assert.match(src, /"Click or tap a time to add or remove it\. Arrow keys move; Space or Enter toggles; Shift \+ arrows extends\. You can also drag; Escape cancels a drag\."/, 'wider screens keep the full instructions')
})
