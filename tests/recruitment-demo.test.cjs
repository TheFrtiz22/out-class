const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const Module = require("node:module")
const path = require("node:path")
const filename = path.resolve(__dirname, "../components/landing/recruitment-demo-data.ts")
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const model = new Module(filename, module)
model._compile(compiled, filename)
const { demoApplicants, applicantStage, stageColumn, DEMO_TICKS } = model.exports

test("demo applicants complete the full workflow before the resting snapshot", () => {
  for (const applicant of demoApplicants) {
    const stages = new Set(Array.from({ length: 36 }, (_, tick) => applicantStage(tick, applicant)))
    for (const stage of ["Created", "In progress", "Submitted", "Review", "Team scoring", "Voting"])
      assert.ok(stages.has(stage), `${applicant.name}: ${stage}`)
    assert.equal(applicantStage(35, applicant), applicant.advances ? "Accepted" : "Not advanced")
    if (applicant.advances)
      for (const stage of ["Interview", "Final review"]) assert.ok(stages.has(stage))
    else assert.equal(stages.has("Interview"), false)
  }
})
test("staggering creates concurrent stages and stays inside the desktop lane capacity", () => {
  let concurrent = false
  for (let tick = 0; tick < DEMO_TICKS; tick++) {
    const counts = [0, 0, 0, 0]
    for (const applicant of demoApplicants.filter((a) => tick >= a.offset))
      counts[stageColumn(applicantStage(tick, applicant))]++
    assert.ok(counts.slice(0, 3).every((count) => count <= 3))
    assert.ok(counts[3] <= 6)
    if (counts.filter(Boolean).length >= 3) concurrent = true
  }
  assert.ok(concurrent)
})
test("the reduced-motion snapshot contains four accepted and two not-advanced decisions", () => {
  const stages = demoApplicants.map((applicant) => applicantStage(35, applicant))
  assert.equal(stages.filter((stage) => stage === "Accepted").length, 4)
  assert.equal(stages.filter((stage) => stage === "Not advanced").length, 2)
})
