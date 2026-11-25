const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// Club settings › Communications labels its letter editor in sentence case, like every other settings heading.
test('the decision letter editor is labeled in sentence case', () => {
  const src = fs.readFileSync(path.join(__dirname, '../components/communications/template-editor.tsx'), 'utf8')
  assert.match(src, />Decision letters<\/summary>/)
  assert.doesNotMatch(src, /Decision Letters/)
})
