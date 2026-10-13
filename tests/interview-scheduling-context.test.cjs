const { test } = require('node:test'), assert = require('node:assert/strict')
const { loader } = require('./helpers/communications-loader.cjs')
const { interviewRoundWeek } = loader({})('lib/interview-scheduling-context.ts')
const room = (roundId, timezone, times, isOpen = true) => ({ roundId, timezone, isOpen, slots: times.map(startTime => ({ startTime })) })
test('switching rounds finds the earliest open future session in its room timezone, independent of room ordering', () => {
  const rooms = [room('b','UTC',['2026-11-16T09:00:00Z']), room('a','UTC',['2026-10-26T09:00:00Z']), room('b','America/New_York',['2026-11-09T01:00:00Z']), room('b','UTC',['2026-10-26T09:00:00Z'],false)]
  const now = +new Date('2026-10-20T12:00:00Z')
  assert.equal(interviewRoundWeek({ rooms },'b',now), '2026-11-02', 'UTC Monday is still local Sunday after the DST transition')
  assert.equal(interviewRoundWeek({ rooms },'a',now), '2026-10-26')
  assert.equal(interviewRoundWeek({ rooms },'missing',now), '2026-10-19')
})
