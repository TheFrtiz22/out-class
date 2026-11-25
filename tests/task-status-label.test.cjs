'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadComponent: loadModule } = require('./helpers/component-module.cjs')

// The task detail showed "open" and "in progress" in lower case while the builder's Status menu says "Open",
// "In progress" and "Closed". The detail now uses the same words.
test('task status label matches the builder', () => {
  const { taskStatusLabel } = loadModule('lib/task-presentation.ts')
  assert.equal(taskStatusLabel('OPEN'), 'Open')
  assert.equal(taskStatusLabel('IN_PROGRESS'), 'In progress')
  assert.equal(taskStatusLabel('DONE'), 'Closed')
  assert.equal(taskStatusLabel('DRAFT'), 'Draft')
  const src = fs.readFileSync(path.join(__dirname, '..', 'components/tasks/task-manager-workspace.tsx'), 'utf8')
  assert.match(src, /<span>\{taskStatusLabel\(task\.status\)\}<\/span>/)
  assert.doesNotMatch(src, /task\.status\.replaceAll\("_"," "\)\.toLowerCase\(\)/)
})
