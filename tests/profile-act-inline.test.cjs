// Profile: GPA and SAT read "label value" on one line, but ACT stacked its label above the score because its
// row had no flex layout. Each test score now uses the same row.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const source = fs.readFileSync(require('node:path').join(__dirname, '../components/views/unified-student-profile-view.tsx'), 'utf8')

test('ACT uses the same inline label row as GPA and SAT', () => {
  assert.match(source, /profile\.actScore != null && <div className="flex gap-2"><dt className="text-muted-foreground">ACT<\/dt>/)
  assert.doesNotMatch(source, /profile\.actScore != null && <div><dt/)
})
