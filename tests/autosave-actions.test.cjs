const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{loader}=require('./helpers/communications-loader.cjs'),{unwrapActions,refused}=require('./helpers/action-result.cjs')
const student=loader({})('lib/student-applications.ts'),profile=loader({})('lib/student-profile.ts'),clubId=randomUUID(),questionId=randomUUID(),userId=randomUUID()
test('application autosave compares persisted answers, permits idempotent retries, and never submits',async()=>{
 let answers=[],status='DRAFTING';const transitions=[]
 const tx={$queryRaw:async()=>[],studentProfile:{findUnique:async()=>({graduatedAt:null})},club:{findUnique:async()=>({testRequirement:'OPTIONAL'})},applicationQuestion:{findMany:async()=>[{id:questionId,type:'ESSAY',required:true,wordLimit:3}]},pipelineRound:{findFirst:async()=>({id:'round'})},recruitmentCycle:{findMany:async()=>[]},application:{findFirst:async()=>({id:'application',status}),updateMany:async({where,data})=>{transitions.push(data);if(status!==where.status)return{count:0};status=data.status;return{count:1}}},applicationAnswer:{findMany:async()=>answers,deleteMany:async()=>{answers=[]},createMany:async({data})=>{answers=data}}}
 const api=unwrapActions(loader({'@/utils/auth':{requireAuth:async()=>({user:{id:userId}})},'@/utils/club-write-transaction':{clubWriteTransaction:fn=>fn(tx)},'@/utils/prisma':{prisma:{$transaction:fn=>fn(tx)}},'next/cache':{revalidatePath(){}}})('actions/applications.ts'))
 const input={clubId,expectedAnswers:student.applicationAnswersKey([]),answers:[{questionId,response:'draft incomplete over the word limit'}]}
 await api.saveApplicationDraft(input);await api.saveApplicationDraft(input);assert.equal(status,'DRAFTING');assert.ok(transitions.every(t=>t.submittedAt===undefined))
 await assert.rejects(api.saveApplicationDraft({...input,answers:[{questionId,response:'stale competing tab'}]}),/another tab/)
 status='SUBMITTED';await assert.rejects(api.saveApplicationDraft({...input,expectedAnswers:student.applicationAnswersKey(answers)}),/already been submitted/)
})
test('profile autosave compares only the current section and rejects competing edits while preserving other sections',async()=>{
 let current={firstName:'Alex',lastName:'Student',headshotUrl:null,major:'Math',experiences:[]};const expected=profile.profileSectionSnapshot(current,'identity')
 const tx={$queryRaw:async()=>[],user:{findUnique:async()=>({disabledAt:null})},studentProfile:{findUniqueOrThrow:async()=>current,update:async({data})=>current={...current,...data}}}
 const api=loader({'@/utils/auth':{requireAuth:async()=>({user:{id:userId}})},'@/utils/prisma':{prisma:{$transaction:fn=>fn(tx)}},'next/cache':{revalidatePath(){}}})('actions/profile.ts')
 const input={section:'identity',firstName:'Avery',lastName:'Student'};assert.ok((await api.updateStudentProfileSection(input,expected)).profile);assert.equal(current.major,'Math')
 assert.ok((await api.updateStudentProfileSection(input,expected)).profile)
 assert.match((await api.updateStudentProfileSection({...input,firstName:'Conflicting'},expected)).error,/another tab/);assert.equal(current.firstName,'Avery')
})
test('decision template autosave changes future wording without publishing decisions, letters, notifications or email',async()=>{
 const letters=loader({})('lib/decision-letters.ts');let templates={};const writes=[]
 const tx={club:{findUniqueOrThrow:async()=>({decisionLetterTemplates:templates}),update:async({data})=>{templates=data.decisionLetterTemplates;writes.push(data)}},auditLog:{create:async()=>{}}}
 const api=loader({'@/utils/auth':{requireClubPermission:async()=>({user:{id:userId}})},'@/utils/prisma':{prisma:{}},'@/utils/club-write-transaction':{clubWriteTransaction:fn=>fn(tx)},'@/lib/club-transaction-authorization':{authorizeClubTransaction:async()=>{}}})('actions/communications.ts')
 const next={ACCEPTED:{...letters.defaultLetters.ACCEPTED,body:'A private template'}}
 await api.saveDecisionTemplates(clubId,next,'{}');await api.saveDecisionTemplates(clubId,next,'{}')
 assert.equal((await refused(api.saveDecisionTemplates(clubId,{...next,ACCEPTED:{...next.ACCEPTED,body:'Other tab'}},'{}'),/another tab/)).code,'STALE')
 assert.ok(writes.every(data=>Object.keys(data).join(',')==='decisionLetterTemplates'))
})
test('the app may send the saved answers key as a SHA-256, so a long draft fits in one request',async()=>{
 const {createHash}=require('node:crypto');const hash=key=>'sha256:'+createHash('sha256').update(key,'utf8').digest('hex')
 const long='word '.repeat(19000)
 let answers=[{questionId,response:long}],status='DRAFTING'
 const tx={$queryRaw:async()=>[],studentProfile:{findUnique:async()=>({graduatedAt:null})},club:{findUnique:async()=>({testRequirement:'OPTIONAL'})},applicationQuestion:{findMany:async()=>[{id:questionId,type:'ESSAY',required:true,wordLimit:null}]},pipelineRound:{findFirst:async()=>({id:'round'})},recruitmentCycle:{findMany:async()=>[]},application:{findFirst:async()=>({id:'application',status}),updateMany:async({where,data})=>{if(status!==where.status)return{count:0};status=data.status;return{count:1}}},applicationAnswer:{findMany:async()=>answers,deleteMany:async()=>{answers=[]},createMany:async({data})=>{answers=data}}}
 const api=unwrapActions(loader({'@/utils/auth':{requireAuth:async()=>({user:{id:userId}})},'@/utils/club-write-transaction':{clubWriteTransaction:fn=>fn(tx)},'@/utils/prisma':{prisma:{$transaction:fn=>fn(tx)}},'next/cache':{revalidatePath(){}}})('actions/applications.ts'))
 const token=hash(student.applicationAnswersKey(answers))
 assert.ok(token.length<80)
 await api.saveApplicationDraft({clubId,expectedAnswers:token,answers:[{questionId,response:long+' more'}]})
 assert.equal(answers[0].response,long+' more')
 // Upper-case hex from a device is the same token.
 await api.saveApplicationDraft({clubId,expectedAnswers:'sha256:'+hash(student.applicationAnswersKey(answers)).slice(7).toUpperCase(),answers:[{questionId,response:'third'}]})
 assert.equal(answers[0].response,'third')
 // A token for answers the server no longer holds is a conflict, as with the plain key.
 await assert.rejects(api.saveApplicationDraft({clubId,expectedAnswers:token,answers:[{questionId,response:'stale device'}]}),/another tab/)
 assert.equal(answers[0].response,'third')
})
test('an answer to a follow-up that is now hidden does not block submission, but a hidden document answer is still checked',()=>{
 const choice=randomUUID(),followUp=randomUUID(),doc=randomUUID()
 const questions=[{id:choice,prompt:'Track',type:'MULTIPLE_CHOICE',required:true,options:['Business','Chassis'],wordLimit:null},{id:followUp,prompt:'Why business?',type:'ESSAY',required:true,wordLimit:5,showIf:{questionId:choice,anyOf:['Business']}},{id:doc,prompt:'Portfolio',type:'FILE_UPLOAD',required:false,wordLimit:null,showIf:{questionId:choice,anyOf:['Business']}}]
 const hidden=[{questionId:choice,response:'Chassis'},{questionId:followUp,response:'one two three four five six seven'}]
 assert.deepEqual(student.answerErrors(questions,hidden,true),{})
 assert.match(student.answerErrors(questions,[{questionId:choice,response:'Business'},hidden[1]],true)[followUp],/within 5 words/)
 assert.match(student.answerErrors(questions,[...hidden,{questionId:doc,response:'javascript:alert(1)'}],true)[doc],/uploaded PDF or a valid document URL/)
})
test('saving loads the questions in form order, so a visible follow-up is still checked when the database returns it before its parent', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../actions/applications.ts'), 'utf8')
  assert.match(source, /applicationQuestion\.findMany\(\{ where: \{ clubId: parsed\.clubId, archivedAt: null \}, orderBy: \[\{ order: "asc" \}, \{ id: "asc" \}\] \}\)/)
})
