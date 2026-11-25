// Club page: with no Apply/primary action, the website and social icons sat alone at the far right of the
// header, detached from the club they belong to. They now start at the left; with an action they stay right of it.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const source = fs.readFileSync(require('node:path').join(__dirname, '../components/clubs/marketing-profile.tsx'), 'utf8')

test('club link icons start at the left when there is no primary action', () => {
  assert.match(source, /oc-club-hero-actions[^`"]*\$\{action \? "justify-between" : "justify-start"\}/)
})
