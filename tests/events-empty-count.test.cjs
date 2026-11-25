const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('the event count line hides visually when the empty state already says there are none', () => {
  const board = fs.readFileSync(path.join(__dirname, '..', 'components/events/public-event-board.tsx'), 'utf8')
  const line = board.match(/<p className=\{?([^>]*)role="status" aria-live="polite">\s*\{loading\s*\?\s*"Loading campus events…"/)
  assert.ok(line, 'count line found')
  assert.match(line[1], /total === 0 \? "oc-event-result sr-only"/, 'zero count is screen-reader only')
})
