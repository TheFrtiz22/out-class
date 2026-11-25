const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { loadComponent } = require("./helpers/component-module.cjs")

test("panel cards name the place once when it matches the room or is blank", () => {
  const { roomPlaceLabel } = loadComponent("lib/interview-entry.ts")
  assert.equal(roomPlaceLabel("QA Room 1", "QA Room 1"), "QA Room 1")
  assert.equal(roomPlaceLabel("Panel A", " panel a "), "Panel A")
  assert.equal(roomPlaceLabel("Panel A", ""), "Panel A")
  assert.equal(roomPlaceLabel("Panel A", null), "Panel A")
  assert.equal(roomPlaceLabel("Panel A", "Thornton Hall E316"), "Panel A · Thornton Hall E316")
})

test("the web and app schedule cards use the de-duplicated label, and past panels read Past", () => {
  const web = fs.readFileSync("components/interviews/my-panel-schedule.tsx", "utf8")
  assert.match(web, /roomPlaceLabel\(s\.roomName,s\.location\)/)
  assert.doesNotMatch(web, /\{s\.roomName\} · \{s\.location\}/)
  assert.match(web, />Past<\/span>/)
  const app = fs.readFileSync("mobile/src/app/settings/interviews.tsx", "utf8")
  assert.match(app, /\{roomPlace\(panel\)\}/)
  assert.doesNotMatch(app, /\{panel\.roomName\} · \{panel\.location\}/)
})
