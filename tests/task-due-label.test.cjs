// A task with no due date read "Due No due date" in the member's task drawer and in the leader's task, project and
// member views. Every "Due …" line now comes from one label that says "No due date" on its own.
const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

function load() {
  const mod = { exports: {} }
  const code = ts.transpileModule(read('lib/task-presentation.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(n => n.startsWith('@/') ? new Proxy({}, { get: () => () => '' }) : require(n), mod, mod.exports)
  return mod.exports
}

test('a task without a due date says so once', () => {
  const { taskDueLabel } = load()
  assert.equal(typeof taskDueLabel, 'function')
  assert.equal(taskDueLabel(null), 'No due date')
  assert.match(taskDueLabel('2026-12-01T17:00:00Z'), /^Due Dec 1/)
})

test('no view prefixes "Due" to the bare date text', () => {
  for (const file of ['components/club-tasks.tsx', 'components/tasks/task-manager-workspace.tsx']) {
    const source = read(file)
    assert.doesNotMatch(source, /Due \{taskDate\(/, `${file} uses taskDueLabel`)
    assert.doesNotMatch(source, /Due \{relativeDue\(/, `${file} guards the relative due date`)
  }
})
