const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports)
  return mod.exports
}
const calendar = load('lib/calendar.ts')
const { agendaGroups, notificationGroups, notificationPriority } = load('lib/student-agenda.ts', { '@/lib/calendar': calendar })
const event = (id, date, time = '14:00', extra = {}) => ({ id, date, time, type: 'Interview', title: id, club: 'Club', color: '#142d4e', day: Number(date.slice(-2)), ...extra })
test('agenda uses local day boundaries across month/year changes and keeps current events', () => {
  const groups = agendaGroups([
    event('later', '2027-01-12'), event('tomorrow', '2027-01-01'), event('ongoing', '2026-12-31', '11:30'), event('next', '2027-01-03'), event('past', '2026-12-30'),
  ], new Date(2026, 11, 31, 12))
  assert.deepEqual(groups.map(group => group.label), ['Today', 'Tomorrow', 'Next 7 days', 'Later'])
  assert.equal(groups[0].events[0].id, 'ongoing')
})
test('past toggle restores history and invalid timestamps do not break grouping', () => {
  const groups = agendaGroups([event('past', '2026-09-20'), event('invalid', 'invalid')], new Date(2026, 8, 22), true)
  assert.deepEqual(groups.map(group => group.label), ['Earlier'])
  assert.equal(groups[0].events.length, 1)
})
test('a passed deadline has no implicit one-hour grace period', () => {
  assert.equal(agendaGroups([event('due', '2026-09-22', '11:59', { type: 'Deadline' })], new Date(2026, 8, 22, 12)).length, 0)
})
test('notification priority uses structured metadata rather than guesses from titles', () => {
  assert.equal(notificationPriority({ urgent: true, type: 'Announcement' }), 0)
  assert.equal(notificationPriority({ urgent: false, type: 'Interview Invite' }), 1)
  assert.equal(notificationPriority({ urgent: false, type: 'Announcement', title: 'Decision deadline' }), 2)
})
test('club grouping retains every notification; chronological mode retains input order', () => {
  const items = [{ id: 'a', club: 'Alpha', type: 'Announcement' }, { id: 'b', club: 'Beta', type: 'Interview Invite' }, { id: 'c', club: 'Alpha', type: 'Announcement' }]
  assert.deepEqual(notificationGroups(items, true).map(group => group.items.map(item => item.id)), [['a', 'c'], ['b']])
  assert.deepEqual(notificationGroups(items, false, false)[0].items, items)
  assert.equal(notificationGroups(items, false).length, 2)
})
