// OUT-CLASS-C: GET /api/workspace?kind=notifications re-ran the schedule-version, member, owner and assignment
// reads for every panel-schedule notification. One page now shares them, and each row keeps its own checks.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")

function load(file, mocks) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "module", "exports", code)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports)
  return mod.exports
}
const panel = load("utils/official-panel-schedule.ts", {
  "@/lib/permissions": { activeMemberWhere: {} },
  "@/lib/scheduling-config": { SCHEDULING_TIMEZONE: "America/New_York", SCHEDULING_TIMEZONE_LABEL: "ET" },
  "@/lib/interview-access": { interviewCapabilities: () => ({ participate: true }) },
  "@/lib/panel-proposals": { publishedPanelDocumentSchema: { parse: value => value } },
})

const club = "c1", member = { id: "m1", clubId: club, userId: "u1" }
const before = { roomName: "Room A", timezone: "America/New_York", startTime: "2026-11-20T15:00:00.000Z", endTime: "2026-11-20T15:30:00.000Z" }
function fakeTx(versionIds, { otherClub = [] } = {}) {
  const calls = { memberFirst: 0, ownerFirst: 0, versionFirst: 0, versionMany: 0, memberMany: 0, slots: 0 }
  const version = id => ({ id, clubId: otherClub.includes(id) ? "c2" : club, roundId: "r1", publishedBy: "owner", document: {}, changes: [{ memberId: "m1", kind: "REMOVED", before }], round: { name: "Round 1", anonymousReview: false, archivedAt: null }, publisher: { disabledAt: null } })
  return {
    calls,
    clubMember: {
      findFirst: async ({ where }) => where.isOwner ? (calls.ownerFirst++, { id: "o1" }) : (calls.memberFirst++, member),
      findMany: async () => (calls.memberMany++, []),
    },
    interviewPanelScheduleVersion: {
      findFirst: async ({ where }) => (calls.versionFirst++, versionIds.includes(where.id) ? version(where.id) : null),
      findMany: async ({ where }) => (calls.versionMany++, where.id.in.filter(id => versionIds.includes(id)).map(version)),
    },
    interviewSlot: { findMany: async () => (calls.slots++, []) },
  }
}
const row = id => ({ eventKey: `panel-schedule:${id}:m1`, clubId: club, href: "/settings/interviews" })

test("a page of panel-schedule notifications reads each shared record once", async () => {
  const ids = ["v1", "v2", "v3", "v4", "v5"], tx = fakeTx(ids), lookups = panel.panelScheduleLookups(), rows = ids.map(row)
  await panel.prefetchPanelScheduleVersions(tx, lookups, [...rows, { eventKey: "task:x" }, { eventKey: null }])
  const results = await Promise.all(rows.map(n => panel.currentPanelScheduleNotification(tx, n, "u1", lookups)))
  assert.equal(results.filter(Boolean).length, 5)
  assert.deepEqual(tx.calls, { memberFirst: 1, ownerFirst: 1, versionFirst: 0, versionMany: 1, memberMany: 1, slots: 0 })
})

test("shared reads keep every per-row check: another club's version is refused", async () => {
  const tx = fakeTx(["v1", "v2"], { otherClub: ["v2"] }), lookups = panel.panelScheduleLookups()
  await panel.prefetchPanelScheduleVersions(tx, lookups, [row("v1"), row("v2"), row("missing")])
  assert.ok(await panel.currentPanelScheduleNotification(tx, row("v1"), "u1", lookups))
  assert.equal(await panel.currentPanelScheduleNotification(tx, row("v2"), "u1", lookups), null)
  assert.equal(await panel.currentPanelScheduleNotification(tx, row("missing"), "u1", lookups), null)
})

test("callers without a page cache (email delivery) behave as before", async () => {
  const tx = fakeTx(["v1"]), result = await panel.currentPanelScheduleNotification(tx, row("v1"), "u1")
  assert.match(result.title, /Panel assignment cancelled · Round 1/)
  assert.equal(tx.calls.versionMany, 1)
})

test("the Inbox loader prefetches versions and passes one cache to every row", () => {
  const source = fs.readFileSync("actions/communications.ts", "utf8")
  assert.match(source, /prefetchPanelScheduleVersions\(tx, panelLookups, rows\.slice\(0, 50\)\)/)
  assert.match(source, /currentPanelScheduleNotification\(tx,row,user\.id,panelLookups\)/)
})
