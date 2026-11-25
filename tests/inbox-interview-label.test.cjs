// An interviewer's panel schedule and a student's confirmed interview time were both labeled "Interview Invite" in the
// Inbox. Interview notices now read "Interview"; every other kind keeps its own label.
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.join(__dirname, '..')
function load() {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'lib/notification-presentation.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(n => require(n), mod, mod.exports)
  return mod.exports
}

test('interview notices read Interview', () => {
  const { notificationTypeLabel } = load()
  assert.equal(typeof notificationTypeLabel, 'function')
  assert.equal(notificationTypeLabel('Interview Invite'), 'Interview')
  for (const type of ['Task', 'Announcement', 'Decision Available']) assert.equal(notificationTypeLabel(type), type)
})

test('the Inbox row and the opened notice use the label', () => {
  const view = fs.readFileSync(path.join(root, 'components/views/inbox-view.tsx'), 'utf8')
  assert.doesNotMatch(view, /<span>\{item\.type\}<\/span>/)
  assert.match(view, /\{notificationTypeLabel\(selected\.type\)\} · \{selected\.fullDate\}/)
})
