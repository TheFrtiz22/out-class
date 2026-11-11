const {unwrapActions}=require('./helpers/action-result.cjs');
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { harness } = require("./helpers/demo-harness.cjs")

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

test("room names are free text, trimmed, never blank and capped at 60 characters", () => {
  const core = harness().load("lib/interview-rooms.ts")
  assert.equal(core.UVA_ROOM_BOOKING_URL, "https://25live.collegenet.com/pro/virginia#!/home/dash")
  assert.equal(core.normalizeRoomName("  Clark Library Study Room B  ", "Old"), "Clark Library Study Room B")
  assert.equal(core.normalizeRoomName("   ", "Rice Hall 340"), "Rice Hall 340")
  assert.equal(core.normalizeRoomName("x".repeat(80), "Old").length, 60)
  const ok = core.roomRenameSchema.parse({ clubId: id(1), roomId: id(2), name: "  Zoom backup " })
  assert.equal(ok.name, "Zoom backup")
  assert.throws(() => core.roomRenameSchema.parse({ clubId: id(1), roomId: id(2), name: "  " }), /Name your room/)
  assert.throws(() => core.roomRenameSchema.parse({ clubId: id(1), roomId: id(2), name: "x".repeat(61) }), /60 characters/)
  assert.throws(() => core.roomRenameSchema.parse({ clubId: id(1), roomId: id(2), name: "A", extra: 1 }))
})

test("demo rename and 25Live tracking persist through the client boundary without server calls", async () => {
  const h = harness(), { demoStore } = h.load("lib/demo/store.ts"), api = h.load("lib/workspace-api.ts")
  demoStore.start()
  let clubId, roundId
  demoStore.mutate(s => { const c = s.clubs[0]; clubId = c.id; roundId = c.rounds[0].id; c.rounds[0].type = "INTERVIEW"; s.perspective = { role: "leader", clubId }; s.interviewRooms = []; s.roomBookings = [] })
  const base = { clubId, roundId, kind: "IN_PERSON", timezone: "America/New_York", dates: ["2099-09-07"], start: "10:00", end: "12:00", duration: 20, buffer: 0, capacity: 1, interviewersNeeded: 1, panelMemberIds: [] }
  await api.createInterviewRoom({ ...base, name: "Room A", location: "Hall A" })
  await api.createInterviewRoom({ ...base, name: "Room B", location: "Hall B" })
  let workspace = await api.getRoomWorkspace(clubId)
  const a = workspace.rooms.find(r => r.name === "Room A"), b = workspace.rooms.find(r => r.name === "Room B")
  assert.ok(!a.externallyBookedAt)

  assert.deepEqual(await api.renameInterviewRoom({ clubId, roomId: a.id, name: "  Rice Hall 340 " }), { name: "Rice Hall 340" })
  // Another open room with overlapping times cannot take the same name (names identify physical rooms).
  await assert.rejects(api.renameInterviewRoom({ clubId, roomId: b.id, name: "rice hall 340" }), /overlapping/)
  await assert.rejects(api.renameInterviewRoom({ clubId, roomId: b.id, name: " " }), /Name your room/)

  const marked = await api.setInterviewRoomExternallyBooked({ clubId, roomId: a.id, booked: true })
  assert.ok(marked.externallyBookedAt)
  demoStore.start()
  workspace = await api.getRoomWorkspace(clubId)
  const renamed = workspace.rooms.find(r => r.id === a.id)
  assert.equal(renamed.name, "Rice Hall 340")
  assert.equal(renamed.location, "Hall A")
  assert.equal(renamed.externallyBookedAt, marked.externallyBookedAt)
  assert.equal((await api.setInterviewRoomExternallyBooked({ clubId, roomId: a.id, booked: false })).externallyBookedAt, null)

  demoStore.mutate(s => { s.perspective = { role: "student" } })
  await assert.rejects(api.renameInterviewRoom({ clubId, roomId: a.id, name: "Mine" }), /manager/)
  await assert.rejects(api.setInterviewRoomExternallyBooked({ clubId, roomId: a.id, booked: true }), /manager/)
  assert.equal(h.calls(), 0)
})

