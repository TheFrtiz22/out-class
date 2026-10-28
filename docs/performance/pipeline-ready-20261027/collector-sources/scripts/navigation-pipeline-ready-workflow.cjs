// Same read-only workflow on both builds: enter applicants, open detail, close,
// search the distant applicant. No score edits, seeded delays or mutations.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const {chromium}=require('playwright'),{Actor}=require('../tests/helpers/onboarding-e2e.cjs');
const local=require('./navigation-pipeline-ready-local.cjs'),{safeRoute}=require('./navigation-audit.cjs');
function installWorkflowObserver(last){
 const s={start:0,entry:0,detailStart:0,detail:0,searchStart:0,search:0,scheduled:{}};window.__pipelineWorkflow=s;
 const ready=(key,predicate)=>{if(s[key]||s.scheduled[key]||!predicate())return;s.scheduled[key]=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(predicate())s[key]=performance.now();else s.scheduled[key]=false}))};
 const visible=el=>el&&el.getClientRects().length>0;
 const check=()=>{
  if(!s.start)return;
  ready('entry',()=>[...document.querySelectorAll('.oc-live-pipeline [data-applicant-id]')].some(el=>visible(el)&&el.textContent.includes('Audit Student 000')));
  if(s.detailStart)ready('detail',()=>[...document.querySelectorAll('[data-slot="sheet-content"]')].some(el=>visible(el)&&el.textContent.includes('Audit Student 000')&&el.textContent.includes('Synthetic application evidence.')));
  if(s.searchStart)ready('search',()=>{const rows=[...document.querySelectorAll('.oc-live-pipeline [data-applicant-id]')].filter(visible);return rows.length===1&&rows[0].textContent.includes(last)});
 };
 const click=event=>{if(event.target.closest('[data-tour="nav-applicants"], .oc-command-recruiting a[href*="tool=applicants"]')&&!s.start)s.start=performance.now();if(s.entry&&!s.detailStart&&event.target.closest('[data-applicant-id]'))s.detailStart=performance.now();queueMicrotask(check)};
 const input=event=>{if(s.detail&&event.target.matches('[aria-label="Search applicants"]')&&!s.searchStart)s.searchStart=performance.now();queueMicrotask(check)};
 document.addEventListener('click',click,true);document.addEventListener('input',input,true);const observer=new MutationObserver(check);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true});s.check=check;s.cleanup=()=>{observer.disconnect();document.removeEventListener('click',click,true);document.removeEventListener('input',input,true)};
}
function evidenceFile(value,repo=local.repo){const out=path.resolve(value||'');assert.ok(out.startsWith(path.join(repo,'docs/performance/pipeline-ready-20261027')+path.sep)&&out.endsWith('.json')&&!fs.existsSync(out));return out;}
async function main(){
 const out=evidenceFile(process.argv.find(a=>a.startsWith('--out='))?.slice(6)),config=local.config(),fixture=JSON.parse(fs.readFileSync(path.join(local.root,'navigation-fixture.json'))),size=fixture.counts.applicantsInMeasuredClub||100;
 assert.ok([100,1000,5000].includes(size));const last=size===100?'Audit Student 099':'Scale Student '+String(size-1).padStart(5,'0');
 const actor=new Actor(config);await actor.signIn(fixture.email,fixture.password);
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},storageState:{cookies:[...actor.cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/'})),origins:[]}}),page=await context.newPage(),requests=[],pending=new Set(),errors=[],samples=[];
 const cdp=await context.newCDPSession(page);if(process.argv.includes('--constrained-network')){await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:200000,uploadThroughput:93750,connectionType:'cellular4g'});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})}
 page.on('pageerror',e=>errors.push(e.name));page.on('request',request=>{requests.push({request,route:safeRoute(request.url()),type:request.resourceType(),start:performance.timeOrigin+performance.now(),end:null,status:null,bytes:null});if(request.resourceType()!=='eventsource')pending.add(request)});
 page.on('response',response=>{const row=requests.find(r=>r.request===response.request());if(row){row.status=response.status();row.serverTiming=response.headers()['server-timing']||null;const id=response.headers()['x-outclass-trace-id'];row.traceId=/^[\da-f-]{36}$/i.test(id||'')?id:null}});
 page.on('requestfinished',request=>{pending.delete(request);const row=requests.find(r=>r.request===request);if(row){row.end=performance.timeOrigin+performance.now();row.timing=request.timing();void request.sizes().then(s=>row.bytes=s.responseBodySize).catch(()=>{})}});
 page.on('requestfailed',request=>{pending.delete(request);const row=requests.find(r=>r.request===request);if(row){row.end=performance.timeOrigin+performance.now();row.failed=true}});
 async function drain(){const until=performance.now()+10000;while(pending.size&&performance.now()<until)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(pending.size,0,'Unfinished non-SSE request');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))}
 try{
  for(let index=0;index<4;index++){
   let failed=null,marks=null,stage='prepare',offset=requests.length,errorOffset=errors.length;
   try{
    // Match the primary collector's explicit source preparation. Keep browser
    // asset caches warm while starting every flow from the same real document.
    await page.goto(config.appUrl+'/club/'+fixture.clubIds[0]+'/workspace?section=recruitment&tool=overview');
    await page.locator('.oc-command-recruiting').getByRole('button',{name:'Refresh overview',exact:true}).waitFor();await drain();const link=page.locator('.oc-command-recruiting').getByRole('link',{name:'All applicants',exact:true});
    offset=requests.length;errorOffset=errors.length;await page.evaluate(installWorkflowObserver,last);stage='entry';await link.click();await page.evaluate(()=>window.__pipelineWorkflow.check());await page.waitForFunction(()=>window.__pipelineWorkflow.entry>0,null,{timeout:30000});
    stage='detail';await page.locator('.oc-live-pipeline [data-applicant-id]').filter({visible:true}).first().click();await page.waitForFunction(()=>window.__pipelineWorkflow.detail>0,null,{timeout:30000});
    const sheet=page.locator('[data-slot="sheet-content"]');stage='close';await sheet.getByRole('button',{name:'Close',exact:true}).click();await sheet.waitFor({state:'hidden'});
    stage='search';await page.getByRole('textbox',{name:'Search applicants',exact:true}).fill(last);await page.waitForFunction(()=>window.__pipelineWorkflow.search>0,null,{timeout:30000});
    marks=await page.evaluate(()=>{const s=window.__pipelineWorkflow;s.cleanup();return{origin:performance.timeOrigin,start:s.start,entry:s.entry,detailStart:s.detailStart,detail:s.detail,searchStart:s.searchStart,search:s.search}});stage='drain';await drain();
   }catch(e){failed=e.name;await page.evaluate(()=>window.__pipelineWorkflow?.cleanup()).catch(()=>{})}
   const start=marks?marks.origin+marks.start:null,rows=requests.slice(offset).map(r=>({route:r.route,type:r.type,startMs:start===null?null:r.start-start,endMs:start===null||r.end===null?null:r.end-start,status:r.status,failed:!!r.failed,encodedBodyBytes:r.bytes,ttfbMs:r.timing?.responseStart>=0?r.timing.responseStart:null,serverTiming:r.serverTiming||null,traceId:r.traceId||null}));
   const entry=marks?marks.entry-marks.start:null,detail=marks?marks.detail-marks.detailStart:null,search=marks?marks.search-marks.searchStart:null,total=marks?marks.search-marks.start:null;
   const pageErrors=errors.slice(errorOffset),httpErrors=rows.filter(r=>r.status>=400).length;if(pageErrors.length&&!failed)failed='page_error';if(httpErrors&&!failed)failed='http_error';
   samples.push({index,warmup:index===0,condition:'warm_browser_context_fresh_source',failed,failedAt:failed?stage:null,meaningfulMs:total,entryMs:entry,detailMs:detail,searchMs:search,automationGapMs:marks?total-entry-detail-search:null,requestCount:rows.length,encodedBodyBytes:rows.every(r=>Number.isFinite(r.encodedBodyBytes))?rows.reduce((n,r)=>n+r.encodedBodyBytes,0):null,unknownBodyByteCount:rows.filter(r=>!Number.isFinite(r.encodedBodyBytes)).length,httpErrors,pageErrors,requests:rows});
   if(failed)process.exitCode=1;
  }
 }finally{
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({buildId:fs.readFileSync(path.join(local.dist,'BUILD_ID'),'utf8').trim(),size,planned:4,samples,errors,interpretation:'Supplementary common workflow uses the Overview All applicants CTA on both builds; every flow starts from a direct Overview document in the same warm browser context, with fresh React/Auth initialization and cached assets. The primary navigation collector keeps its existing menu/keyboard path. One warmup then three measured workflows per block. DOM event to actual content plus two animation frames. Total includes automation gaps and close actions, reported separately; no human think-time or production latency claim. No retries or row replacement; source preparation and post-content network drain excluded from meaningfulMs. Earlier menu/pointer probes were obstructed by the expanded dock and remain separately retained; no product navigation code was changed.'},null,2)+'\n');await context.close();await browser.close();
 }
}
module.exports={installWorkflowObserver,evidenceFile};
if(require.main===module)main().catch(e=>{console.error(e.name+': pipeline workflow failed; retained outcomes');process.exitCode=1});
