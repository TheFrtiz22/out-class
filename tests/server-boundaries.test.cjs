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
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith("@/lib/") || name === "@/actions/meetings" ? load(name.replace("@/", "")+".ts", prisma, role) : require(name), mod, mod.exports)
  return mod.exports
}
test('legacy event reads expose public recruitment metadata only', async () => {
  const api=load('actions/events.ts',{meeting:{findMany:async({where,select})=>{assert.deepEqual(where,{clubId,isPublic:true,audience:'RECRUITMENT'});assert.equal(select.resources,undefined);return []}}})
  assert.deepEqual(await api.getClubEvents(clubId),{events:[]})
})
test('legacy static attendance endpoints fail closed without a current token',async()=>{
  const api=load('actions/events.ts',{})
  await assert.rejects(api.recordEventAttendance('old-id'),/current meeting QR code/)
})
function bookingApi(overrides = {}, status = "INTERVIEWING") {
  const slot = { id: slotId, clubId, startTime: new Date(Date.now() + 60000), capacity: 1, bookings: [], ...overrides }
  let writes = 0
  const tx = { application: { findUnique: async () => ({ id: applicationId, studentId: 'student', clubId, status }) }, interviewSlot: { findUnique: async () => slot }, interviewBooking: { create: async ({ data }) => { writes++; return { id: 'booking', ...data } } } }
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

test('draft, submitted and decided applicants cannot reserve interview capacity', async () => {
  for (const status of ['DRAFTING','SUBMITTED','IN_REVIEW','ACCEPTED','REJECTED','WAITLISTED']) {
    const h=bookingApi({},status)
    await assert.rejects(h.api.bookInterviewSlot({slotId,applicationId}), /interview invitation/)
    assert.equal(h.writes(),0)
  }
})
