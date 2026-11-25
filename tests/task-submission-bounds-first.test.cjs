const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const tasks = load('lib/tasks.ts')

// taskSubmissionProblem runs before submitTask's boundedParse. It used a plain safeParse,
// which visits every element of an oversized fileIds array before the bounds check could
// reject it, so the cost of a huge request was paid before the guard ran.
test('an oversized submission is not walked element by element before the bounds check', () => {
  const ids = new Array(200_000).fill('6476bfa4-fed3-4880-a3fa-8b8cc162562d')
  let reads = 0
  const fileIds = new Proxy(ids, { get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, receiver) } })
  const problem = tasks.taskSubmissionProblem({ assignmentId: '6476bfa4-fed3-4880-a3fa-8b8cc162562d', revision: 0, text: '', link: '', fileIds })
  assert.equal(problem, null, 'an oversized request is left to the full bounded parse, which refuses it')
  assert.ok(reads < 10, `read ${reads} array elements before refusing`)
})

test('member-fixable problems still get their own message', () => {
  const base = { assignmentId: '6476bfa4-fed3-4880-a3fa-8b8cc162562d', revision: 0, text: '', link: '', fileIds: [] }
  assert.equal(tasks.taskSubmissionProblem({ ...base, link: 'docs.google.com/x' }), 'Use a full link that starts with https://.')
  assert.equal(tasks.taskSubmissionProblem({ ...base, text: 'a'.repeat(30001) }), 'Keep your written response under 30,000 characters.')
  assert.equal(tasks.taskSubmissionProblem({ ...base, link: 'https://example.com' }), null)
})
