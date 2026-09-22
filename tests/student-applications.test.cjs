const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), mod, mod.exports)
  return mod.exports
}
const helpers = load('lib/student-applications.ts')
const clubId = '00000000-0000-4000-8000-000000000001'
const questionId = '00000000-0000-4000-8000-000000000002'
const question = { id: questionId, prompt: 'Why this club?', type: 'ESSAY', required: true, wordLimit: 3 }
function setup({ status = 'DRAFTING', profile = true, questions = [question] } = {}) {
  const calls = []
  const tx = {
    studentProfile: { findUnique: async () => profile ? { id: 'profile' } : null },
    applicationQuestion: { findMany: async args => { calls.push(['questions', args]); return questions } },
    pipelineRound: { findFirst: async () => ({ id: 'first-round' }) },
    application: {
      findUnique: async args => { calls.push(['owner', args]); return { id: 'app', status } },
      updateMany: async args => { calls.push(['update', args]); return { count: status === 'DRAFTING' ? 1 : 0 } },
    },
    applicationAnswer: {
      deleteMany: async args => calls.push(['delete', args]),
      createMany: async args => calls.push(['answers', args]),
    },
  }
  const actions = load('actions/applications.ts', {
    '@/lib/student-applications': helpers,
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'student' } }) },
    '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx) } },
    'next/cache': { revalidatePath: () => {} },
  })
  return { ...actions, calls }
}
test('draft permits incomplete and over-limit essays; submission enforces requirements', () => {
  assert.deepEqual(helpers.answerErrors([question], [], false), {})
  assert.ok(helpers.answerErrors([question], [], true)[questionId])
  const answers = [{ questionId, response: 'one two three four' }]
  assert.deepEqual(helpers.answerErrors([question], answers, false), {})
  assert.ok(helpers.answerErrors([question], answers, true)[questionId])
  assert.equal(helpers.wordCount('  one\n two\tthree  '), 3)
})
test('question ownership, duplicates, and unsafe attachment links are rejected', () => {
  assert.ok(Object.keys(helpers.answerErrors([question], [{ questionId: 'foreign', response: 'answer' }], false)).length)
  assert.ok(helpers.answerErrors([question], [{ questionId, response: 'a' }, { questionId, response: 'b' }], false)[questionId])
  assert.ok(helpers.answerErrors([{ ...question, type: 'FILE_UPLOAD' }], [{ questionId, response: 'javascript:alert(1)' }], false)[questionId])
})
test('draft save is authenticated, conditional on draft state, and preserves status', async () => {
  const { saveApplicationDraft, calls } = setup()
  await saveApplicationDraft({ clubId, answers: [{ questionId, response: '' }] })
  assert.deepEqual(calls.find(([name]) => name === 'owner')[1].where, { studentId_clubId: { studentId: 'student', clubId } })
  const update = calls.find(([name]) => name === 'update')[1]
  assert.deepEqual(update.where, { id: 'app', studentId: 'student', status: 'DRAFTING' })
  assert.deepEqual(update.data, { status: 'DRAFTING' })
})
test('draft save and repeat submission cannot overwrite submitted answers', async () => {
  for (const method of ['saveApplicationDraft', 'submitApplication']) {
    const context = setup({ status: 'SUBMITTED' })
    await assert.rejects(context[method]({ clubId, answers: [{ questionId, response: 'My answer' }] }), /already been submitted/)
    assert.equal(context.calls.some(([name]) => name === 'delete'), false)
  }
})
test('submission requires profile and validated responses before writing', async () => {
  const missing = setup({ profile: false })
  await assert.rejects(missing.submitApplication({ clubId, answers: [] }), /profile/)
  assert.equal(missing.calls.length, 0)
  const invalid = setup()
  await assert.rejects(invalid.submitApplication({ clubId, answers: [] }), /needs a response/)
  assert.equal(invalid.calls.some(([name]) => name === 'update'), false)
})
test('submission transitions once to the first round and saves exact answers', async () => {
  const { submitApplication, calls } = setup()
  assert.deepEqual(await submitApplication({ clubId, answers: [{ questionId, response: 'My answer' }] }), { success: true, applicationId: 'app' })
  const update = calls.find(([name]) => name === 'update')[1]
  assert.equal(update.data.status, 'SUBMITTED')
  assert.equal(update.data.roundId, 'first-round')
  assert.ok(update.data.submittedAt instanceof Date)
  assert.deepEqual(calls.find(([name]) => name === 'answers')[1].data, [{ applicationId: 'app', questionId, response: 'My answer' }])
})
