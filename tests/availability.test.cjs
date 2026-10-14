const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const cache = {}
function load(file) {
  file = path.resolve(file); if (cache[file]) return cache[file].exports
  const m = { exports: {} }; cache[file] = m
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name), m, m.exports)
  return m.exports
}
const a = load('lib/availability.ts'), { AvailabilitySaveQueue } = load('lib/availability-save-queue.ts')
const instant = text => +new Date(text)
function declared(zone = 'America/New_York') { const schedule = a.emptySchedule(zone); schedule.weeklySubmitted = true; schedule.weekly[0] = [[540, 600]]; return schedule }

test('Monday-first recurrence, empty declarations, exceptions replace rather than add, and reset restores recurrence', () => {
  const s = declared()
  assert.equal(a.monday('2026-10-18'), '2026-10-12')
  assert.equal(a.intervalAvailability(s, instant('2026-10-12T13:00Z'), instant('2026-10-12T14:00Z')), 'available')
  assert.equal(a.intervalAvailability(s, instant('2026-10-19T13:00Z'), instant('2026-10-19T14:00Z')), 'available')
  assert.equal(a.intervalAvailability(s, instant('2026-10-12T13:45Z'), instant('2026-10-12T14:01Z')), 'unavailable')
  s.exceptions['2026-10-12'] = []
  assert.equal(a.intervalAvailability(s, instant('2026-10-12T13:00Z'), instant('2026-10-12T14:00Z')), 'unavailable')
  s.exceptions['2026-10-12'] = [[600, 630]]
  assert.equal(a.intervalAvailability(s, instant('2026-10-12T13:00Z'), instant('2026-10-12T14:00Z')), 'unavailable')
  assert.equal(a.intervalAvailability(s, instant('2026-10-12T14:00Z'), instant('2026-10-12T14:30Z')), 'available')
  delete s.exceptions['2026-10-12']
  assert.equal(a.intervalAvailability(s, instant('2026-10-12T13:00Z'), instant('2026-10-12T14:00Z')), 'available')
})
test('unknown schedules never imply availability; one-time declarations do not submit recurrence', () => {
  const s = a.emptySchedule('UTC'); s.weekly[0] = [[0, 1440]]
  assert.equal(a.intervalAvailability(null, instant('2026-10-12T09:00Z'), instant('2026-10-12T10:00Z')), 'unknown')
  assert.equal(a.intervalAvailability(s, instant('2026-10-12T09:00Z'), instant('2026-10-12T10:00Z')), 'unknown')
  s.exceptions['2026-10-12'] = [[540, 600]]
  assert.equal(a.intervalAvailability(s, instant('2026-10-12T09:00Z'), instant('2026-10-12T10:00Z')), 'available')
  assert.equal(a.intervalAvailability(s, instant('2026-10-19T09:00Z'), instant('2026-10-19T10:00Z')), 'unknown')
  assert.equal(a.intervalAvailability(s, instant('2026-10-12T08:59:59Z'), instant('2026-10-12T09:15Z')), 'unavailable')
})
test('DST keeps local recurring hours; spring gaps and autumn folds are explicit; both repeated instants resolve', () => {
  const s = declared()
  assert.equal(a.intervalAvailability(s, instant('2026-03-02T14:00Z'), instant('2026-03-02T15:00Z')), 'available')
  assert.equal(a.intervalAvailability(s, instant('2026-03-09T13:00Z'), instant('2026-03-09T14:00Z')), 'available')
  assert.equal(a.intervalAvailability(s, instant('2026-11-02T14:00Z'), instant('2026-11-02T15:00Z')), 'available')
  assert.equal(a.weekCells('2026-03-02', s.timezone)[6].filter(c => c.start === null).length, 4)
  assert.equal(a.weekCells('2026-10-26', s.timezone)[6].filter(c => c.start === null).length, 4)
  s.weekly[6] = [[60, 120]]
  for (const hour of ['05', '06']) assert.equal(a.intervalAvailability(s, instant(`2026-11-01T${hour}:15Z`), instant(`2026-11-01T${hour}:45Z`)), 'available')
})
test('cross-day sessions, fractional-offset zones, and southern hemisphere transitions', () => {
  const s = declared('Asia/Kathmandu'); s.weekly[0] = [[0, 15], [1425, 1440]]; s.weekly[1] = [[0, 15]]
  assert.equal(a.intervalAvailability(s, instant('2026-10-12T18:00Z'), instant('2026-10-12T18:30Z')), 'available')
  s.exceptions['2026-10-13'] = []
  assert.equal(a.intervalAvailability(s, instant('2026-10-12T18:00Z'), instant('2026-10-12T18:30Z')), 'unavailable')
  assert.equal(new Date(a.weekCells('2026-10-12', 'Asia/Kathmandu')[0][0].start).toISOString(), '2026-10-11T18:15:00.000Z')
  assert.equal(a.weekCells('2026-09-28', 'Australia/Sydney')[6].filter(c => c.start === null).length, 4)
  assert.equal(a.weekCells('2026-03-30', 'Australia/Lord_Howe')[6].filter(c => c.start === null).length, 2)
})
test('validated compact intervals reject malformed dates, zones, large payloads and non-quarter-hour boundaries', () => {
  const s = declared()
  assert.deepEqual(a.parseSchedule({ ...s, weekly: [[[570, 600], [540, 570]], ...s.weekly.slice(1)] }).weekly[0], [[540, 600]])
  for (const bad of [{ ...s, timezone: 'Bad/Zone' }, { ...s, weekly: [[[540, 541]], ...s.weekly.slice(1)] }, { ...s, exceptions: { '2026-02-30': [] } }, { ...s, exceptions: { '__proto__': [] }, extra: true }, { ...s, weekly: [[]] }]) assert.equal(a.availabilityScheduleSchema.safeParse(bad).success, false)
  assert.equal(a.availabilityScheduleSchema.safeParse({ ...s, exceptions: Object.fromEntries(Array.from({ length: 401 }, (_, i) => [a.addDays('2026-01-01', i), []])) }).success, false)
})
test('eligibility is per membership and round, with no administrative capability grants', () => {
  const member = { status: 'ACTIVE', accessRole: 'MEMBER', permissions: [], interviewerEligible: null }
  assert.equal(a.interviewerEligible(member, ['INTERVIEWER']), false)
  assert.equal(a.interviewerEligible({ ...member, interviewerEligible: true }, []), true)
  assert.equal(a.interviewerEligible({ ...member, interviewerEligible: true }, [], false), false)
  assert.equal(a.interviewerEligible(member, [], true), true)
  assert.equal(a.interviewerEligible({ ...member, status: 'LEFT' }, [], true), false)
  assert.equal(a.interviewerEligible({ ...member, user: { disabledAt: new Date() } }, [], true), false)
  assert.deepEqual(member.permissions, [])
})
test('pointer/keyboard rectangle painting adds and removes complete 15-minute ranges without changing unrelated days', () => {
  const days = Array.from({ length: 7 }, () => Array(96).fill(false))
  const painted = a.paintCells(days, { day: 2, slot: 39 }, { day: 0, slot: 36 }, true)
  assert.deepEqual(a.cellsToRanges(painted[0]), [[540, 600]])
  assert.deepEqual(a.cellsToRanges(painted[3]), [])
  const removed = a.paintCells(painted, { day: 1, slot: 37 }, { day: 1, slot: 38 }, false)
  assert.deepEqual(a.cellsToRanges(removed[1]), [[540, 555], [585, 600]])
  assert.deepEqual(a.cellsToRanges(painted[1]), [[540, 600]])
})
test('autosaves serialize requests, preserve edits during a save and keep failed edits for retry', async () => {
  let release, calls = []
  const queue = new AvailabilitySaveQueue({ schedule: declared(), revision: 1 }, async value => { calls.push(structuredClone(value)); if (calls.length === 1) await new Promise(resolve => release = resolve); return { ...value, revision: value.revision + 1 } }, () => {}, 10000)
  const one = declared(); one.weekly[0] = [[540, 615]]; queue.change(one)
  const flight = queue.flush(); queue.change({ ...one, exceptions: { '2026-10-12': [] } }); release(); await flight
  assert.deepEqual(calls.map(call => call.revision), [1, 2]); assert.equal(queue.document.revision, 3); assert.equal(queue.dirty, false)
  assert.deepEqual(queue.document.schedule.exceptions, { '2026-10-12': [] }); queue.dispose()
  let fail = true
  const failed = new AvailabilitySaveQueue({ schedule: declared(), revision: 3 }, async value => { if (fail) throw Error('offline'); return { ...value, revision: 4 } }, () => {}, 10000)
  failed.change(one); await assert.rejects(failed.flush(), /offline/); assert.equal(failed.dirty, true); assert.equal(failed.document.revision, 3)
  fail = false; await failed.flush(); assert.equal(failed.dirty, false); assert.equal(failed.state, 'saved'); failed.dispose()
})

