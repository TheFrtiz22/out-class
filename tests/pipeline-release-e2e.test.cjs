// Real production HTTP, verified local Auth and PostgreSQL. No performance gates.
const { test }=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { PrismaClient }=require('@prisma/client');
const { Actor,readConfig }=require('./helpers/onboarding-e2e.cjs'),{ load }=require('./helpers/voting-harness.cjs');
const configFile=process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
const { decodeWorkspaceData }=load('lib/workspace-wire.ts'),{ pagePipeline,completePipelineSelection }=load('lib/pipeline-page.ts');

test('all four cohorts retain complete canonical counts, filters, ranking, details and voting selections',{skip:!configFile,timeout:240000},async t=>{
 const config=readConfig(configFile),root=path.dirname(configFile);
 for(const size of [1,100,1000,5000])await t.test(String(size),async()=>{
  const fixture=JSON.parse(fs.readFileSync(path.join(root,'pipeline-release-'+size+'.json'))),club=fixture.clubIds[0],actor=new Actor(config);
  await actor.signIn(fixture.email,fixture.password);
  const read=async(kind,query={})=>{const response=await actor.request('/api/workspace?'+new URLSearchParams({kind,args:JSON.stringify([club,query])}));assert.equal(response.status,200,kind);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('vary'),/Cookie/);return decodeWorkspaceData(await response.json());};
  const db=new PrismaClient({datasourceUrl:config.status.DB_URL});
  try{
   const member=await db.clubMember.findUniqueOrThrow({where:{userId_clubId:{userId:fixture.userId,clubId:club}}});
   const full=await read('pipeline'),first=await read('pipelinePage');
   assert.equal(full.applications.length,size);assert.equal(first.page.total,size);assert.equal(first.applications.length,Math.min(100,size));assert.equal(first.coverage.complete,size<=100);
   for(const query of [{},{query:'Scale Student 01000'},{query:'Student 000'},{major:'Economics'},{review:'unreviewed'},{review:'mine'},{sort:'score',descending:true},{sort:'year'},{mode:'decisions',decisionGroup:'accepted'},{roundId:full.rounds[0].id}]){
    const page=await read('pipelinePage',query),canonical=pagePipeline(full,query,member.id,member.userId,page.page.scope);
    assert.deepEqual(page.applications,canonical.applications,'full authorized details, not a partial summary');assert.deepEqual(page.page,canonical.page);assert.deepEqual(page.facets,canonical.facets);
    assert.deepEqual(await read('pipelineSelection',query),completePipelineSelection(full,query,member.id,member.userId));
   }
   const seen=[...first.applications.map(a=>a.id)];let page=first;
   while(page.page.next){page=await read('pipelinePage',{cursor:page.page.next});seen.push(...page.applications.map(a=>a.id));assert.ok(page.applications.length<=100);}
   assert.equal(seen.length,size);assert.equal(new Set(seen).size,size);
   const response=await actor.request('/api/workspace?'+new URLSearchParams({kind:'voting',args:JSON.stringify([club,null,{}])}));assert.equal(response.status,200);
   const voting=decodeWorkspaceData(await response.json());assert.deepEqual(voting.candidateSelection,completePipelineSelection(full,{},member.id,member.userId));
   assert.ok(voting.candidateSelection.applications.every(a=>Object.keys(a).sort().join(',')==='canQuickReview,id,roundId,status'));
  }finally{await db.$disconnect();await actor.client.auth.signOut({scope:'local'});}
 });
});

test('complete-page and voting reads never reuse successful authority after permission, suspension or session revocation',{skip:!configFile,timeout:60000},async()=>{
 const config=readConfig(configFile),f=JSON.parse(fs.readFileSync(path.join(path.dirname(configFile),'pipeline-release-1.json'))),club=f.clubIds[0],actor=new Actor(config),db=new PrismaClient({datasourceUrl:config.status.DB_URL});await actor.signIn(f.email,f.password);
 const read=(kind,cookie)=>actor.request('/api/workspace?'+new URLSearchParams({kind,args:JSON.stringify(kind==='voting'?[club,null,{}]:[club,{}])}),cookie?{headers:{cookie}}:{});
 const member=await db.clubMember.findUniqueOrThrow({where:{userId_clubId:{userId:f.userId,clubId:club}}});
 try{
  for(const kind of ['pipelinePage','pipelineSelection','voting'])assert.equal((await read(kind)).status,200);
  try{await db.clubMember.update({where:{id:member.id},data:{isOwner:false,permissions:[],interviewOffices:[],accessRole:'MEMBER'}});for(const kind of ['pipelinePage','pipelineSelection','voting'])assert.equal((await read(kind)).status,403);}finally{await db.clubMember.update({where:{id:member.id},data:{isOwner:member.isOwner,permissions:member.permissions,interviewOffices:member.interviewOffices,accessRole:member.accessRole}});}
  try{await db.club.update({where:{id:club},data:{suspendedAt:new Date()}});assert.equal((await read('voting')).status,403);}finally{await db.club.update({where:{id:club},data:{suspendedAt:null}});}
  const cookie=actor.cookieHeader();await actor.client.auth.signOut({scope:'local'});for(const kind of ['pipelinePage','pipelineSelection','voting'])assert.equal((await read(kind,cookie)).status,401);
 }finally{await db.$disconnect();}
});
