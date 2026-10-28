// Actual read-only review journey. No forced clicks, injected delays or writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const {chromium}=require('playwright'),{Actor}=require('../tests/helpers/onboarding-e2e.cjs');
const local=require('./pipeline-release-local.cjs');
function installStage({kind,text,count}){
 const visible=e=>e&&e.getClientRects().length>0;
 const state={start:0,ready:0,interactive:0,scheduled:false};window.__releaseStage=state;
 const predicate=()=>{
  const rows=[...document.querySelectorAll('.oc-live-pipeline [data-applicant-id]')].filter(visible);
  const sheet=[...document.querySelectorAll('[data-slot="sheet-content"]')].find(visible);
  const setup=[...document.querySelectorAll('[role="dialog"]')].find(e=>visible(e)&&(e.getAttribute('aria-label')==='New voting session'||document.getElementById(e.getAttribute('aria-labelledby'))?.textContent==='New voting session'));
  if(kind==='entry'||kind==='return')return rows.length===count&&!sheet&&!document.querySelector('.oc-voting-stage')&&!document.body.textContent.includes('Updating applicants…');
  if(kind==='detail'||kind==='switch'||kind==='selection')return sheet&&sheet.textContent.includes(text)&&sheet.textContent.includes('Synthetic application evidence.')&&(kind!=='selection'||sheet.textContent.includes('Quick review · '+count+' remaining'));
  if(kind==='search'||kind==='filter')return rows.length===count&&rows.some(e=>e.textContent.includes(text))&&!document.body.textContent.includes('Updating applicants…');
  if(kind==='voting')return setup&&[...setup.querySelectorAll('select')].some(e=>e.closest('label')?.textContent.includes('Recruitment round'));
  if(kind==='votingPool')return setup&&setup.querySelectorAll('fieldset')[0]?.querySelectorAll('input[type=checkbox]').length===count;
  return false;
 };
 const check=()=>{if(!state.start||state.ready||state.scheduled||!predicate())return;state.scheduled=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(predicate()){state.ready=performance.now();const root=[...document.querySelectorAll('[role="dialog"],.oc-live-pipeline')].filter(visible).at(-1);const control=[...root?.querySelectorAll('button,input,select,a[href]')||[]].find(e=>visible(e)&&!e.disabled);state.interactive=control?performance.now():0}else state.scheduled=false}))};
 const begin=()=>{if(!state.start)state.start=performance.now();queueMicrotask(check)};
 document.addEventListener('click',begin,true);document.addEventListener('input',begin,true);document.addEventListener('change',begin,true);
 const observer=new MutationObserver(check);observer.observe(document.body,{subtree:true,attributes:true,childList:true});
 state.check=check;state.finish=()=>{observer.disconnect();document.removeEventListener('click',begin,true);document.removeEventListener('input',begin,true);document.removeEventListener('change',begin,true);return{origin:performance.timeOrigin,start:state.start,ready:state.ready,interactive:state.interactive}};
}
const safeRoute=input=>{const u=new URL(input);return u.pathname==='/api/workspace'?u.pathname+'?kind='+u.searchParams.get('kind'):u.pathname.replace(/[\da-f]{8}-[\da-f-]{27,}/ig,'[fixture-id]')};
async function main(){
 const out=path.resolve(process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'');assert.ok(out.startsWith(path.join(local.repo,'docs/performance/pipeline-release-repair')+path.sep)&&out.endsWith('.json')&&!fs.existsSync(out));
 const n=Number(process.argv.find(a=>a.startsWith('--samples='))?.slice(10)||5);assert.ok(n>0&&n<=30);
 const warmups=Number(process.argv.find(a=>a.startsWith('--warmups='))?.slice(10)||2);assert.ok(warmups>=0&&warmups<=5);
 const config=local.config(),fixture=JSON.parse(fs.readFileSync(path.join(local.root,'navigation-fixture.json'))),size=fixture.counts.applicantsInMeasuredClub;
 assert.ok([1,100,1000,5000].includes(size));const last=size<=100?'Audit Student '+String(size-1).padStart(3,'0'):'Scale Student '+String(size-1).padStart(5,'0');
 const actor=new Actor(config);await actor.signIn(fixture.email,fixture.password);
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},storageState:{cookies:[...actor.cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/'})),origins:[]}}),page=await context.newPage(),requests=[],errors=[],pending=new Set(),samples=[];
 page.on('dialog',dialog=>dialog.accept());
 page.setDefaultTimeout(30000);const cdp=await context.newCDPSession(page);
 if(process.argv.includes('--constrained-network')){await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:200000,uploadThroughput:93750,connectionType:'cellular4g'});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
 page.on('pageerror',e=>errors.push(e.name));
 page.on('request',request=>{requests.push({request,route:safeRoute(request.url()),type:request.resourceType(),start:performance.timeOrigin+performance.now(),end:null,status:null,bytes:null});if(request.resourceType()!=='eventsource')pending.add(request)});
 page.on('response',response=>{const r=requests.find(r=>r.request===response.request());if(r){r.status=response.status();r.serverTiming=response.headers()['server-timing']||null;r.traceId=response.headers()['x-outclass-trace-id']||null}});
 page.on('requestfinished',request=>{pending.delete(request);const r=requests.find(r=>r.request===request);if(r){r.end=performance.timeOrigin+performance.now();r.timing=request.timing();void request.sizes().then(s=>r.bytes=s.responseBodySize).catch(()=>{})}});
 page.on('requestfailed',request=>{pending.delete(request);const r=requests.find(r=>r.request===request);if(r){r.end=performance.timeOrigin+performance.now();r.failed=true}});
 async function frames(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
 async function drain(){const deadline=performance.now()+10000;while(pending.size&&performance.now()<deadline)await page.waitForTimeout(20);await frames();}
 const snapshot=(offset,start)=>requests.slice(offset).map(({request,...r})=>({route:r.route,type:r.type,startMs:r.start-start,endMs:r.end===null?null:r.end-start,status:r.status,failed:!!r.failed,encodedBodyBytes:r.bytes,ttfbMs:r.timing?.responseStart>=0?r.timing.responseStart:null,serverTiming:r.serverTiming||null,traceId:r.traceId||null}));
 try{for(let index=0;index<n+warmups;index++){
  const sourceStart=performance.now(),sourceOffset=requests.length,errorOffset=errors.length;let offset=sourceOffset,source=null,failed=null,failedAt='source',stages={},journeyStart=null,journeyEnd=null;
  async function stage(name,kind,text,count,trigger){failedAt=name;const before=requests.length;await page.evaluate(installStage,{kind,text,count});await trigger();await page.evaluate(()=>window.__releaseStage.check());await page.waitForFunction(()=>window.__releaseStage.ready>0);const marks=await page.evaluate(()=>window.__releaseStage.finish());const start=marks.origin+marks.start;stages[name]={meaningfulMs:marks.ready-marks.start,interactiveMs:marks.interactive?marks.interactive-marks.start:null,startMs:journeyStart===null?0:start-journeyStart,requestStart:before-offset,requestEnd:requests.length-offset};if(journeyStart===null)journeyStart=start;journeyEnd=marks.origin+marks.ready;}
  try{
   await page.goto(config.appUrl+'/club/'+fixture.clubIds[0]+'/workspace?section=recruitment&tool=overview');await page.locator('.oc-command-recruiting').getByRole('button',{name:'Refresh overview',exact:true}).waitFor();await frames();const content=performance.now()-sourceStart;await drain();source={meaningfulMs:content,elapsedMs:performance.now()-sourceStart,pending:pending.size,requests:snapshot(sourceOffset,performance.timeOrigin+sourceStart)};offset=requests.length;
   await stage('entry','entry','',Math.min(100,size),()=>page.locator('.oc-command-recruiting').getByRole('link',{name:'All applicants',exact:true}).click());
   await stage('detail','detail','Audit Student 000',0,()=>page.locator('[data-applicant-id]').filter({visible:true}).first().click());
   if(size>1)await stage('switch','switch','Audit Student 001',0,()=>page.getByRole('button',{name:'Next applicant',exact:true}).click());
   await stage('close','return','',Math.min(100,size),()=>page.locator('[data-slot=sheet-content]').getByRole('button',{name:'Close',exact:true}).click());
   await stage('search','search',last,1,()=>page.getByRole('textbox',{name:'Search applicants',exact:true}).fill(last));
   await stage('clearSearch','search','Audit Student 000',Math.min(100,size),()=>page.getByRole('textbox',{name:'Search applicants',exact:true}).fill(''));
   await stage('selection','selection','Audit Student 000',size,()=>page.getByRole('button',{name:'Quick review',exact:true}).click());
   await stage('closeSelection','return','',Math.min(100,size),()=>page.locator('[data-slot=sheet-content]').getByRole('button',{name:'Close',exact:true}).click());
   await stage('votingCold','voting','',0,()=>page.getByRole('button',{name:'Start voting',exact:true}).click());
   const setup=()=>page.getByRole('dialog',{name:'New voting session',exact:true});const round=setup().getByRole('combobox',{name:'Recruitment round',exact:true});const options=await round.locator('option').evaluateAll(nodes=>nodes.map(n=>({value:n.value,text:n.textContent})));const applied=options.find(v=>v.text==='Applied');assert.ok(applied);
   await stage('votingPool','votingPool','',size,()=>round.selectOption(applied.value));
   failedAt='closeVotingSetup';await setup().getByRole('button',{name:'Done',exact:true}).click();await setup().waitFor({state:'hidden'});
   await stage('closeVoting','return','',Math.min(100,size),()=>page.locator('.oc-voting-stage').getByRole('button',{name:'Close',exact:true}).click());
   await stage('votingWarm','voting','',0,()=>page.getByRole('button',{name:'Start voting',exact:true}).click());
   failedAt='closeVotingSetup';await setup().getByRole('button',{name:'Done',exact:true}).click();await setup().waitFor({state:'hidden'});
   await stage('return','return','',Math.min(100,size),()=>page.locator('.oc-voting-stage').getByRole('button',{name:'Close',exact:true}).click());
   failedAt='networkDrain';await drain();
  }catch(e){failed=e.name;await page.evaluate(()=>window.__releaseStage?.finish()).catch(()=>{});process.exitCode=1;}
  const rows=snapshot(offset,journeyStart??performance.timeOrigin+sourceStart),unknown=rows.filter(r=>!Number.isFinite(r.encodedBodyBytes)).length;
  const httpErrors=rows.filter(r=>r.status>=400).length,pageErrors=errors.slice(errorOffset);if(httpErrors||pageErrors.length){failed||='transport_or_page_error';process.exitCode=1;}
  samples.push({index,warmup:index<warmups,condition:'fresh_source_warm_assets_after_warmups',failed,failedAt:failed?failedAt:null,source,stages,sourceThroughContentMs:journeyEnd===null?null:journeyEnd-(performance.timeOrigin+sourceStart),sourceThroughNetworkMs:performance.now()-sourceStart,meaningfulMs:journeyStart===null||journeyEnd===null?null:journeyEnd-journeyStart,networkCompleteMs:pending.size||journeyStart===null?null:performance.timeOrigin+performance.now()-journeyStart,requestCount:rows.length,encodedBodyBytes:unknown?null:rows.reduce((n,r)=>n+r.encodedBodyBytes,0),knownBodyBytes:rows.reduce((n,r)=>n+(r.encodedBodyBytes||0),0),unknownBodyByteCount:unknown,httpErrors,pageErrors,aborted:rows.filter(r=>r.failed).length,pending:rows.filter(r=>r.endMs===null&&r.type!=='eventsource').length,requests:rows});
  console.log('workflow '+size+' '+(index+1)+'/'+(n+warmups)+' '+(failed||'complete'));
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({size,buildId:fs.readFileSync(path.join(config.buildDir,'BUILD_ID'),'utf8').trim(),samples},null,2)+'\n');
 }}finally{await context.close();await browser.close();}
}
module.exports={installStage,safeRoute};
if(require.main===module)main().catch(e=>{console.error(e.name+': workflow controller failed; retained outcomes');process.exitCode=1});
