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

test("server actions authorize in the transaction, audit, and never expose the 25Live flag to applicants", () => {
  const src = fs.readFileSync("actions/interview-rooms.ts", "utf8")
  for (const fn of ["renameInterviewRoom", "setInterviewRoomExternallyBooked"]) {
    const body = src.slice(src.indexOf(`export async function ${fn}`), src.indexOf("export async function", src.indexOf(`export async function ${fn}`) + 10))
    assert.match(body, /authorizeClubTransaction\(tx, input\.clubId, user\.id, \["interviews\.manage"\]\)/)
    assert.match(body, /findFirst\(\{ where: \{ id: input\.roomId, clubId: input\.clubId \}/)
    assert.match(body, /auditLog\.create/)
  }
  assert.match(src, /\.\.\.\(!applicant \? \{ externallyBookedAt:/)
  const migration = fs.readFileSync("prisma/migrations/20261110120000_interview_room_external_booking/migration.sql", "utf8")
  assert.match(migration, /ADD COLUMN "externallyBookedAt" TIMESTAMP\(3\);/)
  assert.doesNotMatch(migration, /DROP|GRANT|POLICY|UPDATE "InterviewRoom"/)
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
