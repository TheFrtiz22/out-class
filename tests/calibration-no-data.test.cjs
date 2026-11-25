const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const card = fs.readFileSync('components/recruiting-insights-card.tsx', 'utf8')

test('reviewer calibration only says scores are in line once reviews can be compared', () => {
  assert.match(card, /const compared = data\.reviewers\.some\(r => r\.offset !== null\)/)
  assert.match(card, /\{compared \? "Reviewers are scoring in line with each other\." : "Not enough shared reviews to compare yet\./)
  assert.doesNotMatch(card, /: <DashboardQuiet>Reviewers are scoring in line with each other\.<\/DashboardQuiet>/)
})
