const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const clubId='00000000-0000-4000-8000-000000000001', applicationId='00000000-0000-4000-8000-000000000002', newRoundId='00000000-0000-4000-8000-000000000003'
function load(file, prisma, roles) {
 prisma.$transaction = async fn => fn(prisma); prisma.auditLog = {create: async () => ({})};
 const mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const mocks={'@/utils/prisma':{prisma},'@/utils/auth':{requireClubPermission:async(id,allowed)=>{roles.push([id,allowed]);return {user:{id:'actor'},membership:{id:'reviewer',permissions:['applications.review','applicants.identify']}}}},'next/cache':{revalidatePath:()=>{}}}
 new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:name.startsWith("@/lib/")?load(name.replace("@/", "")+".ts", {}, []):require(name),mod,mod.exports);return mod.exports
}
test('round moves reject foreign rounds before any mutation',async()=>{
 let written=false;const roles=[];const action=load('actions/crm.ts',{pipelineRound:{findFirst:async args=>{assert.deepEqual(args.where,{id:newRoundId,clubId});return null}},application:{updateMany:async()=>{written=true}}},roles)
 await assert.rejects(action.moveApplicantRound({clubId,applicationId,newRoundId}),/Round/);assert.equal(written,false)
 assert.deepEqual(roles[0],[clubId,['recruitment.manage','applicants.identify']])
})
test('status updates are decision-capability-only and scope mutations to non-draft applications in the club',async()=>{
 const roles=[];const action=load('actions/crm.ts',{application:{updateMany:async args=>{assert.deepEqual(args.where,{id:applicationId,clubId,status:{not:'DRAFTING'}});return {count:0}}}},roles)
 await assert.rejects(action.setApplicationStatus({clubId,applicationId,status:'ACCEPTED'}),/Application/)
 assert.deepEqual(roles[0],[clubId,['decisions.manage','applicants.identify']])
})
test('foreign applicant evaluation cannot write',async()=>{
 let written=false;const action=load('actions/evaluations.ts',{application:{findFirst:async args=>{assert.deepEqual(args.where,{id:applicationId,clubId,status:{not:'DRAFTING'}});return null}},evaluation:{upsert:async()=>{written=true}}},[])
 await assert.rejects(action.submitEvaluation({clubId,applicationId,roundName:'Review',score:8,notes:'Note'}),/Application/);assert.equal(written,false)
})
test('evaluation reads enforce club isolation within the database query',async()=>{
 const action=load('actions/evaluations.ts',{application:{findFirst:async()=>({round:{anonymousReview:false}})},evaluation:{findMany:async args=>{assert.deepEqual(args.where,{applicationId,application:{clubId,status:{not:'DRAFTING'}}});return []}}},[])
 assert.deepEqual(await action.getEvaluations(clubId,applicationId),{evaluations:[]})
})
test('valid evaluations preserve server scoring and reviewer identity',async()=>{
 const roles=[];let payload;const action=load('actions/evaluations.ts',{application:{findFirst:async()=>({id:applicationId,roundId:newRoundId})},pipelineRound:{findFirst:async()=>({id:newRoundId})},evaluation:{upsert:async args=>{payload=args;return {id:'eval'}}}},roles)
 await action.submitEvaluation({clubId,applicationId,roundName:'Review',score:8,notes:'Note'})
 assert.equal(payload.create.interviewerId,'reviewer');assert.equal(payload.create.score,8);assert.equal(payload.create.notes,'Note')
 await assert.rejects(action.submitEvaluation({clubId,applicationId,roundName:'Review',score:11}))
})

test('board decisions use the expected status and reject stale writes',async()=>{
 const roles=[];const action=load('actions/crm.ts',{application:{updateMany:async args=>{assert.deepEqual(args.where,{id:applicationId,clubId,status:'INTERVIEWING'});return {count:0}}}},roles)
 await assert.rejects(action.setApplicationStatus({clubId,applicationId,status:'ACCEPTED',expectedStatus:'INTERVIEWING'}),/Application/)
 assert.deepEqual(roles[0],[clubId,['decisions.manage','applicants.identify']])
})
