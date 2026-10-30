// Real production HTTP, verified local Auth and PostgreSQL. No performance gates.
const { test }=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { PrismaClient }=require('@prisma/client');
const { chromium }=require('playwright');
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
  let moved=null;
  try{
   if(size===1000){const app=await db.application.findFirstOrThrow({where:{clubId:club},select:{id:true,roundId:true}}),other=await db.pipelineRound.findFirstOrThrow({where:{clubId:club,type:'INTERVIEW'}});await db.application.update({where:{id:app.id},data:{roundId:other.id}});moved=app;}
   const member=await db.clubMember.findUniqueOrThrow({where:{userId_clubId:{userId:fixture.userId,clubId:club}}});
   const full=await read('pipeline'),first=await read('pipelinePage');
   assert.equal(full.applications.length,size);assert.equal(first.page.total,size);assert.equal(first.applications.length,Math.min(100,size));assert.equal(first.coverage.complete,size<=100);
   for(const query of [{},{query:'Scale Student 01000'},{query:'Student 000'},{major:'Economics'},{review:'unreviewed'},{review:'mine'},{sort:'score',descending:true},{sort:'year'},{sort:'round'},{roundId:full.rounds[1].id},{mode:'decisions',decisionGroup:'accepted'},{roundId:full.rounds[0].id}]){
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
  }finally{if(moved)await db.application.update({where:{id:moved.id},data:{roundId:moved.roundId}});await db.$disconnect();await actor.client.auth.signOut({scope:'local'});}
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

test('real desktop pointer and mobile touch support detail switching, global search and history for every cohort',{skip:!configFile,timeout:180000},async()=>{
 const config=readConfig(configFile),browser=await chromium.launch({headless:true});
 try{for(const size of [1,100,1000,5000])for(const touch of [false,true]){
  const f=JSON.parse(fs.readFileSync(path.join(path.dirname(configFile),'pipeline-release-'+size+'.json'))),actor=new Actor(config);await actor.signIn(f.email,f.password);
  const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1440,height:1000},isMobile:touch,hasTouch:touch,storageState:{cookies:[...actor.cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/'})),origins:[]}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.name));page.on('dialog',d=>d.accept());
  const activate=target=>touch?target.tap():target.click();
  try{
   await page.goto(config.appUrl+'/club/'+f.clubIds[0]+'/workspace?section=recruitment&tool=overview');
   // Fresh accounts can show the real non-modal guide over mobile content.
   // Close it through its accessible control, preserving ordinary pointer tests.
   const guide=page.getByRole('button',{name:'Dismiss tutorial',exact:true});
   try{await guide.waitFor({timeout:3000});await activate(guide);}catch(e){if(e.name!=='TimeoutError')throw e;}
   const entryRequests=[];const observeEntry=request=>entryRequests.push(request);page.on('request',observeEntry);
   await activate(page.locator('.oc-command-recruiting').getByRole('link',{name:'All applicants',exact:true}));
   const rows=()=>page.locator('[data-applicant-id]').filter({visible:true});await rows().first().waitFor();assert.equal(await rows().count(),Math.min(100,size));
   page.off('request',observeEntry);
   assert.equal(entryRequests.filter(request=>new URL(request.url()).searchParams.get('kind')==='pipelinePage').length,1,'Entry must still perform its fresh guarded page read');
   assert.equal(entryRequests.filter(request=>new URL(request.url()).pathname===new URL(page.url()).pathname&&request.headers().rsc==='1').length,0,'Same-workspace CTA must not wait on an unused server navigation');
   await activate(rows().first());await page.getByRole('heading',{name:'Audit Student 000',exact:true}).waitFor();
   await page.locator('[data-slot=sheet-content]').getByText('Synthetic application evidence.',{exact:false}).first().waitFor();
   if(size>1){await activate(page.getByRole('button',{name:'Next applicant',exact:true}));await page.getByRole('heading',{name:'Audit Student 001',exact:true}).waitFor();}
   await activate(page.locator('[data-slot=sheet-content]').getByRole('button',{name:'Close',exact:true}));await page.locator('[data-slot=sheet-content]').waitFor({state:'hidden'});
   const last=size<=100?'Audit Student '+String(size-1).padStart(3,'0'):'Scale Student '+String(size-1).padStart(5,'0');
   await page.getByRole('textbox',{name:'Search applicants',exact:true}).fill(last);await page.getByText(last,{exact:true}).filter({visible:true}).first().waitFor();assert.equal(await rows().count(),1);
   await page.goBack();await page.locator('.oc-command-recruiting').waitFor();await page.goForward();await rows().first().waitFor();assert.equal(await rows().count(),Math.min(100,size));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);console.log('cohort '+size+' '+(touch?'mobile touch':'desktop pointer')+' complete');
  }finally{await context.close();await actor.client.auth.signOut({scope:'local'});}
 }}finally{await browser.close();}
});
