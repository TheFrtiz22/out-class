const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const { priorApplicationsFor, loadPriorApplications } = load('lib/prior-applications.ts')
const at = d => new Date(`2026-${d}T12:00:00Z`)
const history = [
  { id: 'a1', studentId: 's1', status: 'REJECTED', submittedAt: at('02-01'), recruitmentCycle: { name: 'Spring 2026' } },
  { id: 'a2', studentId: 's1', status: 'IN_REVIEW', submittedAt: at('09-01'), recruitmentCycle: { name: 'Fall 2026' } },
  { id: 'b1', studentId: 's2', status: 'REJECTED', submittedAt: at('02-01'), recruitmentCycle: null },
]

test('lists only earlier applications by the same student, newest first', () => {
  assert.deepEqual(priorApplicationsFor(history[1], history), [{ cycleName: 'Spring 2026', status: 'REJECTED' }])
  assert.deepEqual(priorApplicationsFor(history[0], history), [])
  assert.deepEqual(priorApplicationsFor(history[2], history), [])
})

test('reads history inside the caller transaction, scoped to the club and excluding drafts', async () => {
  const queries = []
  const tx = { application: { findMany: async q => { queries.push(q); return history } } }
  const map = await loadPriorApplications(tx, 'club-1', [history[1]])
  assert.equal(queries.length, 1)
  assert.equal(queries[0].where.clubId, 'club-1')
  assert.deepEqual(queries[0].where.status, { not: 'DRAFTING' })
  assert.deepEqual(queries[0].where.studentId, { in: ['s1'] })
  assert.deepEqual(map.get('a2'), [{ cycleName: 'Spring 2026', status: 'REJECTED' }])
  assert.equal((await loadPriorApplications(tx, 'club-1', [])).size, 0)
  assert.equal(queries.length, 1)
})

test('anonymous projections never carry application history', () => {
  const src = fs.readFileSync('lib/pipeline-detail.ts', 'utf8')
  assert.match(src, /priorApplications: anonymous \? \[\] :/)
  const crm = fs.readFileSync('actions/crm.ts', 'utf8')
  assert.match(crm, /hasPermission\(membership, "applicants\.identify"\) && !raw\.round\.anonymousReview/)
})