test('the shared window has 52 quarter-hours on every day and exact DST-aware boundaries', () => {
  const c = load('lib/scheduling-config.ts')
  assert.equal(c.AVAILABILITY_SLOTS.length, 52)
  assert.equal(c.AVAILABILITY_SLOTS[0], 32); assert.equal(c.AVAILABILITY_SLOTS.at(-1), 83)
  assert.equal(c.minuteLabel(480), '8:00 AM'); assert.equal(c.minuteLabel(1245), '8:45 PM'); assert.equal(c.minuteLabel(1260), '9:00 PM')
  for (const [week, utcHour] of [['2026-03-02', 13], ['2026-03-09', 12], ['2026-10-26', 12], ['2026-11-02', 13]]) {
    for (const day of a.weekCells(week, c.SCHEDULING_TIMEZONE)) {
      for (const slot of c.AVAILABILITY_SLOTS) assert.equal(day[slot].end - day[slot].start, 900000)
      const offset = day[32].date >= '2026-03-08' && day[32].date < '2026-11-01' ? 12 : 13
      assert.equal(new Date(day[32].start).getUTCHours(), offset)
      assert.equal(a.localParts(day[83].end, c.SCHEDULING_TIMEZONE).minute, 1260)
    }
    assert.equal(new Date(a.weekCells(week, c.SCHEDULING_TIMEZONE)[0][32].start).getUTCHours(), utcHour)
  }
})
test('editing, clearing and copying visible hours retain overnight recurrence and exceptions', () => {
  const s = declared(); s.weekly[0] = [[0, 60], [480, 1260], [1380, 1440]]
  s.exceptions['2026-10-13'] = [[60, 120], [600, 660], [1320, 1380]]
  let days = a.availabilityEditorDays(s, '2026-10-12', true)
  days[0] = days[0].map(() => false)
  const cleared = a.editAvailabilityDays(s, '2026-10-12', true, days, [0])
  assert.deepEqual(cleared.weekly[0], [[0, 60], [1380, 1440]])
  a.validateAvailabilityEdit(cleared, s)
  days = a.availabilityEditorDays(s, '2026-10-12', false); days[1] = [...days[0]]
  const copied = a.editAvailabilityDays(s, '2026-10-12', false, days, [1])
  assert.deepEqual(copied.exceptions['2026-10-13'], [[60, 120], [480, 1260], [1320, 1380]])
  a.validateAvailabilityEdit(copied, s)
  const restored = a.restoreVisibleRecurring(s, '2026-10-13')
  assert.deepEqual(restored.exceptions['2026-10-13'], [[60, 120], [1320, 1380]])
  a.validateAvailabilityEdit(restored, s)
  assert.deepEqual(s.exceptions['2026-10-13'], [[60, 120], [600, 660], [1320, 1380]])
})
test('new hidden selections are rejected while saved legacy hours and zone conversions remain valid', () => {
  for (const range of [[465, 480], [1260, 1275], [0, 1440]]) {
    const next = declared(); next.weekly[0] = [range]
    assert.throws(() => a.validateAvailabilityEdit(next, a.emptySchedule()), /8:00 AM and 9:00 PM/)
    next.weeklySubmitted = false
    assert.throws(() => a.validateAvailabilityEdit(next, a.emptySchedule()), /8:00 AM and 9:00 PM/)
    next.weekly[0] = []; next.exceptions['2026-10-12'] = [range]
    assert.throws(() => a.validateAvailabilityEdit(next, a.emptySchedule()), /8:00 AM and 9:00 PM/)
  }
  const boundary = declared(); boundary.weekly[0] = [[480, 495], [1245, 1260]]
  a.validateAvailabilityEdit(boundary, a.emptySchedule())
  const legacy = declared('UTC'); legacy.weekly[0] = [[0, 1440]]
  const days = a.availabilityEditorDays(legacy, '2026-10-12', false)
  assert.equal(days[0][32], true)
  days[0][36] = false
  const edit = a.editAvailabilityDays(legacy, '2026-10-12', false, days, [0])
  a.validateAvailabilityEdit(edit, legacy)
  assert.equal(edit.timezone, 'UTC'); assert.deepEqual(edit.weekly, legacy.weekly)
  assert.equal(a.intervalAvailability(edit, instant('2026-10-12T13:00Z'), instant('2026-10-12T13:15Z')), 'unavailable')
  assert.equal(a.intervalAvailability(edit, instant('2026-10-12T02:00Z'), instant('2026-10-12T02:15Z')), 'available')
  assert.throws(() => a.validateAvailabilityEdit({ ...boundary, timezone: 'UTC' }, a.emptySchedule()), /Eastern Time/)
})
test('calendar timestamp projections and exports use Eastern Time independently of the host zone', () => {
  const calendar = load('lib/calendar.ts'), student = load('lib/student-calendar-data.ts')
  const previous = process.env.TZ
  try {
    for (const zone of ['America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = zone
      const rows = student.studentCalendarEvents({ applications: [{ clubId: 'c', club: { name: 'Club' }, bookings: [{ id: 'b', slot: { startTime: '2026-11-01T01:00:00Z', endTime: '2026-11-01T01:30:00Z', location: 'Hall' } }] }] })
      assert.equal(rows[0].date, '2026-10-31'); assert.equal(rows[0].time, '9:00 PM')
      assert.ok(calendar.calendarFile(rows[0]).includes('DTSTART:20261101T010000Z'))
      assert.equal(calendar.eventStart({ date: '2026-03-09', time: '8:00 AM' }).toISOString(), '2026-03-09T12:00:00.000Z')
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})
test('legacy exception knowledge follows the Eastern editing day across native date boundaries', () => {
  const schedule = a.emptySchedule('Asia/Tokyo')
  schedule.exceptions['2026-10-12'] = [[0, 1440]]
  assert.equal(a.availabilityEditorKnownDays(schedule, '2026-10-12')[0], false)
  schedule.exceptions['2026-10-13'] = [[0, 1440]]
  assert.equal(a.availabilityEditorKnownDays(schedule, '2026-10-12')[0], true)
  const days = a.availabilityEditorDays(schedule, '2026-10-12', false)
  assert.equal(days[0][32], true); assert.equal(days[0][83], true)
})
test('new demo interviews use the same Eastern wall clock in winter and summer', () => {
  const { createDemoSeed } = load('lib/demo/seed.ts')
  for (const [anchor, utcHour] of [['2026-02-02', 15], ['2026-07-06', 14]]) {
    const seed = createDemoSeed(anchor), slot = seed.interviewRooms[0].slots[1]
    assert.equal(new Date(slot.startTime).getUTCHours(), utcHour)
    assert.equal(a.localParts(new Date(slot.startTime), 'America/New_York').minute, 600)
  }
})
