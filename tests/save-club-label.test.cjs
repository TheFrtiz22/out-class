// Explore's directory cards said "Save to saved clubs", which repeats itself. The button now says "Save club" (and
// still "Remove from saved clubs" once saved), signed in or not.
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '..', 'components/clubs/corkboard-button.tsx'), 'utf8')

test('the save button names the action once', () => {
  assert.doesNotMatch(source, /Save to saved clubs/)
  assert.match(source, /authenticated && saved \? "Remove from saved clubs" : "Save club"/)
})
