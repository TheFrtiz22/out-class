const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { loadComponent } = require("./helpers/component-module.cjs")

test("task requirements read as plain words everywhere", () => {
  const { taskRequirementsLabel, taskRequirementsSentence } = loadComponent("lib/task-requirements.ts")
  assert.equal(taskRequirementsLabel(["TEXT", "LINK"]), "Written response + Link")
  assert.equal(taskRequirementsLabel(["FILE"]), "File upload")
  assert.equal(taskRequirementsSentence(["TEXT", "LINK"]), "written response and a link")
  assert.equal(taskRequirementsSentence(["FILE"]), "a file upload")
  assert.equal(taskRequirementsSentence(["TEXT", "LINK", "FILE"]), "written response, a link and a file upload")
})

test("the submission form, task rows and assign review use the shared labels", () => {
  const tasks = fs.readFileSync("components/club-tasks.tsx", "utf8")
  assert.doesNotMatch(tasks, /requirements\.map\(\(s\) => s\.toLowerCase\(\)\)/)
  assert.match(tasks, /taskRequirementsSentence\(task\.requirements\)/)
  assert.match(tasks, /taskRequirementsLabel\(task\.requirements\)/)
  // The task sheet calls a task a Task, as the list, Inbox and builder do.
  assert.match(tasks, /active\?\.kind==="PROJECT"\?"Project":"Task"/)
  const builder = fs.readFileSync("components/tasks/task-assignment-builder.tsx", "utf8")
  assert.doesNotMatch(builder, /FILE:"File"\}/)
  assert.match(builder, /taskRequirementsLabel\(requirements\)/)
})
