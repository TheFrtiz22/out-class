const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const Module = require("node:module")
const path = require("node:path")
function load(findMany) {
  const filename = path.resolve(__dirname, "../lib/launch-clubs.ts")
  const mod = new Module(filename, module)
  mod.require = name => name === "@/utils/prisma" ? { prisma: { club: { findMany } } } : require(name)
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename)
  return mod.exports
}
test("launch participants require explicit UVA marketing approval and expose only public identity", async () => {
  let query
  const records = [{ id: "approved", name: "Approved club", logoUrl: null }]
  const { getLaunchClubs } = load(async args => { query = args; return records })
  assert.deepEqual(await getLaunchClubs(), records)
  assert.deepEqual(query.where, { campusKey: "uva", marketingApprovedAt: { not: null } })
  assert.deepEqual(query.select, { id: true, name: true, logoUrl: true })
})
test("unavailable database or unapplied migration never substitutes demo partnerships", async () => {
  const { getLaunchClubs } = load(async () => { throw new Error("database unavailable") })
  assert.deepEqual(await getLaunchClubs(), [])
})
