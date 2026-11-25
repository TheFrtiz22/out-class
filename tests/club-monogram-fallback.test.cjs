const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { harness } = require('./helpers/demo-harness.cjs')

test('a club without a logo shows its initials, not the first two letters of its name', () => {
  const { clubMonogram } = harness().load('lib/club-assets.ts')
  assert.equal(clubMonogram('OutClass Live QA 20261125'), 'OLQ')
  assert.equal(clubMonogram('McIntire Investment Institute'), 'MII')
  assert.equal(clubMonogram('Club of Investing'), 'CI')
  assert.equal(clubMonogram(null), 'OC')
})

test('no club logo fallback slices the club name', () => {
  const files = []
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (/\.tsx?$/.test(entry.name)) files.push(file) } }
  for (const dir of ['components', 'lib']) walk(dir)
  const offenders = files.filter(file => /(text=\{|logoText:\s*\(?)[\w?.]*(?:name|clubName)(?: \|\| "OC"\))?\.slice\(0, ?2\)/.test(fs.readFileSync(file, 'utf8')))
  assert.deepEqual(offenders, [])
})

test('directory cards, club pages and application cards use the same initials', () => {
  for (const file of ['actions/club-directory.ts', 'components/clubs/marketing-profile.tsx', 'components/applications/application-status-card.tsx', 'components/applications/application-journey-card.tsx']) {
    const src = fs.readFileSync(file, 'utf8')
    assert.match(src, /clubMonogram\((?:club|profile|app\.club)\.name\)/, file)
    assert.doesNotMatch(src, /name\s*\.split\(\/\\s\+\/\)\s*\.map\(\(?(?:w|word)\)? => (?:w|word)\[0\]\)/, file)
  }
})
