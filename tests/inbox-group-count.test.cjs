const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts', mocks) : require(name), mod, mod.exports)
  return mod.exports
}
const agenda = load('lib/student-agenda.ts', { '@/lib/calendar': load('lib/calendar.ts') })
const note = (id, extra = {}) => ({ id, club: 'Club', type: 'Task', read: false, ...extra })

// The inbox printed the whole inbox's count ("2 unread · 5 notifications") beside the Club updates heading,
// above 4 club updates, and kept it when the Unread tab showed only 2. Each heading now counts its own rows.
test('a group heading counts the notifications in that group', () => {
  const items = [note('panel', { type: 'Interview Invite', read: true }), note('a'), note('b'), note('c', { read: true }), note('d', { read: true })]
  const groups = agenda.notificationGroups(items, false, true)
  assert.deepEqual(groups.map(group => [group.label, agenda.notificationCountLabel(group.items)]), [
    ['Recruitment & schedule updates', '0 unread · 1 notification'],
    ['Club updates', '2 unread · 4 notifications'],
  ])
})

test('the inbox puts each group its own count, and the empty state counts what is shown', () => {
  const inbox = fs.readFileSync('components/views/inbox-view.tsx', 'utf8')
  assert.match(inbox, /const countLine = [^\n]*notificationCountLabel\(list\)/)
  assert.match(inbox, /countLine\(group\.items\)/)
  assert.match(inbox, /countLine\(filtered\)/)
  assert.doesNotMatch(inbox, /countGroup/)
})
