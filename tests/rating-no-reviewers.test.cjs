// Applicant review: with nobody assigned in the current round the header read "Rating — · 0/0 reviews", next to a
// Reviews tab counting grades from earlier rounds. It now reads "Not scored yet", like the applicants table and ranked list.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const source = fs.readFileSync(require('node:path').join(__dirname, '../components/applicant-review/applicant-review-flow.tsx'), 'utf8')

test('a round with no reviewers says so instead of "0/0 reviews"', () => {
  assert.match(source, /app\.roundScore\.required === 0 && app\.roundScore\.submitted === 0 \? "Not scored yet"/)
})
