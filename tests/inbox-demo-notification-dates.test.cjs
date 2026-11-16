// OUT-CLASS-D: a saved Demo snapshot revives ISO strings as Dates. Interview-assignment notices fed those Dates
// into Notification.fullDate, which the Inbox renders as text, and React refused to render a Date child.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const { harness } = require("./helpers/demo-harness.cjs")

test("Demo inbox notifications keep string dates after a saved snapshot is reloaded", () => {
  const h = harness(), { demoStore, demoNotifications } = h.load("lib/demo/store.ts")
  demoStore.start()
  demoStore.mutate(s => { s.perspective = { role: "leader", clubId: s.clubs[0].id } })
  const before = demoNotifications().filter(n => n.senderTitle === "Interview assignment")
  assert.ok(before.length > 0, "the leader demo has interview-assignment notices")
  // Reload from the saved snapshot, as a page navigation does.
  demoStore.stop()
  demoStore.start()
  const rows = demoNotifications()
  assert.ok(rows.some(n => n.senderTitle === "Interview assignment"))
  for (const n of rows) {
    assert.equal(typeof n.fullDate, "string", `${n.id} fullDate`)
    assert.equal(typeof n.createdAt, "string", `${n.id} createdAt`)
    assert.ok(Number.isFinite(Date.parse(n.createdAt)), `${n.id} createdAt parses`)
  }
})
