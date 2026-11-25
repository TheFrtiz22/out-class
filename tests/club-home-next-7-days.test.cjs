// Club home's card listed everything in the next seven days under "This week", so on a Thursday it showed next
// Tuesday's meeting as "this week". The heading and empty state now say what the card holds.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs')
const src = fs.readFileSync('components/club-home/club-home-sections.tsx', 'utf8')

test('the club calendar card is titled for the next seven days, not the calendar week', () => {
  assert.match(src, /title="Next 7 days" index=\{index\} className="oc-club-home-card oc-club-home-week"/)
  assert.match(src, /empty="Nothing on the club calendar in the next 7 days\."/)
  assert.doesNotMatch(src, /title="This week"/)
})
