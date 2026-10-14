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
const calendar = load('lib/calendar.ts')
const { agendaGroups, notificationGroups, notificationPriority } = load('lib/student-agenda.ts', { '@/lib/calendar': calendar })
const event = (id, date, time = '14:00', extra = {}) => ({ id, date, time, type: 'Interview', title: id, club: 'Club', color: '#142d4e', day: Number(date.slice(-2)), ...extra })
test('agenda uses local day boundaries across month/year changes and keeps current events', () => {
  const groups = agendaGroups([
    event('later', '2027-01-12'), event('tomorrow', '2027-01-01'), event('ongoing', '2026-12-31', '11:30'), event('next', '2027-01-03'), event('past', '2026-12-30'),
  ], new Date('2026-12-31T12:00:00-05:00'))
  assert.deepEqual(groups.map(group => group.label), ['Today', 'Tomorrow', 'Next 7 days', 'Later'])
  assert.equal(groups[0].events[0].id, 'ongoing')
})
test('past toggle restores history and invalid timestamps do not break grouping', () => {
  const groups = agendaGroups([event('past', '2026-09-20'), event('invalid', 'invalid')], new Date('2026-09-22T00:00:00-04:00'), true)
  assert.deepEqual(groups.map(group => group.label), ['Earlier'])
  assert.equal(groups[0].events.length, 1)
})
test('a passed deadline has no implicit one-hour grace period', () => {
  assert.equal(agendaGroups([event('due', '2026-09-22', '11:59', { type: 'Deadline' })], new Date('2026-09-22T12:00:00-04:00')).length, 0)
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

test('Eastern deadline boundaries use actual instants without host-timezone grace', () => {
  const due = event('due', '2026-09-22', '11:59', { type: 'Deadline' })
  const at = new Date('2026-09-22T15:59:00.000Z')
  assert.equal(calendar.eventStart(due).toISOString(), at.toISOString())
  assert.equal(agendaGroups([due], new Date(+at - 1)).length, 1)
  // The instantaneous calendar marker is visible at its timestamp, then past.
  assert.equal(agendaGroups([due], at).length, 1)
  assert.equal(agendaGroups([due], new Date(+at + 1)).length, 0)
  assert.equal(agendaGroups([due], new Date(+at + 1), true)[0].label, 'Earlier')
  const { applicationAvailability } = load('lib/club-settings.ts')
  const club = { applicationOpen: true, applicationDeadline: at }
  assert.equal(applicationAvailability(club, new Date(+at - 1)), true)
  assert.equal(applicationAvailability(club, at), false)
  assert.equal(applicationAvailability(club, new Date(+at + 1)), false)
})
test('Eastern DST and explicit UTC event instants retain correct deadline grouping', () => {
  for (const [day, now, expected] of [
    ['2026-03-08', '2026-03-08T16:00:00Z', '2026-03-08T15:59:00Z'],
    ['2026-11-01', '2026-11-01T17:00:00Z', '2026-11-01T16:59:00Z'],
  ]) {
    const due = event('due', day, '11:59', { type: 'Deadline' })
    assert.equal(calendar.eventStart(due).toISOString(), new Date(expected).toISOString())
    assert.equal(agendaGroups([due], new Date(now)).length, 0)
    assert.equal(agendaGroups([due], new Date(now), true)[0].label, 'Earlier')
  }
  const due = event('absolute', '2026-09-22', '23:00', { type: 'Deadline', startTime: '2026-09-22T16:00:00Z' })
  assert.equal(agendaGroups([due], new Date('2026-09-22T16:00:00.001Z')).length, 0)
})
