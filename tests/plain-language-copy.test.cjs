// Guards the owner-approved plain-language copy table: replaced wording must not come back
// through merges or new code. Add a row here when a phrase is retired.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')

const retired = [
  'Booking follow-up',
  'awaiting booking',
  'Booking has not been published. Complete the official panel checks',
  'Review setup',
  'Intake closed',
  'Configured rounds',
  'Eligible applicants awaiting your finalized evaluation',
  'All accessible rounds',
  'No accessible bookings',
  'Scheduling & panel checks',
  'Interview access setup',
  'Your club, in focus',
  'personal task assignments reviewed',
  'Personal work & officer responsibilities',
  'Submit your own review to see round scores',
  'Workspace manager',
  'Open managed workspace',
  'Virtual Corkboard',
  'Check out events on Grounds',
]

test('retired internal wording does not appear in application code', () => {
  const files = execFileSync('git', ['ls-files', 'app', 'components', 'lib', 'utils', 'actions'], { encoding: 'utf8' })
    .split('\n').filter(file => /\.(tsx?|mjs|cjs|js)$/.test(file))
  const found = []
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    for (const phrase of retired) if (source.includes(phrase)) found.push(`${file}: ${phrase}`)
  }
  assert.deepEqual(found, [])
})
