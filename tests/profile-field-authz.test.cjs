// Authorization review follow-ups: hidden profile fields cannot leak through voting selection,
// voting academic years, identity reveal, direct file routes, résumé highlights or the viewer.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const lib = load('lib/profile-field-visibility.ts')
const all = on => Object.fromEntries(lib.profileFieldKeys.map(k => [k, on]))
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const clubId = id(1), roundId = id(2)

// ---- 1. Voting candidate selection -------------------------------------------
test('voting selection: GPA, major and year filters and sorts cannot reveal hidden values', async () => {
  const { readVotingCandidateSelection } = load('lib/voting-candidate-selection.ts')
  // Names sort Ada, Ben, Cy; GPAs sort the other way; only Cy is above 3.5.
  const people = [['Cy', 3.9, 'Physics', 2027], ['Ada', 3.1, 'Math', 2028], ['Ben', 3.4, 'Math', 2029]]
  const rows = people.map(([first, gpa, major, gradYear], i) => ({ id: id(10 + i), roundId, status: 'IN_REVIEW', studentId: id(20 + i), student: { email: `${first}@virginia.edu`, studentProfile: { firstName: first, lastName: 'X', major, gradYear, transferStudent: false, gpa, satScore: 1400, actScore: 30 } } }))
  const tx = { application: { findMany: async () => structuredClone(rows) } }
  const m = { id: id(30), userId: id(31), status: 'ACTIVE', isOwner: true, permissions: [] }
  const rounds = [{ id: roundId, name: 'Review', order: 0, anonymousReview: false, applicantDisplay: {} }]
  const select = (query, fields) => readVotingCandidateSelection(tx, clubId, m, rounds, query, new Map([[roundId, false]]), fields).then(r => r.applications.map(a => a.id))
  const hidden = { ...all(true), gpa: false, major: false, academicYear: false }
  const base = await select({}, hidden)
  assert.deepEqual(await select({ gpa: 3.5 }, all(true)), [id(10)], 'control: the filter works when GPA is shown')
  assert.deepEqual(await select({ sort: 'gpa' }, all(true)), [id(11), id(12), id(10)], 'control: GPA order differs from name order')
  assert.deepEqual(await select({ gpa: 3.5 }, hidden), base, 'a GPA filter on a hidden GPA is ignored: same IDs as no filter')
  assert.deepEqual(await select({ sort: 'gpa' }, hidden), await select({ sort: 'name' }, hidden), 'GPA sort falls back to name order')
  assert.deepEqual(await select({ sort: 'gpa', descending: true }, hidden), await select({ sort: 'name' }, hidden))
  assert.deepEqual(await select({ major: 'Physics' }, hidden), base)
  assert.deepEqual(await select({ year: 'Fourth Year' }, hidden), base)
  assert.deepEqual(await select({ sort: 'year' }, hidden), await select({ sort: 'name' }, hidden))
  assert.deepEqual(base, await select({ sort: 'name' }, hidden))
  const voting = fs.readFileSync('actions/voting.ts', 'utf8')
  assert.match(voting, /select: \{ suspendedAt: true, profileFieldVisibility: true \}/)
  assert.match(voting, /new Map\(allRounds\.map\(round => \[round\.id, round\.anonymousReview\]\)\), profileFields\)/)
})

// ---- 2. Voting academic years ------------------------------------------------
test('voting workspace returns no academic years when the club hides class year', async () => {
  const { harness } = require('./helpers/voting-harness.cjs')
  const h = harness(); await h.create()
  assert.ok((await h.read()).academicYears.length > 0, 'control: years are returned by default')
  h.tx.club.findUnique = async () => ({ suspendedAt: null, profileFieldVisibility: { academicYear: false } })
  assert.deepEqual((await h.read()).academicYears, [])
})
