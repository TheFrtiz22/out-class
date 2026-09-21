const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const Module = require("node:module")
const path = require("node:path")

function loadTs(relative) {
  const filename = path.resolve(__dirname, relative)
  const model = new Module(filename, module)
  model.paths = Module._nodeModulePaths(path.dirname(filename))
  const standardRequire = model.require.bind(model)
  model.require = name => name === "./data" ? loadTs("../lib/data.ts") : standardRequire(name)
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  model._compile(compiled, filename)
  return model.exports
}
const { defaultCustomization, removeStage, matchesCRMFilters, emptyFilters, customizationSchema } = loadTs("../lib/club-customization-model.ts")
const { applicants } = loadTs("../lib/data.ts")

test("GPA and class-year filters use AND and a strict greater-than comparison", () => {
  const filters = { ...emptyFilters, years: ["Sophomore"], minGpa: 3.5 }
  assert.deepEqual(applicants.filter(a => matchesCRMFilters(a, filters)).map(a => a.name), ["Naomi Cho"])
  assert.equal(matchesCRMFilters({ ...applicants[1], gpa: "3.5" }, filters), false)
  assert.equal(matchesCRMFilters(applicants[1], { ...filters, stage: "Rejected" }), false)
  assert.equal(matchesCRMFilters(applicants[1], { ...filters, query: "NO MATCH" }), false)
})

test("deleting a populated stage reassigns seeded and custom applicants and cleans saved filters", () => {
  const state = defaultCustomization("vvf")
  state.positions.extra = "Round 1"
  state.crm.filters = { ...emptyFilters, stage: "Round 1" }
  state.crm.views = [{ id: "view", name: "Interviews", filters: { ...state.crm.filters } }]
  const next = removeStage(state, "Round 1")
  assert.equal(next.positions[applicants.find(a => a.status === "Round 1").id], "Applied")
  assert.equal(next.positions.extra, "Applied")
  assert.equal(next.crm.filters.stage, "All Stages")
  assert.equal(next.crm.views[0].filters.stage, "All Stages")
  assert.equal(state.crm.filters.stage, "Round 1")
  assert.equal(removeStage(next, "missing"), next)
})

test("one stage is retained and outcome assignments survive deletion", () => {
  let state = defaultCustomization("vvf")
  state.positions[applicants[0].id] = "Accepted"
  state = removeStage(removeStage(state, "Round 1"), "Round 2")
  assert.equal(removeStage(state, "Applied"), state)
  assert.equal(state.positions[applicants[0].id], "Accepted")
})

test("customized state round-trips through browser persistence without losing IDs or hidden columns", () => {
  const state = defaultCustomization("vvf")
  state.stages[1].name = "Behavioral"
  state.stages.reverse()
  state.crm.hidden = ["name", "satScore"]
  state.crm.layout = "pipeline"
  state.profile.showAcceptance = false
  state.positions[applicants[0].id] = "Round 1"
  const restored = customizationSchema.parse(JSON.parse(JSON.stringify(state)))
  assert.deepEqual(restored, state)
  assert.equal(restored.stages.find(s => s.id === restored.positions[applicants[0].id]).name, "Behavioral")
})

test("invalid saved settings are rejected before hydration", () => {
  const state = defaultCustomization("vvf")
  assert.equal(customizationSchema.safeParse({ ...state, stages: [] }).success, false)
  assert.equal(customizationSchema.safeParse({ ...state, stages: [state.stages[0], state.stages[0]] }).success, false)
  assert.equal(customizationSchema.safeParse({ ...state, profile: { ...state.profile, accent: "invalid" } }).success, false)
  assert.equal(customizationSchema.safeParse({ ...state, crm: { ...state.crm, filters: { ...emptyFilters, minGpa: 9 } } }).success, false)
})
