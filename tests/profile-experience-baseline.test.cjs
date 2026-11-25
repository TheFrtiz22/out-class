const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/lib/') ? load(name.slice(2) + '.ts', mocks) : require(name), mod, mod.exports)
  return mod.exports
}
const { profileSectionSnapshot } = load('lib/student-profile.ts')

// Edit profile drops blank experience rows when it saves, but keeps them in the editor.
// Switching sections re-takes the baseline from the editor, blank row included, so the next
// save of that experience was refused as "changed in another tab" although nothing else changed.
test('a blank experience row in the editor does not make the stored list look changed', () => {
  const filled = { id: 'a', title: 'Treasurer', subtitle: 'Finance club', period: '2025' }
  const blank = { id: 'new-1', title: '', subtitle: ' ', period: '' }
  const editor = { experiences: [filled, blank] }
  const stored = { experiences: [filled] }
  assert.equal(profileSectionSnapshot(editor, 'experience'), profileSectionSnapshot(stored, 'experience'))
})

test('a real difference in experience is still seen', () => {
  const stored = { experiences: [{ id: 'a', title: 'Treasurer', subtitle: '', period: '' }] }
  const other = { experiences: [{ id: 'a', title: 'President', subtitle: '', period: '' }] }
  assert.notEqual(profileSectionSnapshot(stored, 'experience'), profileSectionSnapshot(other, 'experience'))
  assert.notEqual(profileSectionSnapshot(stored, 'experience'), profileSectionSnapshot({ experiences: [] }, 'experience'))
})

test('the dialog and the snapshot treat the same rows as blank', () => {
  const dialog = fs.readFileSync('components/edit-student-profile-dialog.tsx', 'utf8')
  assert.match(dialog, /experiences: snapshot\.experiences\.filter\(hasExperienceContent\)/)
})
