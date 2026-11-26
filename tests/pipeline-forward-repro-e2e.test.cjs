// Diagnosis only (not for merge): repeat Applicants → search → Back → Forward on the real stack and record, for any
// attempt that ends without rows, every workspace read, auth event and console error, plus a Playwright trace.
const { test }=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const { chromium }=require('playwright');
const { Actor,readConfig }=require('./helpers/onboarding-e2e.cjs');
const configFile=process.env.OUTCLASS_ONBOARDING_E2E_CONFIG,out=path.resolve('test-results/pipeline-forward');
const ATTEMPTS=Number(process.env.OUTCLASS_REPRO_ATTEMPTS||30);

test('Applicants list after Back then Forward: repeated attempts with full read logs',{skip:!configFile,timeout:1800000},async()=>{
 fs.mkdirSync(out,{recursive:true});
 const config=readConfig(configFile),browser=await chromium.launch({headless:true}),failures=[];
 try{for(const size of [100,1000])for(const touch of [false,true]){
  const f=JSON.parse(fs.readFileSync(path.join(path.dirname(configFile),'pipeline-release-'+size+'.json'))),actor=new Actor(config);await actor.signIn(f.email,f.password);
  const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1440,height:1000},isMobile:touch,hasTouch:touch,storageState:{cookies:[...actor.cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/'})),origins:[]}});
  await context.addInitScript(()=>{window.__reads=[];addEventListener('outclass:workspace-read',e=>window.__reads.push({t:Math.round(performance.now()),...e.detail}))});
  const page=await context.newPage(),log=[];const t0=Date.now();const at=()=>Date.now()-t0;
  page.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/api/workspace')log.push({t:at(),ev:'req',kind:u.searchParams.get('kind')});else if(r.headers().rsc==='1')log.push({t:at(),ev:'rsc',path:u.pathname+u.search.replace(/clubId=[^&]+/,'')})});
  page.on('response',r=>{const u=new URL(r.url());if(u.pathname==='/api/workspace')log.push({t:at(),ev:'res',kind:u.searchParams.get('kind'),status:r.status()})});
  page.on('requestfailed',r=>{const u=new URL(r.url());if(u.pathname==='/api/workspace')log.push({t:at(),ev:'fail',kind:u.searchParams.get('kind'),err:r.failure()?.errorText})});
  page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')log.push({t:at(),ev:'console',type:m.type(),text:m.text().slice(0,200)})});
  page.on('pageerror',e=>log.push({t:at(),ev:'pageerror',text:String(e).slice(0,200)}));
  page.on('dialog',d=>d.accept());
  const rows=()=>page.locator('[data-applicant-id]').filter({visible:true});
  const activate=target=>touch?target.tap():target.click();
  const label=`${size}-${touch?'touch':'pointer'}`;
  try{
   await page.goto(config.appUrl+'/club/'+f.clubIds[0]+'/workspace?section=recruitment&tool=overview');
   const guide=page.getByRole('button',{name:'Dismiss tutorial',exact:true});try{await guide.waitFor({timeout:3000});await activate(guide);}catch(e){if(e.name!=='TimeoutError')throw e;}
   for(let i=0;i<ATTEMPTS;i++){
    await context.tracing.start({screenshots:true,snapshots:true});log.length=0;
    await page.evaluate(()=>{window.__reads.length=0});
    if(i===0){await activate(page.locator('.oc-command-recruiting').getByRole('link',{name:'All applicants',exact:true}));await page.locator('.oc-command-recruiting').waitFor({state:'hidden'});}
    await rows().first().waitFor({timeout:20000});
    const last=size<=100?'Audit Student '+String(size-1).padStart(3,'0'):'Scale Student '+String(size-1).padStart(5,'0');
    const box=page.getByRole('searchbox',{name:'Search applicants',exact:true});await box.fill(last);
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-applicant-id]')).filter(e=>e.getClientRects().length>0).length===1,null,{timeout:15000}).catch(()=>{});
    log.push({t:at(),ev:'step',name:'back'});await page.goBack();await page.locator('.oc-command-recruiting').waitFor();
    log.push({t:at(),ev:'step',name:'forward'});await page.goForward();await page.locator('.oc-command-recruiting').waitFor({state:'hidden'});
    const ok=await page.waitForFunction(n=>Array.from(document.querySelectorAll('[data-applicant-id]')).filter(e=>e.getClientRects().length>0).length===n,Math.min(100,size),{timeout:15000}).then(()=>true,()=>false);
    if(!ok){
     const state=await page.evaluate(()=>({url:location.pathname+location.search,visible:Array.from(document.querySelectorAll('[data-applicant-id]')).filter(e=>e.getClientRects().length>0).length,main:document.querySelector('main')?.innerText.slice(0,300),reads:window.__reads}));
     const name=`${label}-attempt-${i}`;await context.tracing.stop({path:path.join(out,name+'.zip')});
     fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify({state,log},null,1));failures.push(name);console.log('REPRO-FAIL',name,JSON.stringify({state,log}).slice(0,3000));
     await page.reload();await rows().first().waitFor({timeout:30000}).catch(()=>{});
    }else await context.tracing.stop();
   }
   console.log(`cohort ${label}: ${ATTEMPTS} attempts done`);
  }finally{await context.close();await actor.client.auth.signOut({scope:'local'});}
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({attempts:ATTEMPTS,failures},null,1));
 assert.deepEqual(failures,[],`${failures.length} attempt(s) ended without rows after Forward`);
});
