// Club page: an unclaimed club (no leaders on OutClass) said "Applications aren’t open yet", as if a window were
// coming. It now says it isn't recruiting on OutClass, matching Explore and the unclaimed notice below it.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const source = fs.readFileSync(require('node:path').join(__dirname, '../components/views/club-profile-view.tsx'), 'utf8')

test('an unclaimed club does not promise that applications will open', () => {
  assert.match(source, /\{!club\.claimed \? "Not recruiting on OutClass" : recruitment\.expired \? "Applications have closed" : "Applications aren’t open yet"\}/)
})
