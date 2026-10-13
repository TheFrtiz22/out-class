const { test } = require('node:test'), assert = require('node:assert/strict')
const { loader } = require('./helpers/communications-loader.cjs')
const { simultaneousStaffing, staffingShortageSessionIds } = loader({})('lib/interview-staffing-capacity.ts')
const slot = (id, required, members, start = '2026-10-26T09:00:00Z', end = '2026-10-26T09:30:00Z', buffer = 0) => ({ id, required, availableMemberIds: members, startTime: start, endTime: end, buffer, active: true })
test('shared candidates cannot staff multiple simultaneous positions; disjoint pools can', () => {
  assert.deepEqual(simultaneousStaffing([slot('a', 2, ['1','2','3','4']), slot('b', 3, ['1','2','3','4'])]), { required: 5, filled: 4, shortage: 1 })
  assert.equal(simultaneousStaffing([slot('a', 2, ['1','2']), slot('b', 3, ['3','4','5'])]).shortage, 0)
})
test('a shortage in a subset is detected even when the total union meets demand', () => {
  assert.deepEqual(simultaneousStaffing([slot('a', 2, ['1','2']), slot('b', 1, ['1','2']), slot('c', 1, ['3','4','5'])]), { required: 4, filled: 3, shortage: 1 })
  assert.equal(simultaneousStaffing([slot('a', 1, ['1','2']), slot('b', 1, ['1'])]).filled, 2, 'Augmenting moves the flexible interviewer so the constrained position can be filled')
})
test('capacity warnings respect nonoverlapping sessions, trailing buffers and inactive rooms', () => {
  const a = slot('a', 1, ['1']), b = slot('b', 1, ['1'], '2026-10-26T09:30:00Z', '2026-10-26T10:00:00Z')
  assert.equal(staffingShortageSessionIds([a,b]).size, 0)
  assert.deepEqual([...staffingShortageSessionIds([{...a, buffer:15},b])].sort(), ['a','b'])
  assert.equal(staffingShortageSessionIds([{...a, active:false},b]).size, 0)
})
