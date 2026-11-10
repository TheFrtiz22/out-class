const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const apps = load('lib/student-applications.ts')
const { applicationSettingsSchema } = load('lib/club-settings.ts')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const track = { id: id(1), prompt: 'Which teams?', type: 'MULTI_SELECT', required: true, options: ['Tech', 'Finance', 'Design'], wordLimit: null, showIf: null }
const tech = { id: id(2), prompt: 'Link a project', type: 'ESSAY', required: true, options: [], wordLimit: 50, showIf: { questionId: id(1), anyOf: ['Tech'] } }
const deeper = { id: id(3), prompt: 'Stack?', type: 'MULTIPLE_CHOICE', required: true, options: ['TS', 'Py'], wordLimit: null, showIf: { questionId: id(2), anyOf: ['x'] } }
const qs = [track, tech]

test('select-all-that-apply answers are stored as a JSON array and validated against options', () => {
  assert.deepEqual(apps.selectedOptions(track, '["Tech","Design"]'), ['Tech', 'Design'])
  assert.deepEqual(apps.selectedOptions(track, 'not json'), [])
  assert.deepEqual(apps.selectedOptions({ type: 'MULTIPLE_CHOICE' }, 'Tech'), ['Tech'])
  assert.equal(apps.encodeSelections([]), '')
  assert.equal(apps.answerText(track, '["Tech","Design"]'), 'Tech, Design')
  assert.equal(apps.answerText({ type: 'ESSAY' }, 'Hello'), 'Hello')
  const err = r => apps.answerErrors(qs, [{ questionId: id(1), response: r }], false)[id(1)]
  assert.equal(err('["Tech"]'), undefined)
  assert.match(err('["Marketing"]'), /available options/)
  assert.match(err('["Tech","Tech"]'), /available options/)
  assert.match(err('Tech'), /available options/)
})

test('a follow-up question shows, and is required, only after a matching answer', () => {
  const none = [{ questionId: id(1), response: '["Finance"]' }]
  assert.deepEqual([...apps.visibleQuestionIds(qs, none)], [id(1)])
  assert.deepEqual(apps.answerErrors(qs, none, true), {}, 'hidden required question does not block submission')
  const withTech = [{ questionId: id(1), response: '["Finance","Tech"]' }]
  assert.deepEqual([...apps.visibleQuestionIds(qs, withTech)], [id(1), id(2)])
  assert.match(apps.answerErrors(qs, withTech, true)[id(2)], /needs a response/)
  const progress = apps.applicationResponseProgress(qs, none)
  assert.deepEqual([progress.completed, progress.total, progress.ready], [1, 1, true])
  // A chain is visible only while every link is.
  assert.deepEqual([...apps.visibleQuestionIds([...qs, deeper], none)], [id(1)])
})

test('builder validation: conditions must point at an earlier choice question and its own options', () => {
  const base = { clubId: id(9), version: 0, open: true, deadline: null }
  const draft = q => ({ id: q.id, prompt: q.prompt, type: q.type, required: q.required, wordLimit: q.wordLimit, options: q.options, showIf: q.showIf })
  assert.ok(applicationSettingsSchema.safeParse({ ...base, questions: [draft(track), draft(tech)] }).success)
  assert.equal(applicationSettingsSchema.safeParse({ ...base, questions: [draft(tech), draft(track)] }).success, false, 'parent must come first')
  assert.equal(applicationSettingsSchema.safeParse({ ...base, questions: [draft(track), draft({ ...tech, showIf: { questionId: id(1), anyOf: ['Law'] } })] }).success, false)
  assert.equal(applicationSettingsSchema.safeParse({ ...base, questions: [draft({ ...track, type: 'ESSAY', options: [] }), draft(tech)] }).success, false, 'only choice questions can be parents')
  assert.equal(applicationSettingsSchema.safeParse({ ...base, questions: [draft({ ...track, options: ['Only'] })] }).success, false, 'select-all needs two options')
})

test('builder keeps conditions valid after moves and deletes', () => {
  const { withValidConditions } = load('lib/club-settings.ts')
  assert.deepEqual(withValidConditions([tech, track]).map(q => q.showIf), [null, null])
  assert.deepEqual(withValidConditions([track, tech]).map(q => q.showIf), [null, tech.showIf])
  assert.deepEqual(withValidConditions([{ ...track, options: ['Finance'] }, tech])[1].showIf, null)
})

test('migration adds the enum value and a shape-checked condition column', { timeout: 240000 }, async () => {
  const { PGlite } = require('@electric-sql/pglite')
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
    for (const n of fs.readdirSync('prisma/migrations').filter(n => fs.existsSync(path.join('prisma/migrations', n, 'migration.sql'))).sort()) await db.exec(fs.readFileSync(path.join('prisma/migrations', n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('c','c','C','','','#000','Other')`)
    await db.exec(`INSERT INTO "ApplicationQuestion"(id,"clubId",prompt,type,options) VALUES('p','c','Teams','MULTI_SELECT','{Tech,Finance}')`)
    await db.exec(`INSERT INTO "ApplicationQuestion"(id,"clubId",prompt,type,"showIf") VALUES('q','c','Project','ESSAY','{"questionId":"p","anyOf":["Tech"]}')`)
    await assert.rejects(db.exec(`INSERT INTO "ApplicationQuestion"(id,"clubId",prompt,type,"showIf") VALUES('r','c','Bad','ESSAY','{"questionId":"p","anyOf":[]}')`), /showIf_shape/)
    await assert.rejects(db.exec(`INSERT INTO "ApplicationQuestion"(id,"clubId",prompt,type,"showIf") VALUES('s','c','Bad','ESSAY','"text"')`), /showIf_shape/)
  } finally { await db.close() }
})
