const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '')+'.ts') : require(n),mod,mod.exports)
  return mod.exports
}
const { anonymousApplication } = load('lib/anonymous-review.ts')
const { meetsTestRequirement, actShape } = load('lib/test-scores.ts')
const clubId='00000000-0000-4000-8000-000000000001', id='00000000-0000-4000-8000-000000000002'
const app = { id, clubId, roundId: 'round', status: 'SUBMITTED', studentId: 'SECRET-user', submittedAt: new Date(), student: { id: 'SECRET-user', email: 'SECRET@example.com', createdAt: new Date(), studentProfile: { id: 'SECRET-profile', firstName: 'SECRET-first', lastName: 'SECRET-last', major: 'SECRET-free-text', computingId: 'SECRET-id', gradYear: 2028, gpa: 3.6, satScore: null, actScore: 32, actMath: 33, resumeUrl: 'https://example.com/SECRET.pdf', headshotUrl: 'SECRET.jpg', linkedinUrl: 'SECRET-link', bio: 'SECRET-bio', experiences: [{ title: 'SECRET-experience' }] } }, answers: [{ response: 'SECRET-essay', filename: 'SECRET-file' }], bookings: [{ slot: { location: 'SECRET-location' } }], evaluations: [{ id:'evaluation', applicationId:id, interviewerId:'reviewer', round:'Review', score:8, notes:'SECRET-notes', createdAt:new Date() }] }
test('anonymous wire payload uses an allowlist and removes every identity-bearing field and free-text source', () => {
  const result = anonymousApplication(app)
  assert.ok(!JSON.stringify(result).includes('SECRET'))
  assert.equal(result.student.studentProfile.actScore,32)
  assert.equal(result.student.studentProfile.actMath,33)
  assert.equal(result.student.studentProfile.satScore,null)
  assert.equal(result.evaluations[0].score,8)
  assert.equal(result.student.studentProfile.firstName,'Applicant')
  assert.equal(anonymousApplication(app).student.studentProfile.lastName,result.student.studentProfile.lastName)
})
test('pipeline redacts even owners; anonymous-only reviewers receive only anonymous-round applications', async () => {
  let permission = 'applicants.identify', captured
  const api = load('actions/crm.ts', { '@/utils/auth': { requireClubPermission: async () => ({ membership: { permissions:[permission] } }) }, '@/utils/prisma': { prisma: { pipelineRound: { findMany: async () => [{id:'round',anonymousReview:true}] }, application: { findMany: async args => { captured=args.where; return [{...app,round:{anonymousReview:true}}] } } } }, 'next/cache':{revalidatePath:()=>{}} })
  assert.ok(!JSON.stringify(await api.getClubPipeline(clubId)).includes('SECRET'))
  permission='applications.review'
  await api.getClubPipeline(clubId)
  assert.deepEqual(captured.round,{anonymousReview:true})
})
test('identity reveal requires permission and a reason, writes audit before returning identity', async () => {
  let denied=true, audited=false
  const tx={application:{findFirst:async()=>app},auditLog:{create:async({data})=>{assert.equal(data.action,'applicant.identity.reveal');audited=true}}}
  const api=load('actions/crm.ts',{'@/utils/auth':{requireClubPermission:async(_,caps)=>{assert.deepEqual(caps,['applicants.identify']);if(denied)throw Error('Denied');return {user:{id:'manager'}}}},'@/utils/prisma':{prisma:{$transaction:fn=>fn(tx)}},'next/cache':{revalidatePath:()=>{}}})
  await assert.rejects(api.revealApplicantIdentity(clubId,id,'Resolve an application issue'),/Denied/)
  denied=false
  await assert.rejects(api.revealApplicantIdentity(clubId,id,'short'))
  assert.equal(audited,false)
  const result=await api.revealApplicantIdentity(clubId,id,'Resolve an application issue')
  assert.equal(audited,true);assert.equal(result.student.email,'SECRET@example.com')
})
test('SAT and ACT requirements accept either, both, or neither without conversion',()=>{
  for (const [satScore,actScore] of [[null,null],[1500,null],[null,32],[1500,32]]) {
    const profile={satScore,actScore}
    assert.equal(meetsTestRequirement('OPTIONAL',profile),true)
    assert.equal(meetsTestRequirement('SAT_OR_ACT',profile),satScore!==null || actScore!==null)
    assert.equal(meetsTestRequirement('BOTH',profile),satScore!==null && actScore!==null)
    assert.equal(meetsTestRequirement('SAT',profile),satScore!==null)
    assert.equal(meetsTestRequirement('ACT',profile),actScore!==null)
  }
  for(const validator of Object.values(actShape)) {
    for(const value of [0,37,31.5]) assert.equal(validator.safeParse(value).success,false)
    for(const value of [null,undefined,1,36]) assert.equal(validator.safeParse(value).success,true)
  }
})
test('anonymous narrative must be explicitly prepared; raw essays are never copied automatically', () => {
  const { validateAnonymousText }=load('lib/anonymous-review.ts')
  const identity={email:'andrew@virginia.edu',studentProfile:{firstName:'Andrew',lastName:'Rankin',computingId:'ar123'}}
  for (const text of ['I am Andrew','Contact ar123','https://example.com/profile','call 555-123-1234']) assert.throws(()=>validateAnonymousText(text,identity))
  validateAnonymousText('Led a team project and analyzed investment risk.',identity)
  const result=anonymousApplication({...app,anonymousReviewText:'Led a team project and analyzed investment risk.'})
  assert.match(result.student.studentProfile.bio,/Manager-reviewed anonymous content/)
  assert.ok(!JSON.stringify(result).includes('SECRET'))
})
test('publishing anonymous content requires manager permission, explicit review, and prior audited reveal', async () => {
  let revealed=false, written=false, audit=false
  const tx={application:{findFirst:async()=>({id,student:{email:'student@virginia.edu',studentProfile:{firstName:'Alice',lastName:'Smith',computingId:'as123'}}}),update:async()=>{written=true}},auditLog:{findFirst:async()=>revealed?{id:'audit'}:null,create:async()=>{audit=true}}}
  const api=load('actions/crm.ts',{'@/utils/auth':{requireClubPermission:async(_,caps)=>{assert.deepEqual(caps,['recruitment.manage','applicants.identify']);return {user:{id:'manager'}}}},'@/utils/prisma':{prisma:{$transaction:fn=>fn(tx)}},'next/cache':{revalidatePath:()=>{}}})
  await assert.rejects(api.saveAnonymousReviewContent(clubId,id,'Research experience.',false))
  await assert.rejects(api.saveAnonymousReviewContent(clubId,id,'Research experience.',true),/reveal/)
  revealed=true
  await assert.rejects(api.saveAnonymousReviewContent(clubId,id,'Alice led this project.',true),/names/)
  assert.equal(written,false)
  await api.saveAnonymousReviewContent(clubId,id,'Research experience.',true)
  assert.equal(written,true);assert.equal(audit,true)
})
test('anonymous evaluation updates preserve withheld notes and never return them in mutation responses',async()=>{
  let update
  const api=load('actions/evaluations.ts',{'@/utils/auth':{requireClubPermission:async()=>({membership:{id:'reviewer',permissions:['applications.review']}})},'@/utils/prisma':{prisma:{application:{findFirst:async()=>({id,roundId:'round'})},pipelineRound:{findFirst:async()=>({id:'round',anonymousReview:true})},evaluation:{upsert:async args=>{update=args.update;return {id:'evaluation',score:8,notes:'SECRET old identity',createdAt:new Date()}}}}},'next/cache':{revalidatePath:()=>{}}})
  const result=await api.submitEvaluation({clubId,applicationId:id,roundName:'Review',score:8,notes:''})
  assert.equal(update.notes,undefined)
  assert.equal(result.evaluation.notes,null)
  assert.ok(!JSON.stringify(result).includes('SECRET'))
})
