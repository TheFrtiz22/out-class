// At phone width the Tasks Status filter was fixed at 9rem, cutting "Status: Active" to "Status: Activ" and hiding the
// counts in "Submitted (3)". The pill now takes its label's width and only shrinks when the row truly has no room.
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const css = fs.readFileSync(path.join(__dirname, '..', 'components/tasks.css'), 'utf8')

test('the Status filter is sized to its label at every width', () => {
  const rules = [...css.matchAll(/\.oc-task-filter\s*\{([^}]*)\}/g)].map(m => m[1])
  assert.ok(rules.length > 0, 'a .oc-task-filter rule exists')
  for (const body of rules) {
    const basis = body.match(/flex:\s*[\d.]+\s+[\d.]+\s+([^;]+);/)
    if (basis) assert.equal(basis[1].trim(), 'auto', `no fixed width: ${body.trim()}`)
  }
})
