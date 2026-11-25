const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")

// On phones the Create group spans the row: the labelled Create task button grows, the chevron menu trigger stays compact.
test("the phone Create task button grows and its menu chevron stays small", () => {
  const src = fs.readFileSync("components/tasks/task-manager-workspace.tsx", "utf8")
  const group = src.match(/<div role="group" aria-label="Create" className="inline-flex">(.*?)<\/DropdownMenu><\/div>/s)
  assert.ok(group, "Create group found")
  assert.ok(group[1].indexOf("Create task") < group[1].indexOf("DropdownMenuTrigger"), "Create task is the group's first button")
  const css = fs.readFileSync("components/tasks.css", "utf8")
  assert.match(css, /\.oc-task-manager-toolbar > div:last-child > button:first-child \{ flex:1; \}/)
  assert.doesNotMatch(css, /\.oc-task-manager-toolbar > div:last-child > button:last-child \{ flex:1; \}/)
})
