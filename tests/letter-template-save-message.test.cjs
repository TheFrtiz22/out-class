const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const letters = load('lib/decision-letters.ts')
const accepted = patch => ({ ACCEPTED: { ...letters.defaultLetters.ACCEPTED, ...patch } })

// Settings › Communications › Decision letters autosaves; a template the schema refuses used to throw a ZodError,
// which the autosave status shows as "Your changes are still here. Reconnect and retry." although nothing was offline.
test('a letter with an unknown placeholder names the placeholder and the field', () => {
  assert.equal(letters.letterTemplatesProblem(accepted({ footer: 'Thanks {{nope.field}}' })), 'Footer: {{nope.field}} isn’t an available variable. Use one listed under the letter.')
  assert.equal(letters.letterTemplatesProblem(accepted({ body: 'Hi {student.firstName}' })), 'Letter body: use only the listed {{variable}} placeholders.')
})

test('a blank title or body is refused in plain words', () => {
  assert.equal(letters.letterTemplatesProblem(accepted({ title: '  ' })), 'Title: add a title for this letter.')
  assert.equal(letters.letterTemplatesProblem(accepted({ body: '' })), 'Letter body: add the text of this letter.')
})

test('a valid letter has no problem', () => {
  assert.equal(letters.letterTemplatesProblem(accepted({ footer: 'See you, {{student.firstName}}' })), null)
})

test('the editor shows the problem instead of the reconnect fallback', () => {
  const editor = fs.readFileSync('components/communications/template-editor.tsx', 'utf8')
  assert.match(editor, /const problem=letterTemplatesProblem\(value\);if\(problem\)throw new UserFacingError\(problem\)/)
})
