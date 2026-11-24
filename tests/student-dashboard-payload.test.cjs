const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const source = fs.readFileSync(path.join(__dirname, "..", "actions", "applications.ts"), "utf8")
const dashboard = source.slice(source.indexOf("export async function getStudentDashboardData"), source.indexOf("function dashboardApplication"))

test("student home sends interview times, not the slot's panel and staffing fields", () => {
  assert.doesNotMatch(dashboard, /slot: true/)
  assert.match(dashboard, /slot: \{ select: \{ id: true, startTime: true, endTime: true, location: true \} \}/)
})

test("student home leaves meeting agendas, recaps and resources on the meeting page", () => {
  assert.match(dashboard, /event: \{\s*select: \{ id: true, clubId: true, title: true, date: true, endDate: true, allDay: true, location: true, description: true, club: \{ select: \{ name: true \} \} \}/)
})

test("student home keeps only a club's logo settings from its public page content", () => {
  assert.match(dashboard, /applications: applications\.map\(dashboardApplication\)/)
  assert.match(source, /marketing: \{ logoBackground, logoOnBrand \}/)
  assert.match(dashboard, /answers: \{ select: \{ questionId: true, response: true \} \}/)
})