// Real server actions (actions/interview-rooms.ts) through the real authorizeClubTransaction and
// club-suspension helpers; only Prisma, auth identity and next/cache are mocked.
function actionHarness() {
  const ts = require("typescript"), path = require("node:path")
  const clubA = id(1), clubB = id(11), slot = (n, room) => ({ id: id(400 + n), roomId: room, startTime: new Date("2099-09-07T14:00Z"), endTime: new Date("2099-09-07T14:20Z") })
  const state = {
    user: id(6), suspended: new Set(), updates: [], audit: [],
    members: { [clubA]: { status: "ACTIVE", permissions: ["interviews.manage"] }, [clubB]: { status: "ACTIVE", permissions: ["applications.review"] } },
    rooms: [
      { id: id(3), clubId: clubA, name: "Hall A", location: "Hall A", buffer: 0, isOpen: true, booked: false, externallyBookedAt: null, slots: [slot(1, id(3))] },
      { id: id(4), clubId: clubA, name: "Hall B", location: "Hall B", buffer: 0, isOpen: true, booked: false, externallyBookedAt: null, slots: [slot(2, id(4))] },
      { id: id(5), clubId: clubA, name: "Hall C", location: "Hall C", buffer: 0, isOpen: false, booked: false, externallyBookedAt: null, slots: [slot(3, id(5))] },
      { id: id(12), clubId: clubB, name: "Other club room", location: "Elsewhere", buffer: 0, isOpen: true, booked: false, externallyBookedAt: null, slots: [] },
    ],
  }
  const room = r => ({ ...r, slots: r.slots.map(s => ({ ...s })) })
  const tx = {
    $queryRaw: async (strings, ...values) => strings.join("?").includes('"suspendedAt" IS NOT NULL') && state.suspended.has(values[0]) ? [{ id: values[0] }] : [],
    user: { findUnique: async () => ({ disabledAt: null }) },
    clubMember: { findUnique: async ({ where }) => where.userId_clubId.userId === id(6) ? state.members[where.userId_clubId.clubId] ?? null : null },
    interviewRoom: {
      findFirst: async ({ where }) => { const r = state.rooms.find(r => r.id === where.id && r.clubId === where.clubId); return r ? room(r) : null },
      findMany: async ({ where }) => {
        assert.equal(where.name.mode, "insensitive")
        return state.rooms.filter(r => r.clubId === where.clubId && r.id !== where.id.not && r.name.toLowerCase() === where.name.equals.toLowerCase() && (r.isOpen || r.booked)).map(room)
      },
      update: async ({ where, data }) => { state.updates.push({ id: where.id, data }); Object.assign(state.rooms.find(r => r.id === where.id), data) },
    },
    auditLog: { create: async ({ data }) => state.audit.push(data) },
  }
  const mocks = {
    "@/utils/auth": { requireAuth: async () => ({ user: { id: state.user } }), requireClubPermission: async () => { throw Error("not used") } },
    "@/utils/prisma": { prisma: { $transaction: async (fn, opts) => { assert.ok(opts && ["Serializable", "ReadCommitted"].includes(opts.isolationLevel), "uses atomic()"); const before = JSON.stringify(state.rooms); try { return await fn(tx) } catch (e) { state.rooms = JSON.parse(before, (k, v) => /Time$/.test(k) ? new Date(v) : v); throw e } } } },
    "@/utils/applicant-booking-notifications": { notifyApplicantBooking: async () => {} },
    "@/utils/interview-booking": { interviewBookingCoverage: async () => [] },
    "next/cache": { revalidatePath() {} },
  }
  const cache = {}
  function load(file) {
    const absolute = path.resolve(file)
    if (cache[absolute]) return cache[absolute].exports
    const mod = { exports: {} }; cache[absolute] = mod
    const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    new Function("require", "module", "exports", code)(n => n in mocks ? mocks[n] : n.startsWith("@/") ? load(n.slice(2) + ".ts") : n.startsWith(".") ? load(path.resolve(path.dirname(absolute), n) + ".ts") : require(n), mod, mod.exports)
    return mod.exports
  }
  return { state, clubA, clubB, api: unwrapActions(load("actions/interview-rooms.ts")) }
}

