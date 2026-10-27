// Real Next + Auth + native PostgreSQL, reserved disposable project only.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client'),{chromium}=require('playwright');
const {Actor,readConfig}=require('./helpers/onboarding-e2e.cjs');
const configFile=process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
test('Phase 1 GET reads preserve live authority, no-store, Demo isolation and concurrent browser navigation',{skip:!configFile,timeout:120000},async t=>{
 const config=readConfig(configFile),fixture=JSON.parse(fs.readFileSync(path.join(path.dirname(configFile),'navigation-fixture.json'))),clubId=fixture.clubIds[0];
 const actor=new Actor(config);await actor.signIn(fixture.email,fixture.password);
 const db=new PrismaClient({datasourceUrl:config.status.DB_URL});
 const backups=[];
 for(const id of fixture.clubIds){const member=await db.clubMember.findFirstOrThrow({where:{clubId:id,userId:{not:fixture.userId},status:'ACTIVE'}});backups.push(member);await db.clubMember.update({where:{id:member.id},data:{isOwner:true,accessRole:'OWNER'}})}
 t.after(async()=>{for(const member of backups)await db.clubMember.update({where:{id:member.id},data:{isOwner:member.isOwner,accessRole:member.accessRole}});await db.$disconnect()});
 const read=(kind,args=[clubId])=>actor.request('/api/workspace?'+new URLSearchParams({kind,args:JSON.stringify(args)}));
 const kinds=['assignedRooms','interviewWorkspace','interviewRounds','roomWorkspace','tasks','meetings','announcements','voting'];
 await t.test('each migrated club read validates live authority and private response handling',async()=>{
  for(const kind of kinds){const r=await read(kind);assert.equal(r.status,200,kind);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('vary'),/(?:^|,\s*)Cookie(?:,|$)/);assert.match(r.headers.get('server-timing'),/identity;dur=.*live_session;dur=.*total;dur=/);await r.arrayBuffer()}
  assert.equal((await read('notifications',[])).status,200);
  assert.equal((await read('assignedRooms',[clubId,{userId:fixture.userId}])).status,400);
  // Verify the actual Demo cookie name rather than assuming the UI transport.
  const demoCookie=require('./helpers/voting-harness.cjs').load('lib/demo/access.ts').DEMO_COOKIE;
  const demo=await actor.request('/api/workspace?kind=assignedRooms&args='+encodeURIComponent(JSON.stringify([clubId])),{headers:{cookie:actor.cookieHeader()+'; '+demoCookie+'=1'}});assert.equal(demo.status,403);
 });
 await t.test('three independent Interview Rooms requests overlap, exclude the scheduler and tolerate rapid navigation',async()=>{
  const browser=await chromium.launch({headless:true});try{
   const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([...actor.cookies].map(([name,value])=>({name,value,url:config.appUrl})));
   const page=await context.newPage(),errors=[],reads=[];let active=0,max=0,record=false;
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(record&&r.url().includes('/api/workspace?')){const kind=new URL(r.url()).searchParams.get('kind');if(['assignedRooms','interviewWorkspace','interviewRounds'].includes(kind)){reads.push({r,kind,start:Date.now(),end:null});active++;max=Math.max(max,active)}}});
   const finish=r=>{const item=reads.find(x=>x.r===r);if(item&&!item.end){item.end=Date.now();active--}};page.on('requestfinished',finish);page.on('requestfailed',finish);
   await page.goto(config.appUrl+'/club/'+clubId+'/workspace?section=recruitment&tool=applicants');await page.locator('.oc-live-pipeline').getByText('Audit Student 000',{exact:false}).first().waitFor();
   record=true;await page.locator('[data-tour="nav-interviews"]').filter({visible:true}).first().click();await page.getByText('No assigned interviews.',{exact:true}).waitFor();
   assert.equal(reads.length,3);assert.equal(max,3);assert.ok(Math.max(...reads.map(r=>r.start))<Math.min(...reads.map(r=>r.end??Infinity)));assert.equal(await page.getByRole('heading',{name:'Interview scheduling',exact:true}).count(),0);
   record=false;
   for(let i=0;i<5;i++){let applicants=page.locator('[data-tour="nav-applicants"]').filter({visible:true}).first();if(!await applicants.count()){await page.getByRole('button',{name:'Applicants',exact:true}).filter({visible:true}).first().focus();await page.keyboard.press('ArrowRight');applicants=page.locator('[data-tour="nav-applicants"]').filter({visible:true}).first()}await applicants.focus();await page.keyboard.press('Enter');await page.locator('[data-tour="nav-interviews"]').filter({visible:true}).first().focus();await page.keyboard.press('Enter')}
   await page.getByText('No assigned interviews.',{exact:true}).waitFor();assert.deepEqual(errors,[]);await context.close();
  }finally{await browser.close()}
 });
 await t.test('GET preserves anonymous-round assignment projection and cross-club membership boundaries',async()=>{
  const round=await db.pipelineRound.findFirstOrThrow({where:{clubId,type:'INTERVIEW'}}),app=await db.application.findFirstOrThrow({where:{clubId,studentId:{not:fixture.userId}}}),member=await db.clubMember.findUniqueOrThrow({where:{userId_clubId:{userId:fixture.userId,clubId}}});
  const assignment=await db.interviewPanelAssignment.create({data:{applicationId:app.id,roundId:round.id,memberId:member.id,grantedBy:fixture.userId}});
  const decode=require('./helpers/voting-harness.cjs').load('lib/workspace-wire.ts').decodeWorkspaceData;
  try{assert.ok(decode(await (await read('interviewWorkspace')).json()).applications.some(row=>row.id===app.id));await db.pipelineRound.update({where:{id:round.id},data:{anonymousReview:true}});assert.equal(decode(await (await read('interviewWorkspace')).json()).applications.some(row=>row.id===app.id),false)}finally{await db.pipelineRound.update({where:{id:round.id},data:{anonymousReview:round.anonymousReview}});await db.interviewPanelAssignment.delete({where:{id:assignment.id}})}
  assert.equal((await read('assignedRooms',[require('node:crypto').randomUUID()])).status,403);
 });
 await t.test('capability removal and suspension deny the same read after earlier successful responses',async()=>{
  const member=await db.clubMember.findUniqueOrThrow({where:{userId_clubId:{userId:fixture.userId,clubId}}});
  try{await db.clubMember.update({where:{id:member.id},data:{isOwner:false,accessRole:'MEMBER',permissions:[],interviewOffices:[]}});assert.equal((await read('assignedRooms')).status,403)}finally{await db.clubMember.update({where:{id:member.id},data:{isOwner:member.isOwner,accessRole:member.accessRole,permissions:member.permissions,interviewOffices:member.interviewOffices}})}
  try{await db.club.update({where:{id:clubId},data:{suspendedAt:new Date()}});assert.equal((await read('assignedRooms')).status,403)}finally{await db.club.update({where:{id:clubId},data:{suspendedAt:null}})}
 });
 await t.test('disabled accounts and captured revoked cookies cannot replay GET reads',async()=>{
  try{await db.user.update({where:{id:fixture.userId},data:{disabledAt:new Date()}});assert.equal((await read('assignedRooms')).status,401)}finally{await db.user.update({where:{id:fixture.userId},data:{disabledAt:null}})}
  const captured=actor.cookieHeader();await actor.client.auth.signOut({scope:'local'});
  for(const kind of ['assignedRooms','interviewWorkspace','interviewRounds']){const r=await fetch(config.appUrl+'/api/workspace?'+new URLSearchParams({kind,args:JSON.stringify([clubId])}),{headers:{cookie:captured}});assert.equal(r.status,401,kind)}
 });
});
