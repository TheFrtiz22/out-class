// Interview schedule › Confirm interviewers: after a leader lowers a room from 2 to 1 interviewers per slot and
// regenerates, every session kept asking for 2, so the draft showed "1 needed" on staffed slots and could not be
// published fully staffed.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const code = ts.transpileModule(fs.readFileSync("lib/panel-required.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod = { exports: {} }
new Function("require", "module", "exports", code)(require, mod, mod.exports)
const { regeneratedRequired } = mod.exports

test("a room's new interviewers-per-slot figure replaces the draft's old one", () => {
  // The draft followed the room (2 of 2); the room now needs 1.
  assert.equal(regeneratedRequired(1, { required: 2, originalRequired: 2 }), 1)
  assert.equal(regeneratedRequired(3, { required: 2, originalRequired: 2 }), 3)
})

test("a leader's own change to one draft session survives regeneration while the room is unchanged", () => {
  assert.equal(regeneratedRequired(2, { required: 3, originalRequired: 2 }), 3)
  // ...but not once the room itself changes.
  assert.equal(regeneratedRequired(1, { required: 3, originalRequired: 2 }), 1)
})

test("new sessions and closed-room sessions use the room's figure", () => {
  assert.equal(regeneratedRequired(2, undefined), 2)
  assert.equal(regeneratedRequired(2, { required: 1 }), 2)
  assert.equal(regeneratedRequired(2, { required: 1, originalRequired: 1, unstaffOnly: true }), 2)
})

test("panel regeneration uses the helper", () => {
  const action = fs.readFileSync("actions/panel-proposals.ts", "utf8")
  assert.match(action, /required: regeneratedRequired\(s\.required, baseline\)/)
})
