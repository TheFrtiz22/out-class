const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
const source = fs.readFileSync("lib/dashboard-actions.ts", "utf8")
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const mod = { exports: {} }
new Function("module", "exports", code)(mod, mod.exports)
const { prioritizeDashboardActions } = mod.exports

test("prioritizes only real actionable records", () => {
 const actions = [
  { id: "future", title: "Meeting", description: "Tomorrow", href: "/meeting", urgency: "normal", dueAt: "2026-10-23" },
  { id: "missing", title: "No work", description: "", href: "/tasks", urgency: "critical", count: 0 },
  { id: "urgent", title: "Review", description: "Applicant", href: "/applications", urgency: "critical", count: 2 },
  { id: "forbidden", title: "No route", description: "", href: "", urgency: "critical", count: 1 },
 ]
 assert.deepEqual(prioritizeDashboardActions(actions).map(x=>x.id), ["urgent", "future"])
})
test("same-urgency records sort by due date with a deterministic tie break", () => {
 const actions = [
  { id: "z", title: "Z", href: "/z", description: "", urgency: "normal" },
  { id: "b", title: "B", href: "/b", description: "", urgency: "normal", dueAt: "2026-10-24" },
  { id: "a", title: "A", href: "/a", description: "", urgency: "normal", dueAt: "2026-10-23" }
 ]
 assert.deepEqual(prioritizeDashboardActions(actions, 2).map(x=>x.id), ["a", "b"])
})
