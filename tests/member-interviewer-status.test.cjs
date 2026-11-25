const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')

test('a member’s own panel does not count a one-person selection', () => {
  const drawer = read('components/organization-member-management.tsx')
  assert.match(drawer, /selectedIds=\{\[active\.id\]\}[^>]*\bsingle\b/, 'the member panel uses the single-person mode')
  const controls = read('components/availability/interviewer-eligibility.tsx')
  assert.match(controls, /\{!single && <p className="text-sm">\{selected\.length \?/, 'the selection count is hidden in the single-person mode')
})

test('interviewer status says where it comes from in plain words', () => {
  const controls = read('components/availability/interviewer-eligibility.tsx')
  assert.doesNotMatch(controls, /\(individual override\)|\(inherited\)/)
  for (const words of ['set for this person in this round', 'set for this person', 'from their role']) assert.ok(controls.includes(words), words)
})
