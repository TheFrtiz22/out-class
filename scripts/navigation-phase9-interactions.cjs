// Additional warm interactions on the same frozen builds/cohorts as the primary
// harness. No interception, seeded delay, mutation, or benchmark-only app path.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks'),{chromium}=require('playwright');
const local=require('./navigation-phase9-local.cjs'),{Actor}=require('../tests/helpers/onboarding-e2e.cjs'),{safeRoute}=require('./navigation-audit.cjs');
async function main(){
 const out=path.resolve(process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'');assert.ok(out.startsWith(path.join(local.repo,'docs/performance/phase9')+path.sep)&&!fs.existsSync(out));
 const f=JSON.parse(fs.readFileSync(path.join(local.root,'navigation-fixture.json'))),size=f.counts.applicantsInMeasuredClub||100;assert.ok(size>=1000);
 const actor=new Actor(local.config());await actor.signIn(f.email,f.password);const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},storageState:{cookies:[...actor.cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/'})),origins:[]}}),page=await context.newPage(),requests=[],pending=new Set(),errors=[],samples=[];
 page.on('pageerror',e=>errors.push(e.name));page.on('request',r=>{const row={request:r,route:safeRoute(r.url()),type:r.resourceType(),start:performance.now(),end:null,status:null,bytes:null};requests.push(row);if(row.type!=='eventsource')pending.add(r)});
 page.on('response',r=>{const row=requests.find(q=>q.request===r.request());if(row){row.status=r.status();row.serverTiming=r.headers()['server-timing']||null;row.traceId=r.headers()['x-outclass-trace-id']||null}});
 page.on('requestfinished',r=>{pending.delete(r);const row=requests.find(q=>q.request===r);if(row){row.end=performance.now();row.timing=r.timing();void r.sizes().then(s=>row.bytes=s.responseBodySize).catch(()=>{})}});page.on('requestfailed',r=>{pending.delete(r);const row=requests.find(q=>q.request===r);if(row){row.end=performance.now();row.failed=true}});
 async function drain(){const until=performance.now()+10000;while(pending.size&&performance.now()<until)await new Promise(r=>setTimeout(r,20));assert.equal(pending.size,0,'Unfinished non-SSE request');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
 async function capture(kind,index,target,action){
  await drain();const offset=requests.length,errorOffset=errors.length,start=performance.now();let failed=null,meaningfulMs=null,marks=null,driverElapsedMs=null;
  await page.evaluate(({target,event})=>{
   const state={start:0,ready:0,scheduled:false,origin:performance.timeOrigin};window.__phase9Paint=state;
   const check=()=>{if(!state.start||state.scheduled)return;const found=[...document.querySelectorAll('.oc-live-pipeline [data-applicant-id]')].some(e=>e.getClientRects().length&&e.textContent.includes(target));if(!found)return;state.scheduled=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{state.ready=performance.now()}))};
   const begin=()=>{if(!state.start)state.start=performance.now();queueMicrotask(check)};
   document.addEventListener(event,begin,true);const observer=new MutationObserver(check);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true});state.check=check;state.cleanup=()=>{observer.disconnect();document.removeEventListener(event,begin,true)};
  },{target,event:kind==='next-page'?'click':'input'});
  try{await action();await page.evaluate(()=>window.__phase9Paint.check());await page.waitForFunction(()=>window.__phase9Paint.ready>0,null,{timeout:30000});marks=await page.evaluate(()=>{const s=window.__phase9Paint;s.cleanup();return{start:s.start,ready:s.ready,origin:s.origin}});meaningfulMs=marks.ready-marks.start;driverElapsedMs=performance.now()-start;await drain()}catch(e){failed=e.name;process.exitCode=1;await page.evaluate(()=>window.__phase9Paint.cleanup()).catch(()=>{})}
  const origin=marks?marks.origin+marks.start:performance.timeOrigin+start;
  const rows=requests.slice(offset).map(r=>({route:r.route,type:r.type,startMs:performance.timeOrigin+r.start-origin,endMs:r.end===null?null:performance.timeOrigin+r.end-origin,status:r.status,failed:!!r.failed,encodedBodyBytes:r.bytes,ttfbMs:r.timing?.responseStart>=0?r.timing.responseStart:null,transferMs:r.timing?.responseEnd>=0&&r.timing?.responseStart>=0?r.timing.responseEnd-r.timing.responseStart:null,serverTiming:r.serverTiming,traceId:r.traceId}));
  samples.push({kind,index,warmup:index===0,condition:'warm',failed,meaningfulMs,driverElapsedMs,requestCount:rows.length,encodedBodyBytes:rows.every(r=>Number.isFinite(r.encodedBodyBytes))?rows.reduce((n,r)=>n+r.encodedBodyBytes,0):null,pageErrors:errors.slice(errorOffset),requests:rows});
 }
 try{
  await page.goto(local.config().appUrl+'/club/'+f.clubIds[0]+'/workspace?section=recruitment&tool=applicants');await page.getByText('Audit Student 000',{exact:true}).first().waitFor();await page.waitForLoadState('networkidle');await drain();const pager=page.getByRole('navigation',{name:'Applicant pages',exact:true}),search=page.getByRole('textbox',{name:'Search applicants',exact:true}),last='Scale Student '+String(size-1).padStart(5,'0');
  for(let i=0;i<6;i++){
   await capture('next-page',i,'Scale Student 00100',()=>pager.getByRole('button',{name:'Next applicant page',exact:true}).click());
   await pager.getByRole('button',{name:'Previous applicant page',exact:true}).click();await page.getByText('Audit Student 000',{exact:true}).first().waitFor();await drain();
   await capture('distant-search',i,last,()=>search.fill(last));
   assert.equal(await page.locator('[data-applicant-id]').filter({visible:true}).count(),1);assert.equal(await search.evaluate(e=>document.activeElement===e),true);
   await search.fill('');await page.getByText('Audit Student 000',{exact:true}).first().waitFor();await drain();
  }
 }finally{fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({buildId:fs.readFileSync(path.join(local.dist,'BUILD_ID'),'utf8').trim(),size,planned:12,samples,errors,interpretation:'Warm interactions only. Browser event timestamp to MutationObserver content predicate plus two animation frames; driver polling/dispatch is excluded from meaningfulMs and separately retained as driverElapsedMs. Initial preparation, restoration and one warmup per interaction excluded from measured distribution. All failures retained; no retries.'},null,2)+'\n');await context.close();await browser.close()}
}
if(require.main===module)main().catch(e=>{console.error(e.name+': interaction study failed');process.exitCode=1});
