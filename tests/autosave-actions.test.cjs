const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{loader}=require('./helpers/communications-loader.cjs')
const student=loader({})('lib/student-applications.ts'),profile=loader({})('lib/student-profile.ts'),clubId=randomUUID(),questionId=randomUUID(),userId=randomUUID()
test('application autosave compares persisted answers, permits idempotent retries, and never submits',async()=>{
 let answers=[],status='DRAFTING';const transitions=[]
 const tx={$queryRaw:async()=>[],club:{findUnique:async()=>({testRequirement:'OPTIONAL'})},applicationQuestion:{findMany:async()=>[{id:questionId,type:'ESSAY',required:true,wordLimit:3}]},pipelineRound:{findFirst:async()=>({id:'round'})},application:{findUnique:async()=>({id:'application',status}),updateMany:async({where,data})=>{transitions.push(data);if(status!==where.status)return{count:0};status=data.status;return{count:1}}},applicationAnswer:{findMany:async()=>answers,deleteMany:async()=>{answers=[]},createMany:async({data})=>{answers=data}}}
 const api=loader({'@/utils/auth':{requireAuth:async()=>({user:{id:userId}})},'@/utils/prisma':{prisma:{$transaction:fn=>fn(tx)}},'next/cache':{revalidatePath(){}}})('actions/applications.ts')
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
 await assert.rejects(api.saveDecisionTemplates(clubId,{...next,ACCEPTED:{...next.ACCEPTED,body:'Other tab'}},'{}'),/another tab/)
 assert.ok(writes.every(data=>Object.keys(data).join(',')==='decisionLetterTemplates'))
})