test("renameInterviewRoom: manager-only, club-scoped, trims, rejects overlapping same-name rooms, audits", async () => {
  const { state, clubA, clubB, api } = actionHarness()
  assert.deepEqual(await api.renameInterviewRoom({ clubId: clubA, roomId: id(3), name: "  Rice Hall 340 " }), { name: "Rice Hall 340" })
  assert.equal(state.rooms[0].name, "Rice Hall 340"); assert.equal(state.rooms[0].location, "Hall A", "location (and slot locations) unchanged")
  assert.deepEqual(state.audit.map(a => [a.action, a.targetId, a.clubId]), [["interview.room.rename", id(3), clubA]])
  // Unchanged name: no write, no audit.
  await api.renameInterviewRoom({ clubId: clubA, roomId: id(3), name: "Rice Hall 340" }); assert.equal(state.updates.length, 1); assert.equal(state.audit.length, 1)
  // Same name (any case) as another open room with overlapping times is refused; a closed, unbooked room is not a conflict.
  await assert.rejects(api.renameInterviewRoom({ clubId: clubA, roomId: id(4), name: "rice HALL 340" }), /overlapping interview times/)
  assert.equal(state.rooms[1].name, "Hall B")
  await api.renameInterviewRoom({ clubId: clubA, roomId: id(4), name: "Hall C" }); assert.equal(state.rooms[1].name, "Hall C")
  state.rooms[2].booked = true
  await assert.rejects(api.renameInterviewRoom({ clubId: clubA, roomId: id(3), name: "Hall C" }), /overlapping/)
  // Cross-club room id under a club the actor manages: same "unavailable" answer, nothing written.
  await assert.rejects(api.renameInterviewRoom({ clubId: clubA, roomId: id(12), name: "Mine" }), /Room unavailable/)
  // Member of the room's club without interviews.manage, non-member, suspended club: denied before any write.
  await assert.rejects(api.renameInterviewRoom({ clubId: clubB, roomId: id(12), name: "Mine" }), /Club access denied/)
  state.user = id(99); await assert.rejects(api.renameInterviewRoom({ clubId: clubA, roomId: id(3), name: "Mine" }), /Club access denied/); state.user = id(6)
  state.suspended.add(clubA); await assert.rejects(api.renameInterviewRoom({ clubId: clubA, roomId: id(3), name: "Mine" }), /suspended/); state.suspended.clear()
  await assert.rejects(api.renameInterviewRoom({ clubId: clubA, roomId: id(3), name: "  " }), /Name your room/)
  await assert.rejects(api.renameInterviewRoom({ clubId: clubA, roomId: id(3), name: "x".repeat(61) }), /60 characters/)
  assert.equal(state.rooms[3].name, "Other club room"); assert.equal(state.updates.length, 2); assert.equal(state.audit.length, 2)
})

test("setInterviewRoomExternallyBooked: manager-only, club-scoped, idempotent, blocked for suspended clubs, audits", async () => {
  const { state, clubA, clubB, api } = actionHarness()
  const marked = await api.setInterviewRoomExternallyBooked({ clubId: clubA, roomId: id(3), booked: true })
  assert.match(marked.externallyBookedAt, /^\d{4}-\d{2}-\d{2}T/)
  await api.setInterviewRoomExternallyBooked({ clubId: clubA, roomId: id(3), booked: true })
  assert.equal(state.updates.length, 1, "repeat mark is a no-op")
  assert.equal((await api.setInterviewRoomExternallyBooked({ clubId: clubA, roomId: id(3), booked: false })).externallyBookedAt, null)
  assert.deepEqual(state.audit.map(a => a.action), ["interview.room.external_booking.mark", "interview.room.external_booking.clear"])
  await assert.rejects(api.setInterviewRoomExternallyBooked({ clubId: clubA, roomId: id(12), booked: true }), /Room unavailable/)
  await assert.rejects(api.setInterviewRoomExternallyBooked({ clubId: clubB, roomId: id(12), booked: true }), /Club access denied/)
  state.suspended.add(clubA); await assert.rejects(api.setInterviewRoomExternallyBooked({ clubId: clubA, roomId: id(3), booked: true }), /suspended/)
  assert.equal(state.rooms[3].externallyBookedAt, null); assert.equal(state.updates.length, 2)
})

