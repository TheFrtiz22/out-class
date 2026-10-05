const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith("@/lib/") ? load(name.replace("@/", "") + ".ts") : require(name), mod, mod.exports)
  return mod.exports
}
const helpers = load('lib/student-applications.ts')
const clubId = '00000000-0000-4000-8000-000000000001'
const questionId = '00000000-0000-4000-8000-000000000002'
const question = { id: questionId, prompt: 'Why this club?', type: 'ESSAY', required: true, wordLimit: 3 }
function setup({ status = 'DRAFTING', profile = true, questions = [question], testRequirement = 'OPTIONAL', userId = 'student' } = {}) {
  const calls = []
  const tx = {
    $queryRaw: async()=>[],
    club: { findUnique: async () => ({ testRequirement }) },
    studentProfile: { findUnique: async () => profile ? (typeof profile === 'object' ? profile : { id: 'profile' }) : null },
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
    '@/utils/auth': { requireAuth: async () => ({ user: { id: userId } }) },
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

test('submission enforces club SAT/ACT policy; drafts remain available without required scores', async () => {
  const input = { clubId, answers: [{ questionId, response: 'My answer' }] }
  await setup({testRequirement:'SAT_OR_ACT',profile:{actScore:32}}).submitApplication(input)
  await setup({testRequirement:'SAT_OR_ACT',profile:{satScore:1500}}).submitApplication(input)
  await assert.rejects(setup({testRequirement:'BOTH',profile:{actScore:32}}).submitApplication(input), /SAT\/ACT requirement/)
  await setup({testRequirement:'BOTH',profile:{actScore:32,satScore:1500}}).submitApplication(input)
  await setup({testRequirement:'BOTH'}).saveApplicationDraft(input)
})

test('FILE_UPLOAD accepts private owned paths and external links but rejects unsafe/foreign attachments', async () => {
 const fileQuestion={...question,type:'FILE_UPLOAD'},path=clubId+'/application.pdf'
 assert.deepEqual(helpers.answerErrors([fileQuestion],[{questionId,response:path}],true),{})
 assert.deepEqual(helpers.answerErrors([fileQuestion],[{questionId,response:'https://example.test/document.pdf'}],true),{})
 assert.equal(helpers.applicationAttachmentUrl(path,'application',questionId),'/api/application-attachments?applicationId=application&questionId='+questionId)
 for(const response of ['javascript:alert(1)',clubId+'/../secret.pdf',clubId+'/%2e%2e.pdf',clubId+'/folder/file.pdf',clubId+'/file.pdf?other',clubId+'/file.pdf#fragment'])
   assert.ok(helpers.answerErrors([fileQuestion],[{questionId,response}],false)[questionId])
 const h=setup({questions:[fileQuestion]})
 await assert.rejects(h.saveApplicationDraft({clubId,answers:[{questionId,response:path}]}),/own uploaded/)
 assert.ok(!h.calls.some(call=>call[0]==='update'))
})

test('owned private attachments persist unchanged in drafts and submissions',async()=>{
 for(const method of ['saveApplicationDraft','submitApplication']){
  const h=setup({userId:clubId,questions:[{...question,type:'FILE_UPLOAD'}]})
  const response=clubId+'/application.pdf'
  await h[method]({clubId,answers:[{questionId,response}]})
  assert.equal(h.calls.find(call=>call[0]==='answers')[1].data[0].response,response)
 }
})

test('student status projection remains owned and exposes only public round names and booking details', async () => {
  let query
  const actions = load('actions/applications.ts', {
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'authenticated-student' } }) },
    '@/utils/prisma': { prisma: { application: { findMany: async input => { query = input; return [] } } } },
    'next/cache': { revalidatePath() {} },
  })
  await actions.getStudentApplications()
  assert.deepEqual(query.where, { studentId: 'authenticated-student' })
  assert.deepEqual(query.select.club.select.pipelineRounds, { where: { archivedAt: null }, select: { id: true, name: true, order: true }, orderBy: { order: 'asc' } })
  assert.deepEqual(query.select.round.select, { id: true, name: true, order: true })
  assert.deepEqual(query.select.bookings.select, { id: true, roundId: true, slot: { select: { startTime: true, endTime: true, location: true } } })
  assert.equal(query.select.scores, undefined)
  assert.equal(query.select.notes, undefined)
})
