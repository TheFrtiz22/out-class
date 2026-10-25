// Real HTTP/Auth/database parity; only the reserved disposable fixture is used.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client'),{Actor,readConfig}=require('./helpers/onboarding-e2e.cjs'),{load}=require('./helpers/voting-harness.cjs');
const configFile=process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
test('narrow summaries retain canonical filtering, score barriers and fresh assignment/privacy authority over real HTTP',{skip:!configFile,timeout:180000},async()=>{
 const config=readConfig(configFile),f=JSON.parse(fs.readFileSync(path.join(path.dirname(configFile),'navigation-fixture.json'))),club=f.clubIds[1],actor=new Actor(config);await actor.signIn(f.email,f.password);
 const db=new PrismaClient({datasourceUrl:config.status.DB_URL}),decode=load('lib/workspace-wire.ts').decodeWorkspaceData,project=load('lib/pipeline-list.ts').pipelineListProjection,{pagePipeline,completePipelineSelection}=load('lib/pipeline-page.ts');
 const member=await db.clubMember.findUniqueOrThrow({where:{userId_clubId:{userId:f.userId,clubId:club}}}),backup=await db.clubMember.findFirstOrThrow({where:{clubId:club,userId:{not:f.userId}}}),round=await db.pipelineRound.findFirstOrThrow({where:{clubId:club,type:'APPLICATION_REVIEW'}}),history=await db.pipelineRound.findFirstOrThrow({where:{clubId:club,type:'INTERVIEW'}}),app=await db.application.findFirstOrThrow({where:{clubId:club,studentId:{not:backup.userId},evaluations:{none:{}}}});
 const reviews=[],assignments=[];
 async function read(kind,q={}){const response=await actor.request('/api/workspace?'+new URLSearchParams({kind,args:JSON.stringify([club,q])}));assert.equal(response.status,200,kind);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary'),/Cookie/);return decode(await response.json())}
 try{
  await db.clubMember.update({where:{id:backup.id},data:{isOwner:true,accessRole:'OWNER'}});
  for(const m of [member,backup])assignments.push(await db.interviewPanelAssignment.create({data:{applicationId:app.id,roundId:round.id,memberId:m.id,grantedBy:f.userId}}));
  for(const [m,r,score,submittedAt]of [[member,round,10,null],[backup,round,6,new Date()],[backup,history,9,new Date()]])reviews.push(await db.evaluation.create({data:{applicationId:app.id,interviewerId:m.id,roundId:r.id,round:r.name,score,submittedAt,notes:'PRIVATE PHASE 6 CANARY'}}));
  const scenarios=[
   {anonymous:false,office:[],permissions:['applications.review','applicants.identify'],submitted:false,revoked:false},
   {anonymous:false,office:['PRESIDENT'],permissions:['applications.review','applicants.identify'],submitted:false,revoked:false},
   {anonymous:false,office:[],permissions:['applications.review','applicants.identify'],submitted:true,revoked:false},
   {anonymous:false,office:['PRESIDENT'],permissions:['applications.review','applicants.identify'],submitted:true,revoked:true},
   {anonymous:true,office:[],permissions:['applications.review'],submitted:true,revoked:false},
  ];
  let published=false;
  for(const s of scenarios){
   await db.clubMember.update({where:{id:member.id},data:{isOwner:false,accessRole:'MEMBER',permissions:s.permissions,interviewOffices:s.office}});
   await db.pipelineRound.update({where:{id:round.id},data:{anonymousReview:s.anonymous}});
   if(s.submitted && !published){await db.evaluation.update({where:{id:reviews[0].id},data:{submittedAt:new Date()}});published=true}
   await db.interviewPanelAssignment.update({where:{id:assignments[0].id},data:{revokedAt:s.revoked?new Date():null}});
   const canonical=project(await read('pipeline'));assert.deepEqual(await read('pipelineList'),canonical);
   const target=canonical.applications.find(a=>a.id===app.id);
   if(!s.submitted || s.anonymous){assert.equal(target.roundScore,null);assert.deepEqual(target.evaluations,[])}
   else assert.equal(target.roundScore.average,8);
   const queries=[{},...['name','round','year','gpa','sat','act','status','score'].map(sort=>({sort,descending:true})),{rating:7},{review:'mine'},{review:'unreviewed'},{query:'Audit Student 099'},{major:'Economics'},{year:canonical.applications[0].student.studentProfile.academicYear},{query:'PRIVATE PHASE 6 CANARY'}];
   for(const query of queries){const page=await read('pipelinePage',query);assert.deepEqual(page,pagePipeline(canonical,query,member.id,f.userId,page.page.scope));assert.deepEqual(await read('pipelineSelection',query),completePipelineSelection(canonical,query,member.id,f.userId))}
  }
 }finally{
  // Published reviews are immutable history. Retain them until fixture teardown.
  await db.interviewPanelAssignment.updateMany({where:{id:{in:assignments.map(a=>a.id)}},data:{revokedAt:new Date()}});
  await db.pipelineRound.update({where:{id:round.id},data:{anonymousReview:round.anonymousReview}});
  await db.clubMember.update({where:{id:member.id},data:{isOwner:member.isOwner,accessRole:member.accessRole,permissions:member.permissions,interviewOffices:member.interviewOffices}});
  await db.clubMember.update({where:{id:backup.id},data:{isOwner:backup.isOwner,accessRole:backup.accessRole}});await db.$disconnect();
 }
});
