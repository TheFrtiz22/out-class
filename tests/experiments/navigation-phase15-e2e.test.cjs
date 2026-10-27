// Real built-browser transport, live authority and draft tests; never benchmarks.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{PrismaClient}=require('@prisma/client'),{Actor,readConfig}=require('../helpers/onboarding-e2e.cjs');
const configFile=process.env.OUTCLASS_PHASE15_EXPERIMENT==='1'?process.env.OUTCLASS_ONBOARDING_E2E_CONFIG:undefined;
async function session(){
 const config=readConfig(configFile),fixture=JSON.parse(fs.readFileSync(path.join(path.dirname(configFile),'navigation-fixture.json'))),actor=new Actor(config);await actor.signIn(fixture.email,fixture.password);
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},storageState:{cookies:[...actor.cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/'})),origins:[]}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.name));
 return{config,fixture,actor,browser,context,page,errors,async close(){await context.close();await browser.close()}};
}
async function settings(s){
 await s.page.goto(s.config.appUrl+'/club/'+s.fixture.clubIds[0]+'/workspace?section=settings&setting=application');
 await s.page.getByText('Review settings',{exact:true}).waitFor();await s.page.waitForLoadState('networkidle');
}
async function reveal(s){const details=s.page.locator('.oc-settings-workspace details').filter({has:s.page.locator('summary',{hasText:'Review settings'})});if(!await details.evaluate(e=>e.open))await details.locator('summary').click()}
const review=s=>s.page.getByRole('dialog',{name:'Anonymous Review',exact:true}).getByText('Previously viewed information cannot be recalled',{exact:false});
function observe(s){const pageGets=[],rounds=[];const workspace=new URL(s.page.url()).pathname;s.page.on('request',q=>{if(q.method()==='GET'&&new URL(q.url()).pathname===workspace&&new URL(q.url()).searchParams.get('section')==='recruitment'&&['rounds','rules'].includes(new URL(q.url()).searchParams.get('tool')))pageGets.push(q)});s.page.on('response',q=>{if(new URL(q.url()).pathname==='/api/workspace'&&new URL(q.url()).searchParams.get('kind')==='rounds')rounds.push(q)});return{pageGets,rounds}}
test('review handoffs avoid an unused server page request and history revisits still read fresh',{skip:!configFile,timeout:90000},async()=>{
 const s=await session();try{
  await settings(s);const seen=observe(s);await reveal(s);await s.page.getByRole('link',{name:'Anonymous review',exact:true}).click();await review(s).waitFor();await s.page.waitForLoadState('networkidle');
  assert.equal(seen.pageGets.length,0,'Same-workspace review must not fetch another RSC page');assert.equal(seen.rounds.length,1);assert.equal(seen.rounds[0].status(),200);assert.equal(seen.rounds[0].headers()['cache-control'],'private, no-store');assert.match(seen.rounds[0].headers().vary,/Cookie/);
  assert.equal(new URL(s.page.url()).searchParams.get('tool'),'rounds');await s.page.goBack();await s.page.getByText('Review settings',{exact:true}).waitFor();await reveal(s);
  await s.page.getByRole('link',{name:'Anonymous review',exact:true}).click();await review(s).waitFor();assert.equal(seen.rounds.length,2,'Revisit requires fresh live authorization');
  await s.page.goBack();await s.page.getByText('Review settings',{exact:true}).waitFor();await reveal(s);await s.page.getByRole('link',{name:'Screening rules',exact:true}).click();await s.page.getByText('Saved rules suggest candidates for rejection review.',{exact:false}).waitFor();assert.equal(seen.pageGets.length,0);assert.deepEqual(s.errors,[]);
 }finally{await s.close()}
});
test('a revoked live session cannot reuse earlier review data through a query-only handoff',{skip:!configFile,timeout:90000},async()=>{
 const s=await session();try{
  await settings(s);await reveal(s);await s.page.getByRole('link',{name:'Anonymous review',exact:true}).click();await review(s).waitFor();await s.page.goBack();await s.page.getByText('Review settings',{exact:true}).waitFor();await reveal(s);
  const signedOut=await s.actor.client.auth.signOut({scope:'global'});assert.equal(signedOut.error,null);
  const response=s.page.waitForResponse(q=>new URL(q.url()).pathname==='/api/workspace'&&new URL(q.url()).searchParams.get('kind')==='rounds');await s.page.getByRole('link',{name:'Anonymous review',exact:true}).click();const denied=await response;assert.ok([401,403].includes(denied.status()));assert.equal(denied.headers()['cache-control'],'private, no-store');assert.match(denied.headers().vary,/Cookie/);
  await s.page.getByRole('alert').first().waitFor();assert.equal(await review(s).count(),0);assert.deepEqual(s.errors,[]);
 }finally{await s.close()}
});
test('application draft saving blocks the handoff and a saved draft survives Review and browser Back without publishing',{skip:!configFile,timeout:90000},async()=>{
 const s=await session(),db=new PrismaClient({datasourceUrl:s.config.status.DB_URL}),clubId=s.fixture.clubIds[0],key='application-builder:'+clubId+':main';let release;
 try{
  const before=await db.applicationQuestion.findMany({where:{clubId},orderBy:{order:'asc'},select:{id:true,prompt:true}});assert.ok(before.length);assert.equal(await db.editorDraft.findUnique({where:{userId_key:{userId:s.fixture.userId,key}}}),null);
  await settings(s);const input=s.page.getByRole('textbox',{name:/^Question/}).first();await input.waitFor();await s.page.waitForFunction(el=>!el.disabled,await input.elementHandle());await reveal(s);
  const manifest=JSON.parse(fs.readFileSync(path.join(s.config.buildDir,'server/server-reference-manifest.json'))),saveIds=new Set(Object.entries(manifest.node).filter(([,entry])=>entry.exportedName==='saveEditorDraft').map(([id])=>id));assert.ok(saveIds.size);
  let seen;const pending=new Promise(resolve=>seen=resolve),gate=new Promise(resolve=>release=resolve);await s.page.route('**/*',async route=>{if(route.request().method()!=='POST'||!saveIds.has(route.request().headers()['next-action']))return route.continue();const response=await route.fetch();seen();await gate;await route.fulfill({response}).catch(()=>{})});
  await input.fill('Phase15 durable handoff draft');await input.blur();await pending;await s.page.getByRole('link',{name:'Anonymous review',exact:true}).click();assert.equal(new URL(s.page.url()).searchParams.get('section'),'settings');assert.equal(await review(s).count(),0);
  release();await review(s).waitFor();assert.equal((await db.editorDraft.findUniqueOrThrow({where:{userId_key:{userId:s.fixture.userId,key}}})).content.questions[0].prompt,'Phase15 durable handoff draft');
  await s.page.goBack();await input.waitFor();await s.page.waitForFunction(el=>el.value==='Phase15 durable handoff draft',await input.elementHandle());assert.deepEqual(await db.applicationQuestion.findMany({where:{clubId},orderBy:{order:'asc'},select:{id:true,prompt:true}}),before);assert.deepEqual(s.errors,[]);
 }finally{release?.();await s.close();await db.editorDraft.deleteMany({where:{userId:s.fixture.userId,key}});await db.$disconnect()}
});
test('modified review links retain ordinary direct entry in a new browser tab',{skip:!configFile,timeout:90000},async()=>{
 const s=await session();try{
  await settings(s);await reveal(s);const original=s.page.url(),opened=s.context.waitForEvent('page');await s.page.getByRole('link',{name:'Anonymous review',exact:true}).click({modifiers:[process.platform==='darwin'?'Meta':'Control']});const page=await opened;await page.waitForURL('**/workspace?section=recruitment&tool=rounds');await page.getByText('Previously viewed information cannot be recalled',{exact:false}).waitFor();assert.equal(s.page.url(),original);await page.close();assert.deepEqual(s.errors,[]);
 }finally{await s.close()}
});
