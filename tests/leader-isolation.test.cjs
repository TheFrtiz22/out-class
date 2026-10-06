const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const clubId='00000000-0000-4000-8000-000000000001', applicationId='00000000-0000-4000-8000-000000000002', newRoundId='00000000-0000-4000-8000-000000000003'
function load(file, prisma, roles) {
 prisma.clubMember ||= {findFirst:async()=>({id:"reviewer",status:"ACTIVE",permissions:["applications.review","applicants.identify"]})}; prisma.$queryRaw ||= async()=>[]; prisma.$transaction = async fn => fn(prisma); prisma.auditLog = {create: async () => ({})};
 const mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const mocks={'@/utils/prisma':{prisma},'@/utils/auth':{requireClubPermission:async(id,allowed)=>{roles.push([id,allowed]);return {user:{id:'actor'},membership:{id:'reviewer',permissions:['applications.review','applicants.identify']}}}},'next/cache':{revalidatePath:()=>{}}}
 new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:name.startsWith("@/lib/")?load(name.replace("@/", "")+".ts", {}, []):require(name),mod,mod.exports);return mod.exports
}
test('round moves reject foreign rounds before any mutation',async()=>{
 let written=false;const roles=[];const action=load('actions/crm.ts',{pipelineRound:{findFirst:async args=>{assert.deepEqual(args.where,{id:newRoundId,clubId,archivedAt:null});return null}},application:{updateMany:async()=>{written=true}}},roles)
 await assert.rejects(action.moveApplicantRound({clubId,applicationId,newRoundId}),/Round/);assert.equal(written,false)
 assert.deepEqual(roles[0],[clubId,['recruitment.manage','applicants.identify']])
})
test('status updates are decision-capability-only and scope mutations to non-draft applications in the club',async()=>{
 const roles=[];const action=load('actions/crm.ts',{application:{updateMany:async args=>{assert.deepEqual(args.where,{id:applicationId,clubId,status:{not:'DRAFTING'}});return {count:0}}}},roles)
 await assert.rejects(action.setApplicationStatus({clubId,applicationId,status:'ACCEPTED'}),/Application/)
 assert.deepEqual(roles[0],[clubId,['decisions.manage','applicants.identify']])
})

test('foreign applicant evaluation cannot write',async()=>{ const h=require('./helpers/interview-harness.cjs').harness(),api=h.load('actions/evaluations.ts'); await assert.rejects(api.submitEvaluation({...h.scope,applicationId:newRoundId,roundName:'Interview',score:8}),/unavailable/);assert.equal(h.state.evaluations.length,0); });
test('evaluation reads enforce club and panel isolation',async()=>{const h=require('./helpers/interview-harness.cjs').harness(),api=h.load('actions/evaluations.ts');await assert.rejects(api.getEvaluations(newRoundId,applicationId),/unavailable/);h.as(11);h.assignments[1].revokedAt=new Date();await assert.rejects(api.getEvaluations(clubId,applicationId),/panel/);});
test('valid evaluations preserve stable round and server reviewer identity',async()=>{const h=require('./helpers/interview-harness.cjs').harness(),api=h.load('actions/evaluations.ts');await api.submitEvaluation({...h.scope,roundName:'Interview',score:8,notes:'Note'});assert.equal(h.state.evaluations[0].interviewerId,h.members[0].id);assert.equal(h.state.evaluations[0].roundId,h.scope.roundId);assert.equal(h.state.evaluations[0].notes,'Note');await assert.rejects(api.submitEvaluation({...h.scope,roundName:'Interview',score:8.25}));});

test('board decisions use the expected status and reject stale writes',async()=>{
 const roles=[];const action=load('actions/crm.ts',{application:{updateMany:async args=>{assert.deepEqual(args.where,{id:applicationId,clubId,status:'INTERVIEWING'});return {count:0}}}},roles)
 await assert.rejects(action.setApplicationStatus({clubId,applicationId,status:'ACCEPTED',expectedStatus:'INTERVIEWING'}),/Application/)
 assert.deepEqual(roles[0],[clubId,['decisions.manage','applicants.identify']])
})

test('round moves atomically check the expected round within the authorized club',async()=>{
 const expectedRoundId='00000000-0000-4000-8000-000000000004', roles=[]
 const action=load('actions/crm.ts',{pipelineRound:{findFirst:async()=>({id:newRoundId})},application:{updateMany:async args=>{
   assert.deepEqual(args.where,{id:applicationId,clubId,status:{not:'DRAFTING'},roundId:expectedRoundId})
   assert.deepEqual(args.data,{roundId:newRoundId})
   return {count:0}
 }}},roles)
 await assert.rejects(action.moveApplicantRound({clubId,applicationId,newRoundId,expectedRoundId}),/Application changed/)
 assert.deepEqual(roles[0],[clubId,['recruitment.manage','applicants.identify']])
})
