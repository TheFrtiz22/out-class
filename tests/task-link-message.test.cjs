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
const submission = patch => ({ assignmentId: '6476bfa4-fed3-4880-a3fa-8b8cc162562d', revision: 0, text: '', link: '', fileIds: [], ...patch })

// A member who pastes "docs.google.com/..." without https:// used to see "Could not save. Please try again.",
// because the schema's ZodError was rethrown by actionResult and the client fell back to its generic message.
test('a link that is not http or https is refused in words the member can act on', () => {
  assert.equal(tasks.taskSubmissionProblem(submission({ link: 'docs.google.com/document/d/abc' })), 'Use a full link that starts with https://.')
  assert.equal(tasks.taskSubmissionProblem(submission({ link: 'javascript:alert(1)' })), 'Use a full link that starts with https://.')
})

test('a written response over the limit says so', () => {
  assert.equal(tasks.taskSubmissionProblem(submission({ text: 'a'.repeat(30001) })), 'Keep your written response under 30,000 characters.')
})

test('a valid submission has no problem', () => {
  assert.equal(tasks.taskSubmissionProblem(submission({ link: 'https://docs.google.com/document/d/abc', text: 'Done' })), null)
})

test('the submit action refuses with that message before parsing', () => {
  const action = fs.readFileSync('actions/tasks.ts', 'utf8')
  assert.match(action, /const problem = taskSubmissionProblem\(input\);\s*if \(problem\) throw new ActionError\(problem\);\s*const data = boundedParse\(submissionSchema, input\)/)
})
