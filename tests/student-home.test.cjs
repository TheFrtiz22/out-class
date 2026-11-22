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
  model.require = (name) => (name.startsWith("@/") ? load(name.slice(2) + ".ts") : require(name))
  model._compile(source, filename)
  return model.exports
}
const { homeApplications, upcomingAgenda, ongoingAgenda, nextHomeAction, relevantUpdates } =
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
test("events under way are listed for the app's Happening now card; the agenda stays future-only", () => {
  const at = (minutes) => new Date(now.getTime() + minutes * 60_000).toISOString()
  const timed = (id, from, to, type = "Other", extra = {}) =>
    event(id, "2026-09-21", "00:00", type, { startTime: at(from), ...(to === null ? {} : { endTime: at(to) }), ...extra })
  const rows = [
    timed("started", -30, 30),
    timed("ended", -120, -60),
    timed("panel", -15, null, "Interview", { durationMinutes: 30 }),
    timed("short", -60, null),
    timed("declined", -10, 20, "Interview", { response: "declined" }),
    timed("leaders", -10, 20, "Other", { forLeaders: true }),
    timed("allday", -10, 20, "Other", { allDay: true }),
    timed("next", 60, 120),
  ]
  assert.deepEqual(ongoingAgenda(rows, now).map((row) => row.id), ["started", "panel"])
  assert.deepEqual(upcomingAgenda(rows, now).map((row) => row.id), ["next"])
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
  assert.equal(nextHomeAction([], [], now).kind, "explore")
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

test("urgent unread updates become the next action without displacing an imminent appointment", () => {
  const notification = {id:"urgent",title:"Booking opens",body:"Choose a time",urgent:true,read:false,createdAt:now.toISOString()}
  const drafts = homeApplications([app()], [], [])
  assert.equal(nextHomeAction(drafts, [], now, [notification]).kind, "notification")
  assert.equal(nextHomeAction(drafts, [], now, [{...notification, read:true}]).kind, "application")
  assert.equal(nextHomeAction([], [], now, [notification]).notification.id, "urgent")
  const imminent = event("soon", "2026-09-21", "11:00 AM")
  assert.equal(nextHomeAction(drafts, [imminent], now, [notification]).kind, "event")
})

test("members-only meetings for club leaders stay off student Home but remain calendar events", () => {
  const meetings = [
    { id: "lead", clubId: "pcg", date: "2026-09-21T15:00:00Z", title: "Final Round Deliberations", location: "Rice", audience: "MEMBERS", forLeaders: true, club: { name: "PCG" } },
    { id: "gbm", clubId: "pcg", date: "2026-09-21T16:00:00Z", title: "General body meeting", location: "Rice", audience: "MEMBERS", forLeaders: false, club: { name: "PCG" } },
  ]
  const events = studentCalendarEvents({ meetings })
  assert.deepEqual(events.map(event => [event.title, !!event.forLeaders]), [["Final Round Deliberations", true], ["General body meeting", false]])
  const agenda = upcomingAgenda(events, now)
  assert.deepEqual(agenda.map(event => event.title), ["General body meeting"])
  const next = nextHomeAction([], agenda, now)
  assert.equal(next.kind, "event"); assert.equal(next.event.title, "General body meeting")
  assert.equal(nextHomeAction([], upcomingAgenda(events.slice(0, 1), now), now).kind, "explore")
})
