const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const clubId = '00000000-0000-4000-8000-000000000001'
const applicationId = '00000000-0000-4000-8000-000000000002'
const slotId = '00000000-0000-4000-8000-000000000003'
function load(file, prisma, role = async () => ({})) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mocks = { '@/utils/prisma': { prisma }, '@/utils/auth': { requireAuth: async () => ({ user: { id: 'student' } }), requireClubPermission: role }, 'next/cache': { revalidatePath() {} } }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name === "@/lib/test-scores" ? load("lib/test-scores.ts") : require(name), mod, mod.exports)
  return mod.exports
}
test('event reads filter private events and attendees by the authorized club', async () => {
  const api = load('actions/events.ts', {
    event: { findMany: async ({ where }) => { assert.deepEqual(where, { clubId, isPublic: true }); return [] } },
    eventAttendance: { findMany: async ({ where, include }) => { assert.deepEqual(where, { eventId: 'foreign-event', event: { clubId } }); assert.equal(include.student.omit.passwordHash, true); return [] } },
  })
  await api.getClubEvents(clubId)
  assert.deepEqual(await api.getEventAttendees('foreign-event', clubId), { attendees: [] })
})
test('private event attendance requires membership before writing', async () => {
  let wrote = false
  const api = load('actions/events.ts', { event: { findUnique: async () => ({ clubId, isPublic: false }) }, eventAttendance: { upsert: async () => { wrote = true } } }, async () => { throw new Error('Forbidden') })
  await assert.rejects(api.recordEventAttendance('private'), /Forbidden/)
  assert.equal(wrote, false)
})
function bookingApi(overrides = {}) {
  const slot = { id: slotId, clubId, startTime: new Date(Date.now() + 60000), capacity: 1, bookings: [], ...overrides }
  let writes = 0
  const tx = { application: { findUnique: async () => ({ id: applicationId, studentId: 'student', clubId }) }, interviewSlot: { findUnique: async () => slot }, interviewBooking: { create: async ({ data }) => { writes++; return { id: 'booking', ...data } } } }
  return { api: load('actions/scheduling.ts', { $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(tx) } }), writes: () => writes }
}
test('booking rejects foreign clubs, past slots, and full slots without writes', async () => {
  for (const override of [{ clubId: 'foreign' }, { startTime: new Date(0) }, { bookings: [{ applicationId: 'other' }] }]) {
    const { api, writes } = bookingApi(override)
    await assert.rejects(api.bookInterviewSlot({ slotId, applicationId }))
    assert.equal(writes(), 0)
  }
})
test('booking retries are idempotent and normal bookings succeed', async () => {
  const existing = { id: 'existing', applicationId }
  const first = bookingApi({ bookings: [existing] })
  assert.equal((await first.api.bookInterviewSlot({ slotId, applicationId })).booking.id, 'existing')
  assert.equal(first.writes(), 0)
  const second = bookingApi()
  assert.equal((await second.api.bookInterviewSlot({ slotId, applicationId })).booking.id, 'booking')
  assert.equal(second.writes(), 1)
})
test('available slots expose counts without leaking applicant identifiers', async () => {
  const api = load('actions/scheduling.ts', { interviewSlot: { findMany: async ({ include }) => { assert.deepEqual(include, { _count: { select: { bookings: true } } }); return [{ capacity: 1, _count: { bookings: 0 } }, { capacity: 1, _count: { bookings: 1 } }] } } })
  assert.equal((await api.getAvailableSlots(clubId)).slots.length, 1)
})
test('interview blocks reject reversed dates before writing', async () => {
  const api = load('actions/scheduling.ts', {})
  await assert.rejects(api.createInterviewSlots({ clubId, slots: [{ startTime: new Date(2000), endTime: new Date(1000), location: 'Hall', capacity: 1 }] }))
})