test("the 25Live flag reaches managers but never applicants", async () => {
  const ts = require("typescript"), path = require("node:path")
  const room = { id: id(3), clubId: id(1), roundId: id(2), name: "Rice Hall 340", location: "Rice Hall 340", kind: "IN_PERSON", timezone: "America/New_York", duration: 20, buffer: 0, isOpen: true, panelMemberIds: [], approvedPanelMemberIds: [], interviewersNeeded: 1, staffingRevision: 0, externallyBookedAt: new Date("2099-01-01T00:00Z"), slots: [{ id: id(4), startTime: new Date("2099-09-07T14:00Z"), endTime: new Date("2099-09-07T14:20Z"), capacity: 1, panelScheduleVersionId: null, publishedPanelMemberIds: [], interviewersNeeded: null, staffingRevision: 0, _count: { bookings: 0 } }] }
  const core = harness().load("lib/interview-rooms.ts")
  const round = { id: id(2), name: "Interview", type: "INTERVIEW", bookingPublishedAt: new Date(), bookingPaused: false, archivedAt: null, anonymousReview: false, bookingCycleId: null, bookingCycle: null, bookingAllowCancellation: true, bookingAllowRescheduling: true, bookingSlots: [core.bookingSlotSnapshot(room.slots[0], room)] }
  const tx = { application: { findFirst: async () => ({ id: id(5), studentId: id(6), clubId: id(1), roundId: id(2), status: "INTERVIEWING", recruitmentCycleId: null, club: { name: "Club", suspendedAt: null }, round }) }, interviewBooking: { findFirst: async () => null, findMany: async () => [] }, interviewRoom: { findMany: async () => [room] } }
  const prisma = { $transaction: async fn => fn(tx), recruitmentCycle: { findMany: async () => [] }, club: { findUniqueOrThrow: async () => ({ name: "Club" }) }, pipelineRound: { findMany: async () => [] }, clubMember: { findMany: async () => [] }, interviewRoom: { findMany: async () => [room] }, interviewBooking: { findMany: async () => [] } }
  const mocks = { "@/utils/auth": { requireAuth: async () => ({ user: { id: id(6) } }), requireClubPermission: async () => ({ membership: { status: "ACTIVE", permissions: ["interviews.manage"] } }) }, "@/utils/prisma": { prisma }, "@/utils/applicant-booking-notifications": { notifyApplicantBooking: async () => {} }, "@/utils/interview-booking": { interviewBookingCoverage: async () => [{ slotId: id(4), bookable: true }] }, "next/cache": { revalidatePath() {} } }
  const cache = {}
  const load = file => { const absolute = path.resolve(file); if (cache[absolute]) return cache[absolute].exports; const mod = { exports: {} }; cache[absolute] = mod; new Function("require", "module", "exports", ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith("@/") ? load(n.slice(2) + ".ts") : n.startsWith(".") ? load(path.resolve(path.dirname(absolute), n) + ".ts") : require(n), mod, mod.exports); return mod.exports }
  const api = unwrapActions(load("actions/interview-rooms.ts"))
  const manager = await api.getRoomWorkspace(id(1))
  assert.equal(manager.rooms[0].externallyBookedAt, "2099-01-01T00:00:00.000Z")
  const applicant = await api.getApplicantSchedule(id(5))
  assert.equal(applicant.rooms.length, 1); assert.equal(applicant.rooms[0].name, "Rice Hall 340")
  assert.ok(!("externallyBookedAt" in applicant.rooms[0])); assert.doesNotMatch(JSON.stringify(applicant), /2099-01-01/)
})

test("migration only adds the nullable tracking column", () => {
  const migration = fs.readFileSync("prisma/migrations/20261110120000_interview_room_external_booking/migration.sql", "utf8")
  assert.match(migration, /ADD COLUMN "externallyBookedAt" TIMESTAMP\(3\);/)
  assert.doesNotMatch(migration, /DROP|GRANT|POLICY|UPDATE "InterviewRoom"|NOT NULL|DEFAULT/)
})

test("room manager shows the 25Live notice, link, post-create reminder and per-room tracking", () => {
  const ui = fs.readFileSync("components/interviews/room-external-booking.tsx", "utf8")
  assert.match(ui, /Booking a room here only saves it in OutClass\. It does not reserve the room with UVA\. You still need to book it through 25Live\./)
  assert.match(ui, /Saved in OutClass\. Don’t forget to book this room on 25Live\./)
  assert.match(ui, /href=\{UVA_ROOM_BOOKING_URL\} target="_blank" rel="noopener noreferrer"/)
  assert.match(ui, /Not booked on 25Live yet/)
  assert.match(ui, /event\.key === "Enter"/); assert.match(ui, /event\.key === "Escape"/); assert.match(ui, /onBlur=/)
  const manager = fs.readFileSync("components/interviews/room-manager.tsx", "utf8")
  assert.match(manager, /<RoomBookingNotice \/>/)
  assert.match(manager, /setRoomReminder\(created\.kind === "IN_PERSON"\)/)
  assert.match(manager, /<EditableRoomName room=\{room\}/)
})
