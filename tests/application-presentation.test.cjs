const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const mod = { exports: {} }
new Function('exports', ts.transpileModule(fs.readFileSync('lib/application-presentation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(mod.exports)
const { applicationInScope, relevantInterview } = mod.exports

test('interviews use recorded status or bookings, never an inferred club round', () => {
  assert.equal(applicationInScope({ status: 'IN_REVIEW', round: { name: 'Interview' }, bookings: [] }, 'interviews'), false)
  assert.equal(applicationInScope({ status: 'INTERVIEWING', bookings: [] }, 'interviews'), true)
  assert.equal(applicationInScope({ status: 'ACCEPTED', bookings: [{}] }, 'interviews'), true)
  assert.equal(applicationInScope({ status: 'DRAFTING', bookings: [] }, 'interviews'), false)
})
test('decisions include waitlists and final statuses but not interview or draft stages', () => {
  for (const status of ['ACCEPTED', 'REJECTED', 'WAITLISTED']) assert.equal(applicationInScope({ status, bookings: [] }, 'decisions'), true)
  for (const status of ['SUBMITTED', 'IN_REVIEW', 'INTERVIEWING', 'DRAFTING']) assert.equal(applicationInScope({ status, bookings: [] }, 'decisions'), false)
})
test('next interview uses the earliest future booking without mutating data; past is explicitly identified', () => {
  const booking = (id, time) => ({ id, slot: { startTime: time } })
  const source = [booking('later', '2026-10-10'), booking('past', '2026-09-01'), booking('next', '2026-10-01')]
  assert.equal(relevantInterview(source, +new Date('2026-09-26')).booking.id, 'next')
  assert.equal(relevantInterview(source, +new Date('2026-09-26')).past, false)
  assert.equal(relevantInterview(source, +new Date('2026-11-01')).booking.id, 'later')
  assert.equal(relevantInterview(source, +new Date('2026-11-01')).past, true)
  assert.deepEqual(source.map(b => b.id), ['later', 'past', 'next'])
  assert.equal(relevantInterview([]), null)
  assert.equal(relevantInterview([booking('bad', 'invalid')]), null)
})
