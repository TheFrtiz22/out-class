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

const short = { id: id(4), prompt: 'Preferred name?', type: 'SHORT_ANSWER', required: true, options: [], wordLimit: null, characterLimit: 10, showIf: null }
test('short answers: one line within the club character limit at submit; drafts may run over up to the maximum', () => {
  const err = (r, final = true, q = short) => apps.answerErrors([q], [{ questionId: q.id, response: r }], final)[q.id]
  assert.equal(err('0123456789'), undefined, 'exactly at the limit')
  assert.match(err('0123456789x'), /within 10 characters/)
  assert.match(err('two\nlines'), /one line/)
  assert.equal(err('0123456789x', false), undefined, 'a draft may exceed the club limit (it can be lowered later)')
  assert.equal(err('x'.repeat(500), false), undefined)
  assert.match(err('x'.repeat(501), false), /within 500 characters/, 'never past the short-answer maximum, even in a draft')
  assert.match(err('x'.repeat(501), true, { ...short, characterLimit: null }), /within 500 characters/, 'a missing limit falls back to the maximum')
  assert.match(err(''), /needs a response/)
  assert.equal(apps.characterCount('héllo'), 5)
  assert.equal(apps.shortAnswerLimit({ characterLimit: null }), 500)
  assert.equal(apps.answerText(short, 'Sam'), 'Sam', 'reviewers see the text as written')
  const progress = apps.applicationResponseProgress([short], [{ questionId: short.id, response: 'too long for it' }])
  assert.deepEqual([progress.completed, progress.ready], [0, false], 'an over-limit answer does not count as complete')
})

test('builder validation: short answers need a 1-500 character limit; other types ignore it', () => {
  const base = { clubId: id(9), version: 0, open: true, deadline: null }
  const parse = q => applicationSettingsSchema.safeParse({ ...base, questions: [{ id: id(4), prompt: 'Name', type: 'SHORT_ANSWER', required: true, wordLimit: null, options: [], showIf: null, ...q }] })
  assert.equal(parse({ characterLimit: 150 }).success, true)
  assert.equal(parse({ characterLimit: 1 }).success, true)
  assert.equal(parse({ characterLimit: 500 }).success, true)
  assert.equal(parse({ characterLimit: 0 }).success, false)
  assert.equal(parse({ characterLimit: 501 }).success, false)
  assert.equal(parse({ characterLimit: 12.5 }).success, false)
  assert.match(JSON.stringify(parse({ characterLimit: null }).error.issues), /character limit/)
  const older = parse({ type: 'ESSAY', characterLimit: undefined })
  assert.equal(older.success, true, 'drafts saved before short answers existed still parse')
  assert.equal(older.data.questions[0].characterLimit, null)
})

test('mobile rules mirror the web short-answer validation', () => {
  const mobile = load('mobile/src/components/applications/rules.ts')
  for (const [response, final] of [['0123456789', true], ['0123456789x', true], ['a\nb', true], ['0123456789x', false], ['x'.repeat(501), false], ['', true]])
    assert.equal(mobile.answerErrors([short], [{ questionId: short.id, response }], final)[short.id], apps.answerErrors([short], [{ questionId: short.id, response }], final)[short.id], JSON.stringify([response.slice(0, 12), final]))
  assert.equal(mobile.shortAnswerLimit({}), apps.SHORT_ANSWER_MAX_CHARACTERS)
})

test('the answer field is one line, capped at the club limit, and turns pasted line breaks into spaces', () => {
  const { QuestionField } = load('components/applications/question-field.tsx', new Proxy({}, { has: (_, n) => n.startsWith('@/components/'), get: (_, n) => n.startsWith('@/components/') ? new Proxy({}, { get: (_, k) => k }) : undefined }))
  let value
  const el = QuestionField({ question: short, value: 'Sam', onChange: v => { value = v } })
  assert.equal(el.type, 'Input')
  assert.equal(el.props.type, 'text')
  assert.equal(el.props.maxLength, 10)
  assert.equal(el.props['aria-describedby'], `help-${short.id}`)
  el.props.onChange({ target: { value: 'Sam\r\nLee' } })
  assert.equal(value, 'Sam Lee')
  assert.equal(QuestionField({ question: { ...short, characterLimit: null }, value: '', onChange() {} }).props.maxLength, 500)
})

