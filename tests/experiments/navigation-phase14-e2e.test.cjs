// Built browser regression tests only. Held responses never enter benchmarks.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{Actor,readConfig}=require('../helpers/onboarding-e2e.cjs'),{featureChunks}=require('../helpers/deferred-feature-chunks.cjs');
const configFile=process.env.OUTCLASS_PHASE14_EXPERIMENT==='1'?process.env.OUTCLASS_ONBOARDING_E2E_CONFIG:undefined;
async function session(){
 const config=readConfig(configFile),fixture=JSON.parse(fs.readFileSync(path.join(path.dirname(configFile),'navigation-fixture.json'))),actor=new Actor(config);await actor.signIn(fixture.email,fixture.password);
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},storageState:{cookies:[...actor.cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/'})),origins:[]}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.name));
 return{config,fixture,actor,page,context,browser,errors,async close(){await context.close();await browser.close()}};
}
async function applicationSettings(s){
 await s.page.goto(s.config.appUrl+'/club/'+s.fixture.clubIds[0]+'/workspace?section=settings&setting=application');
 await s.page.getByText('Review settings',{exact:true}).waitFor();
 const details=s.page.locator('.oc-settings-workspace details').filter({has:s.page.locator('summary',{hasText:'Review settings'})});await details.locator('summary').click();
 await s.page.waitForLoadState('networkidle');
}
async function selectReview(s){await s.page.getByRole('link',{name:'Anonymous review',exact:true}).click()}
async function holdRounds(s){
 let seen,release;const pending=new Promise(resolve=>seen=resolve),gate=new Promise(resolve=>release=resolve);let count=0;
 await s.page.route('**/api/workspace?*',async route=>{
  if(new URL(route.request().url()).searchParams.get('kind')!=='rounds')return route.continue();
  count++;const response=await route.fetch();seen();await gate;await route.fulfill({response}).catch(()=>{});
 });
 return{pending,release,get count(){return count}};
}
test('selected review downloads its code while the live rounds response is still pending',{skip:!configFile,timeout:90000},async()=>{
 const s=await session();let held;
 try{
  await applicationSettings(s);const targets=new Set(featureChunks(s.config.buildDir).rounds);held=await holdRounds(s);
  // Requiring the request before releasing rounds distinguishes overlap from
  // the previous data-then-code waterfall, without asserting arbitrary speed.
  const code=s.page.waitForRequest(request=>targets.has(new URL(request.url()).pathname),{timeout:10000});
  await selectReview(s);await held.pending;
  const request=await code;assert.equal(request.resourceType(),'script');
  assert.equal(await s.page.getByRole('dialog',{name:'Anonymous Review',exact:true}).getByText('Previously viewed information cannot be recalled',{exact:false}).count(),0);
  held.release();await s.page.getByRole('dialog',{name:'Anonymous Review',exact:true}).getByText('Previously viewed information cannot be recalled',{exact:false}).waitFor();
  assert.equal(held.count,1);assert.deepEqual(s.errors,[]);
 }finally{held?.release();await s.close()}
});
test('abandoning and logging out during review loading cannot reveal a late editor or authorize a later read',{skip:!configFile,timeout:90000},async()=>{
 const s=await session();let held,releaseCode;
 try{
  await applicationSettings(s);const targets=new Set(featureChunks(s.config.buildDir).rounds);let seenCode;const pendingCode=new Promise(resolve=>seenCode=resolve),codeGate=new Promise(resolve=>releaseCode=resolve);
  await s.page.route('**/_next/static/chunks/**',async route=>{if(!targets.has(new URL(route.request().url()).pathname))return route.continue();const response=await route.fetch();seenCode();await codeGate;await route.fulfill({response}).catch(()=>{})});
  held=await holdRounds(s);await selectReview(s);await Promise.all([held.pending,pendingCode]);
  await s.page.getByRole('dialog',{name:'Anonymous Review',exact:true}).getByRole('button',{name:'Close',exact:true}).click();
  await s.page.getByRole('button',{name:/Account menu for/}).click();await s.page.getByRole('menuitem',{name:'Sign out',exact:true}).click();await s.page.waitForURL(s.config.appUrl+'/');
  held.release();releaseCode();await s.page.waitForLoadState('networkidle');
  assert.equal(await s.page.getByText('Previously viewed information cannot be recalled',{exact:false}).count(),0);
  const response=await s.actor.request('/api/workspace?'+new URLSearchParams({kind:'rounds',args:JSON.stringify([s.fixture.clubIds[0]])}));assert.equal(response.status,401);assert.deepEqual(s.errors,[]);
 }finally{held?.release();releaseCode?.();await s.close()}
});
