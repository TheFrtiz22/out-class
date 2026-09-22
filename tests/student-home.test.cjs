const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const Module = require("node:module")
const path = require("node:path")
function load(file) {
  const filename = path.resolve(__dirname, "..", file)
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const model = new Module(filename, module)
  model.require = (name) => (name === "@/lib/calendar" ? load("lib/calendar.ts") : require(name))
  model._compile(source, filename)
  return model.exports
}
const { homeApplications, upcomingAgenda, nextHomeAction, relevantUpdates } =
  load("lib/student-home.ts")
const { studentCalendarEvents } = load("lib/student-calendar-data.ts")
const now = new Date("2026-09-21T10:00:00")
const local = [
  {
    id: "local",
    clubId: "local",
    clubName: "Browser draft",
    color: "#000",
    status: "Drafting",
    questionsCompleted: 2,
    questionsTotal: 3,
  },
]
const app = (status = "DRAFTING", id = "real") => ({
  id,
  clubId: id,
  status,
  club: { name: id, color: null },
  answers: [{ response: "" }, { response: "Saved response" }],
})
const event = (id, date, time, type = "Interview", extra = {}) => ({
  id,
  date,
  time,
  type,
  clubId: "real",
  club: "Real club",
  title: id,
  ...extra,
})
test("empty persisted applications never fall back to local drafts or invented completion", () => {
  assert.deepEqual(homeApplications([], local, []), [])
  const [real] = homeApplications([app()], local, [])
  assert.equal(real.id, "real")
  assert.equal(real.responsesSaved, 1)
  assert.equal(real.deadline, undefined)
  assert.equal(homeApplications(null, local, [])[0].responsesSaved, undefined)
})
test("decisions are retained but ordered behind drafts and active applications", () => {
  const rows = homeApplications(
    [
      app("ACCEPTED", "accepted"),
      app("IN_REVIEW", "review"),
      app("DRAFTING", "draft"),
      app("WAITLISTED", "waitlisted"),
      app("REJECTED", "rejected"),
    ],
    [],
    [],
  )
  assert.equal(rows[0].id, "draft")
  assert.equal(rows.filter((row) => !row.closed).length, 3)
  assert.ok(rows.slice(-2).every((row) => row.closed))
})
test("agenda excludes declined, past, invalid, and deadline entries and sorts future meetings", () => {
  const rows = upcomingAgenda(
    [
      event("later", "2026-09-23", "12:00"),
      event("next", "2026-09-21", "11:00"),
      event("past", "2026-09-20", "12:00"),
      event("bad", "bad", "12:00"),
      event("declined", "2026-09-22", "12:00", "Interview", { response: "declined" }),
      event("due", "2026-09-22", "12:00", "Deadline"),
    ],
    now,
  )
  assert.deepEqual(
    rows.map((row) => row.id),
    ["next", "later"],
  )
})
test("the nearest time-sensitive action wins without turning unknown deadlines into urgency", () => {
  const deadline = event("deadline", "2026-09-21", "12:00", "Deadline")
  const apps = homeApplications([app()], [], [deadline])
  assert.equal(nextHomeAction(apps, [event("meeting", "2026-09-21", "11:00")], now).kind, "event")
  assert.equal(
    nextHomeAction(apps, [event("meeting", "2026-09-22", "11:00")], now).kind,
    "application",
  )
  assert.equal(nextHomeAction(homeApplications([app()], [], []), [], now).kind, "application")
  assert.equal(nextHomeAction([], [], now).kind, "discover")
})
test("persisted bookings and attendances keep their timestamps, location, and safe calendar identity", () => {
  const source = {
    applications: [
      {
        clubId: "real",
        club: { name: "Real club" },
        bookings: [
          {
            id: "b",
            slot: {
              startTime: "2026-09-22T15:30:00Z",
              endTime: "2026-09-22T16:00:00Z",
              location: "Room 4",
            },
          },
        ],
      },
    ],
    attendances: [
      {
        id: "attendance",
        event: {
          clubId: "real",
          date: new Date("2026-09-23T18:00:00Z"),
          title: "Meeting",
          location: "The Lawn",
        },
      },
    ],
  }
  const rows = studentCalendarEvents(source)
  const booking = rows.find((row) => row.id === "booking-b")
  assert.equal(booking.type, "Interview")
  assert.equal(booking.durationMinutes, 30)
  assert.equal(booking.location, "Room 4")
  assert.equal(booking.readOnly, true)
  assert.equal(booking.bookingSlotId, undefined) // Never invoke the unrelated demo cancellation flow.
  const { eventStart } = load("lib/calendar.ts")
  assert.equal(eventStart(booking).toISOString(), "2026-09-22T15:30:00.000Z")
  assert.equal(eventStart(rows[0]).toISOString(), "2026-09-23T18:00:00.000Z")
})
test("updates prioritize unread urgent messages without mutating inbox order", () => {
  const rows = [
    { id: "read", read: true, urgent: true },
    { id: "normal", read: false, urgent: false },
    { id: "urgent", read: false, urgent: true },
  ]
  assert.deepEqual(
    relevantUpdates(rows).map((row) => row.id),
    ["urgent", "normal", "read"],
  )
  assert.equal(rows[0].id, "read")
})
