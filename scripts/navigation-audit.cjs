// Investigation only. Accepts only the reserved disposable local Supabase fixture.
// No application .env is read; no cookies, headers, payloads or personal data are saved.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const { Actor, confirmationMessage } = require('../tests/helpers/onboarding-e2e.cjs');
assert.ok(!(process.argv.includes('--hydration-fixture') && process.argv.includes('--crossover-fixture')), 'Choose one disposable fixture');
const profile = require('./navigation-fixture-config.cjs').fixtureProfile(process.argv.includes('--crossover-fixture') ? 'crossover' : process.argv.includes('--hydration-fixture'));
const root = profile.root;
const fixtureFile = path.join(root, 'navigation-fixture.json');
const outDir = path.resolve(process.argv.find(a => a.startsWith('--out='))?.slice(6) || 'docs/performance/evidence');
function distribution(values) {
  const a = values.filter(Number.isFinite).sort((a,b)=>a-b);
  const r = n => Math.round(n*100)/100;
  return {samples:a.length,p50:a.length?r(a[Math.ceil(a.length*.5)-1]):null,p95:a.length?r(a[Math.ceil(a.length*.95)-1]):null,max:a.length?r(a.at(-1)):null};
}
function safeRoute(input) {
  const u = new URL(input, 'http://127.0.0.1:3107');
  if(u.pathname==='/api/workspace') return '/api/workspace?kind='+u.searchParams.get('kind');
  return u.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[fixture-id]');
}
function validateActiveOutput(explicitOutput) {
  assert.ok(explicitOutput,'Active workloads require an explicit new output directory');
  const allowed=path.resolve(__dirname,'../docs/performance/phase1/active-workload');
  const relative=path.relative(allowed,path.resolve(explicitOutput));
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Keep active workload evidence in a new active-workload subdirectory');
  assert.ok(!fs.existsSync(path.join(explicitOutput,'browser-samples.json')),'Existing benchmark evidence must not be overwritten');
}
async function seed(config) {
  if(fs.existsSync(fixtureFile)) return JSON.parse(fs.readFileSync(fixtureFile));
  const actor = new Actor(config), tag='navaudit'+randomUUID().replaceAll('-','').slice(0,10);
  const email=tag+'@virginia.edu', password='Local-audit-only!'+randomUUID();
  const signup=await actor.client.auth.signUp({email,password});
  if(signup.error) throw Error('Local signup failed: '+signup.error.code);
  const message=await confirmationMessage(config,email), token=message.Text.match(/\b(\d{6})\b/)?.[1];
  assert.ok(token,'Local verification email supplies OTP');
  const verified=await actor.client.auth.verifyOtp({email,token,type:'email'});
  assert.ok(!verified.error,'Local email verification succeeds');
  const userId=verified.data.user.id, clubIds=[randomUUID(),randomUUID()];
  const db=new PrismaClient({datasourceUrl:config.status.DB_URL});
  try {
    await db.user.upsert({where:{id:userId},create:{id:userId,email},update:{}});
    await db.studentProfile.create({data:{userId,firstName:'Audit',lastName:'Owner',computingId:tag,major:'Economics',gradYear:2028}});
    for(let c=0;c<2;c++) {
      const clubId=clubIds[c];
      await db.club.create({data:{id:clubId,slug:tag+'-'+c,name:'Navigation Audit Club '+(c+1),tagline:'Disposable local fixture',description:'Synthetic audit only',color:'#234567',category:'Academic',claimedAt:new Date()}});
      const owner=await db.clubMember.create({data:{clubId,userId,isOwner:true,accessRole:'OWNER',interviewOffices:['PRESIDENT']}});
      const applied=await db.pipelineRound.create({data:{clubId,name:'Applied',order:0,type:'APPLICATION_REVIEW'}});
      await db.pipelineRound.create({data:{clubId,name:'Interview',order:1,type:'INTERVIEW'}});
      for(let i=0;i<100;i++) {
        const id=randomUUID();
        await db.user.create({data:{id,email:tag+c+'s'+i+'@virginia.edu',studentProfile:{create:{firstName:'Audit',lastName:'Student '+String(i).padStart(3,'0'),computingId:tag+c+'s'+i,major:'Economics',gradYear:2028,experiences:{create:{title:'Synthetic experience',subtitle:'Audit fixture',period:'2025–2026'}}}}}});
        await db.application.create({data:{clubId,studentId:id,roundId:applied.id,status:'SUBMITTED',submittedAt:new Date()}});
        if(i<60) await db.clubMember.create({data:{clubId,userId:id}});
      }
      await db.meeting.create({data:{clubId,title:'Audit Weekly Meeting',date:new Date(Date.now()+86400000*7),location:'Synthetic room',audience:'MEMBERS',isPublic:false}});
      const task=await db.clubTask.create({data:{clubId,title:'Audit Task',audience:{type:'ALL'},dueAt:new Date(Date.now()+86400000*7)}});
      await db.taskAssignment.create({data:{taskId:task.id,memberId:owner.id,userId}});
      await db.clubAnnouncement.create({data:{clubId,authorId:userId,title:'Audit Announcement',body:'Synthetic benchmark content.',audience:'MEMBERS'}});
    }
    const fixture={userId,email,password,clubIds,counts:{clubs:2,membersPerClub:61,applicantsPerClub:100,meetingsPerClub:1,tasksPerClub:1,announcementsPerClub:1}};
    fs.writeFileSync(fixtureFile,JSON.stringify(fixture),{mode:0o600});
    return fixture;
  } finally {await db.$disconnect();}
}
function routes(f) {
  const base='/club/'+f.clubIds[0]+'/workspace';
  return {
    overview:{href:base+'?section=overview',selector:'.oc-manager-overview, section[aria-label="Overview"]',text:'Audit Weekly Meeting',tour:'nav-overview'},
    members:{href:base+'?section=members',selector:'section[aria-label="Members"]',text:'Audit Student 000',tour:'nav-members'},
    meetings:{href:base+'?section=meetings',selector:'section[aria-label="Meetings"]',text:'Audit Weekly Meeting',tour:'nav-meetings'},
    tasks:{href:base+'?section=tasks',selector:'section[aria-label="Tasks"]',text:'Audit Task',tour:'nav-tasks'},
    announcements:{href:base+'?section=announcements',selector:'section[aria-label="Announcements"]',text:'Audit Announcement',tour:'nav-announcements'},
    recruiting:{href:base+'?section=recruitment&tool=overview',selector:'.oc-recruiting-overview',text:'Submitted',clubLabel:'Navigation Audit Club 1',tour:'nav-overview'},
    applicants:{href:base+'?section=recruitment&tool=applicants',selector:'.oc-live-pipeline',text:'Audit Student 000',tour:'nav-applicants'},
    interviews:{href:base+'?section=recruitment&tool=interviews',selector:'section[aria-label="Interview rooms"]',text:'No assigned interviews.',tour:'nav-interviews'},
    decisions:{href:base+'?section=recruitment&tool=decisions',selector:'.oc-live-pipeline',text:'Audit Student 000',tour:'nav-decisions'},
    settings:{href:base+'?section=settings',selector:'.oc-settings-workspace',text:'Organization settings',tour:'nav-settings'},
    club2:{href:'/club/'+f.clubIds[1]+'/workspace?section=recruitment&tool=overview',selector:'.oc-recruiting-overview',text:'Submitted',clubLabel:'Navigation Audit Club 2'},
    personal:{href:'/?workspace=student',selector:'.oc-student-home:not([role="status"])',text:'Your next step'},
    voting:{selector:'[role="dialog"]',text:'No voting session yet.'},
    applicantDetail:{selector:'[data-slot="sheet-content"]',text:'configured fields'},
    memberDetail:{selector:'[data-slot="sheet-content"]',text:'Audit Student 000'},
  };
}
function installBrowserObservers(options) {
  if (options?.fontDiagnostics) {
    window.__fontAudit = { readyMs: null, layoutShifts: [] };
    document.addEventListener('DOMContentLoaded', () => { document.fonts.ready.then(() => { window.__fontAudit.readyMs = performance.now(); }); }, { once: true });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__fontAudit.layoutShifts.push({ atMs: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput });
    }).observe({ type: 'layout-shift', buffered: true });
  }
  window.__workspaceReadEvents = [];
  const readCauses = new Set(['mount','dispatch','user','readAuthority','isImpersonating','clubId','kind','privacyScope','retry','mode','demoReady','demoEnabled','initial_session','signed_in','signed_out','token_refreshed','user_updated','mfa_challenge_verified','password_recovery']);
  window.addEventListener('outclass:workspace-read', event => {
    const value=event.detail;if(!value||!['auth','selected','page'].includes(value.kind)||!Array.isArray(value.causes))return;
    if(window.__workspaceReadEvents.length===256)window.__workspaceReadEvents.shift();
    window.__workspaceReadEvents.push({atMs:performance.now(),kind:value.kind,causes:value.causes.filter(c=>readCauses.has(c))});
  });
  window.__navAudit={longTasks:[],commits:[],hydration:[],domMismatches:[],phase:'initial'};
  if(options?.diagnoseHydration)window.__captureHydrationDom=(fiber,node)=>{
    const describe=n=>!n?null:{nodeType:n.nodeType,tag:n.nodeType===1?n.tagName.toLowerCase():n.nodeType===8?'comment':'text',classes:n.nodeType===1?[...n.classList].filter(c=>c.startsWith('oc-')):[],suspense:n.nodeType===8&&/^[/$?!~&]{1,6}$/.test(n.data)?n.data:null};
    const parents=[];for(let p=fiber.return;p&&parents.length<5;p=p.return)if(typeof p.type==='string')parents.push({tag:p.type,node:describe(p.stateNode)});
    window.__navAudit.domMismatches.push({phase:window.__navAudit.phase,atMs:performance.now(),readyState:document.readyState,expectedTag:typeof fiber.type==='string'?fiber.type:'component',expectedClasses:String(fiber.pendingProps?.className||'').split(/\s+/).filter(c=>c.startsWith('oc-')),actual:describe(node),previous:describe(node?.previousSibling),next:describe(node?.nextSibling),parent:describe(node?.parentNode),siblings:[...(node?.parentNode?.childNodes||[])].slice(0,12).map(describe),parents,routeWrapperCount:document.querySelectorAll('.oc-route-content').length});
  };
  new PerformanceObserver(list=>{for(const e of list.getEntries())window.__navAudit.longTasks.push({start:e.startTime,duration:e.duration});}).observe({entryTypes:['longtask']});
  // Commit notifications only; standard production React omits profiler durations.
  const wrapped=new WeakSet();
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers:new Map(),inject(r){const id=this.renderers.size+1;this.renderers.set(id,r);return id;},onCommitFiberRoot(_id,root){
    window.__navAudit.commits.push(performance.now());
    if(options?.diagnoseHydration&&root&&!wrapped.has(root)){
      wrapped.add(root);const original=root.onRecoverableError;
      root.onRecoverableError=(error,info)=>{
        const message=String(error.message||''),match=/Minified React error #(\d+)/.exec(message),development=/Hydration failed because|server rendered HTML didn't match/.test(message);
        if(match||development){
          const redact=text=>text.replace(/https?:\/\/[^\s)]+/g,value=>{try{return '[origin]'+new URL(value).pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,'[fixture-id]')}catch{return '[source]'}});
          const stack=redact(String(info?.componentStack||'')),errorFrames=String(error.stack||'').split('\n').slice(1,6).map(redact);
          const names=new Set([...stack.matchAll(/at ([\w$]+)/g)].map(m=>m[1])),components=[];
          const visit=f=>{if(!f)return;const type=typeof f.type==='function'?f.type:f.type?.render;if(typeof type==='function'&&names.has(type.name)&&components.length<30){components.push({name:type.displayName||type.name,classes:[...new Set(String(type).match(/oc-[a-zA-Z0-9_-]+/g)||[])].slice(0,20)})}visit(f.child);visit(f.sibling)};visit(root.current);
          const markupDiff=message.split('\n').filter(line=>/^[+-]\s+/.test(line)).map(line=>({sign:line[0],tags:[...line.matchAll(/<\/?([\w-]+)/g)].map(m=>m[1]),classes:[...line.matchAll(/className="([\w -]+)"/g)].map(m=>m[1])})).filter(row=>row.tags.length||row.classes.length);
          window.__navAudit.hydration.push({code:match?Number(match[1]):418,phase:window.__navAudit.phase,atMs:performance.now(),stack,errorFrames,components,markupDiff});
        }
        return original(error,info);
      };
    }
  },onCommitFiberUnmount(){}};
  document.addEventListener('click',()=>{if(window.__navAudit.armed && !window.__navAudit.click)window.__navAudit.click=performance.now();},true);
  for(const method of ['pushState','replaceState']){const original=history[method];history[method]=function(...args){const result=original.apply(this,args);if(window.__navAudit.armed && window.__navAudit.click && !window.__navAudit.url)window.__navAudit.url=performance.now();return result;};}
}
async function waitReady(page, desc) {
  await page.waitForFunction(d=>(!d.href||location.pathname===new URL(d.href,location.origin).pathname)&&(!d.clubLabel||[...document.querySelectorAll('.oc-workspace-switcher-trigger, [aria-label^="Switch club:"]')].some(el=>el.textContent.includes(d.clubLabel)))&&[...document.querySelectorAll(d.selector)].some(el=>el.getClientRects().length&&el.textContent.includes(d.text)),desc,{timeout:30000});
}
async function main() {
  const config=profile.readConfig(path.join(root,'config.json'));
  assert.equal(config.appUrl,profile.appUrl);
  if(process.argv.includes('--active-rooms')&&!process.argv.includes('--seed'))validateActiveOutput(process.argv.find(a=>a.startsWith('--out='))?.slice(6));
  const fixture=await seed(config);
  const active = process.argv.includes('--active-rooms') ? await require('./active-interview-fixture.cjs').activeInterviewFixture(config,fixture) : null;
  const clients=Number(process.argv.find(a=>a.startsWith('--clients='))?.slice(10)||1);
  assert.ok(Number.isInteger(clients)&&clients>=1&&clients<=4,'Workload is bounded to at most four clients');
  assert.ok(clients===1||active,'Multiple clients require the distinct active-room fixture accounts');
  if(process.argv.includes('--seed')){console.log('Created/reused disposable local audit fixtures: '+JSON.stringify({...fixture.counts,...active?.counts}));return;}
  fs.mkdirSync(outDir,{recursive:true});
  const cookieSets=[];
  for(const credential of (active?.credentials||[{email:fixture.email,password:fixture.password}]).slice(0,clients)){
    const actor=new Actor(config);await actor.signIn(credential.email,credential.password);
    cookieSets.push([...actor.cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/'})));
  }
  const manifestFile=path.join(config.buildDir,'server/server-reference-manifest.json');
  const manifest=process.argv.includes('--diagnose-hydration')&&!fs.existsSync(manifestFile)?{node:{}}:JSON.parse(fs.readFileSync(manifestFile));
  const actionNames=new Map(Object.entries(manifest.node).map(([id,v])=>[id,(v.filename||'')+':'+v.exportedName]));
  const browser=await chromium.launch({headless:true});
  const descriptors=routes(fixture), allSamples=[], failures=[];
  if(process.argv.includes('--phase3')) Object.assign(descriptors.applicantDetail,{text:'Synthetic application evidence.'});
  if(process.argv.includes('--phase2')) { Object.assign(descriptors.overview,{selector:'.oc-command-club'}); Object.assign(descriptors.recruiting,{selector:'.oc-command-recruiting',text:'Current pipeline'}); }
  if(process.argv.includes('--deferred-screens')) {
    const base='/club/'+fixture.clubIds[0]+'/workspace';
    descriptors.settingsProfile={href:base+'?section=settings',selector:'.oc-club-settings fieldset:not([disabled])',text:'One-line pitch',tour:'nav-settings'};
    descriptors.settingsApplication={href:base+'?section=settings&setting=application',selector:'.oc-settings-workspace details',text:'Review settings'};
    descriptors.scheduledDecisions={href:base+'?section=recruitment&tool=scheduled-decisions',selector:'section[aria-label="Scheduled Decisions"]',text:'No scheduled decisions.',tour:'nav-scheduled-decisions'};
    descriptors.rounds={href:base+'?section=recruitment&tool=rounds',selector:'[data-slot="sheet-content"]',text:'Previously viewed information cannot be recalled'};
  }
  if(active)descriptors.interviews.text=active.readyText;
  const sampleCount=Number(process.argv.find(a=>a.startsWith('--samples='))?.split('=')[1]||20);
  assert.ok(sampleCount>0&&sampleCount<=100);
  async function session(participant=0) {
    const context=await browser.newContext({viewport:{width:1440,height:1000},storageState:{cookies:cookieSets[participant],origins:[]}});
    await context.addInitScript(installBrowserObservers,{diagnoseHydration:process.argv.includes('--diagnose-hydration'),fontDiagnostics:process.argv.includes('--font-diagnostics')});
    const page=await context.newPage(),cdp=await context.newCDPSession(page);
    if(process.argv.includes('--probe-hydration-dom')){
      assert.ok(process.argv.includes('--diagnose-hydration'),'DOM probing is diagnostic only');
      await page.route('**/_next/static/chunks/fbbc4d8e-*.js',async route=>{
        const response=await route.fetch(),body=await response.text();
        assert.ok(body.includes('var rP=null,rN=null,rL=!1')&&body.includes('function rD(e){var n=Error(i(418,'),'React diagnostic probe does not match this build');
        const patched=body.replace('function rD(e){','function rD(e){try{globalThis.__captureHydrationDom?.(e,rN)}catch{}');
        const headers={...response.headers()};delete headers['content-encoding'];delete headers['content-length'];
        await route.fulfill({response,headers,body:patched});
      });
    }
    await cdp.send('Performance.enable');
    if(process.argv.includes('--constrained-network')) {
      assert.equal(config.appUrl,'http://127.0.0.1:3107','Network profiling is reserved for this disposable local fixture');
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:200000,uploadThroughput:93750,connectionType:'cellular4g'});
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    }
    const requests=[],pending=new Set(),pageErrors=[],wire=[];
    if(process.argv.includes('--phase3')) {
      await cdp.send('Network.enable');
      cdp.on('Network.requestWillBeSent',event=>{
        const headers=Object.fromEntries(Object.entries(event.request.headers).map(([key,value])=>[key.toLowerCase(),value]));
        wire.push({id:event.requestId,key:event.request.method+' '+event.request.url+' '+(headers['next-action']||''),bytes:0});
      });
      cdp.on('Network.dataReceived',event=>{const item=wire.find(row=>row.id===event.requestId);if(item)item.bytes+=event.encodedDataLength;});
    }
    page.on('pageerror',error=>{
      const react=/Minified React error #(\d+)/.exec(error.message||'');
      pageErrors.push(react?'react_'+react[1]:/ResizeObserver loop/.test(error.message||'')?'resize_observer_loop':['TypeError','ReferenceError','RangeError','SyntaxError'].includes(error.name)?error.name:'page_error');
    });
    page.on('request',req=>{
      const action=req.headers()['next-action'];
      const row={req,route:action?actionNames.get(action)||'server-action':safeRoute(req.url()),method:req.method(),type:req.resourceType(),start:Date.now(),status:null,end:null,bytes:null,timing:null};
      requests.push(row);if(req.resourceType()!=='eventsource')pending.add(req);
    });
    page.on('response',response=>{const row=requests.find(r=>r.req===response.request());if(row){row.status=response.status();row.serverTiming=response.headers()['server-timing']||null;row.traceId=response.headers()['x-outclass-trace-id']||null;}});
    page.on('requestfinished',req=>{pending.delete(req);const row=requests.find(r=>r.req===req);if(row){row.end=Date.now();row.timing=req.timing();void req.sizes().then(s=>{row.bytes=s.responseBodySize;}).catch(()=>{});}});
    page.on('requestfailed',req=>{pending.delete(req);const row=requests.find(r=>r.req===req);if(row){row.end=Date.now();row.failed=true;const reason=req.failure()?.errorText;row.failureReason=/^net::[A-Z_]+$/.test(reason||"")?reason:"transport_failure";}});
    return {context,page,cdp,requests,pending,pageErrors,participant,wire};
  }
  async function settle(s) {
    // SSE is ongoing. Wait for other requests to drain, with a finite bound.
    const end=Date.now()+10000;
    while(s.pending.size && Date.now()<end)await s.page.waitForTimeout(30);
    await s.page.waitForTimeout(80);
  }
  async function preparationSnapshot(s, started) {
    const dom = await s.page.evaluate(() => {
      const text = document.body?.textContent || "";
      const nav = performance.getEntriesByType("navigation")[0];
      return { readyState: document.readyState, opening: text.includes("Opening club workspace…"), selectedLoading: text.includes("Loading workspace…"), pipeline: !!document.querySelector(".oc-live-pipeline"), accessUnavailable: text.includes("Club workspace unavailable"), alerts: document.querySelectorAll('[role="alert"]').length, document: nav ? {ttfbMs:nav.responseStart, domContentLoadedMs:nav.domContentLoadedEventEnd} : null };
    }).catch(() => null);
    const heap=Object.fromEntries((await s.cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
    const authorityEvents=await s.page.evaluate(()=>window.__workspaceReadEvents||[]);
    const fonts=process.argv.includes('--font-diagnostics')?await s.page.evaluate(()=>({ readyMs:window.__fontAudit.readyMs,layoutShifts:window.__fontAudit.layoutShifts,paint:performance.getEntriesByType('paint').map(e=>({name:e.name,atMs:e.startTime})),faces:[...document.fonts].map(f=>({family:f.family,style:f.style,weight:f.weight,status:f.status})),preloadCount:document.querySelectorAll('link[rel="preload"][as="font"]').length })):null;
    return { elapsedMs: Date.now()-started, meaningfulMs:s.sourceReadyMs??null, dom, ...(fonts?{fonts}:{}), heapUsedBytes:heap.JSHeapUsedSize,heapTotalBytes:heap.JSHeapTotalSize,authorityEvents, requests: s.requests.map(r => ({route:r.route,type:r.type,method:r.method,status:r.status,failed:!!r.failed,pending:r.end===null,startMs:r.start-started,endMs:r.end===null?null:r.end-started,traceId:r.traceId||null,serverTiming:r.serverTiming||null,encodedBodyBytes:r.bytes,ttfbMs:r.timing?.responseStart>=0?r.timing.responseStart-r.timing.requestStart:null,transferMs:r.timing?.responseEnd>=0?r.timing.responseEnd-r.timing.responseStart:null})) };
  }
  async function open(s,id) {
    const started=Date.now();
    try { await s.page.goto(config.appUrl+descriptors[id].href,{waitUntil:'domcontentloaded'});await waitReady(s.page,descriptors[id]);s.sourceReadyMs=Date.now()-started;await settle(s); }
    finally { if(process.argv.includes('--source-diagnostics')) s.preparation=await preparationSnapshot(s,started); }
  }
  if(process.argv.includes('--initial')){
    const samples=[];
    try{
      for(const id of ['overview','personal'])for(let i=0;i<sampleCount;i++){
        const s=await session();
        try{
          await s.context.addInitScript(d=>{
            let scheduled=false;
            const observer=new MutationObserver(()=>{if(scheduled)return;const root=[...document.querySelectorAll(d.selector)].find(el=>el.getClientRects().length&&el.textContent.includes(d.text));if(root){scheduled=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__initialReady=performance.now();observer.disconnect();}));}});
            observer.observe(document,{childList:true,subtree:true,attributes:true});
          },descriptors[id]);
          await open(s,id);await s.page.waitForFunction(()=>window.__initialReady>0);
          const metrics=Object.fromEntries((await s.cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
          const marks=await s.page.evaluate(()=>({readyMs:window.__initialReady,longTasks:window.__navAudit.longTasks.filter(t=>t.start<window.__initialReady),navigation:performance.getEntriesByType('navigation').map(n=>({ttfbMs:n.responseStart,domContentLoadedMs:n.domContentLoadedEventEnd,transferSize:n.transferSize}))[0]}));
          samples.push({route:id,index:i,meaningfulMs:marks.readyMs,scriptMs:metrics.ScriptDuration*1000,taskMs:metrics.TaskDuration*1000,longTasks:marks.longTasks,document:marks.navigation,requestCount:s.requests.length});
          console.log('initial '+id+' '+(i+1)+'/'+sampleCount+': '+marks.readyMs.toFixed(1)+' ms');
        }finally{await s.context.close();}
      }
      fs.writeFileSync(path.join(outDir,'initial-samples.json'),JSON.stringify({environment:'local production Next build; authenticated local fixture; cold browser context; warm server/DB',samples,summary:['overview','personal'].map(route=>({route,meaningfulMs:distribution(samples.filter(s=>s.route===route).map(s=>s.meaningfulMs)),scriptMs:distribution(samples.filter(s=>s.route===route).map(s=>s.scriptMs))}))},null,2));
    }finally{await browser.close();}
    return;
  }
  async function clickTarget(s,from,to) {
    const {page}=s;
    if(process.argv.includes('--deferred-screens') && to==='rounds') {
      const details=page.locator('.oc-settings-workspace details').filter({has:page.locator('summary',{hasText:'Review settings'})});
      if(!await details.evaluate(e=>e.open))await details.locator('summary').click();
      return page.getByRole('link',{name:'Anonymous review',exact:true}).click();
    }
    if(process.argv.includes('--deferred-screens') && from==='rounds' && to==='settingsApplication')return page.goBack({waitUntil:'domcontentloaded'});
    if(to==='applicantDetail')return page.locator('[data-applicant-id]').filter({visible:true}).first().click();
    if(from==='applicantDetail')return page.locator('[data-slot="sheet-content"]').getByRole('button',{name:'Close',exact:true}).click();
    if(process.argv.includes('--phase2') && descriptors[to].tour) {
      const tour=descriptors[to].tour;
      let item=page.locator('[data-tour="'+tour+'"]').filter({visible:true}).first();
      if(!await item.count() && (to==='applicants'||to==='scheduledDecisions')) {
        const group=page.getByRole('button',{name:to==='scheduledDecisions'?'Decisions':'Applicants',exact:true}).filter({visible:true}).first();
        await group.focus();await page.keyboard.press('ArrowRight');
        item=page.locator('[data-tour="'+tour+'"]').filter({visible:true}).first();
      }
      await item.focus();return page.keyboard.press('Enter');
    }
    if(to==='applicantDetail')return page.locator('[data-applicant-id]').first().click();
    if(to==='memberDetail')return page.getByRole('button',{name:'Member details · Audit Student 000',exact:true}).click();
    if(from==='applicantDetail'||from==='memberDetail')return page.locator('[data-slot="sheet-content"]').getByRole('button',{name:'Close',exact:true}).click();
    if(to==='voting')return page.getByRole('button',{name:'Start voting',exact:true}).click();
    if(from==='voting'&&to==='applicants'){
      const setup=page.getByRole('dialog',{name:'New voting session',exact:true});
      if(await setup.isVisible()){await setup.getByRole('button',{name:'Close',exact:true}).click();await setup.waitFor({state:'hidden'});}
      return page.locator('.oc-voting-stage').getByRole('button',{name:'Close',exact:true}).click();
    }
    if(to==='personal'||to==='club2'||from==='personal'||from==='club2'){
      await page.getByRole('button',{name:/Switch workspace:/}).first().click();
      return page.getByRole('menuitem',{name:to==='personal'?'Personal workspace':to==='club2'?/Navigation Audit Club 2/:/Navigation Audit Club 1/}).click();
    }
    if(from==='settings'&&to==='overview')return page.locator('[data-tour="nav-overview"]').first().click();
    if((to==='recruiting'&&from==='overview')||(to==='overview'&&['recruiting','applicants'].includes(from)))return page.locator('[data-tour="mode-'+(to==='recruiting'?'recruiting':'club')+'"]').first().click();
    const tour=descriptors[to].tour;
    const item=page.locator('[data-tour="'+tour+'"]').first();
    // Applicant/decision groups collapse when another group is selected.
    if(!await item.isVisible()) {
      const label=to==='decisions'?'Decisions':'Applicants';
      await page.getByRole('button',{name:label,exact:true}).first().click();
    }
    return item.click();
  }
  async function sample(s,from,to,condition,index,gate) {
    // Open any switcher or grouped rail before timing the destination click.
    const page=s.page;
    if(process.argv.includes('--deferred-screens') && to==='rounds') {
      const details=page.locator('.oc-settings-workspace details').filter({has:page.locator('summary',{hasText:'Review settings'})});
      if(!await details.evaluate(e=>e.open))await details.locator('summary').click();
    }
    if(process.argv.includes('--deferred-screens') && to==='scheduledDecisions' && !await page.locator('[data-tour="nav-scheduled-decisions"]').filter({visible:true}).count()) {
      await page.getByRole('button',{name:'Decisions',exact:true}).filter({visible:true}).first().focus();await page.keyboard.press('ArrowRight');
    }
    if(from==='voting'){
      const setup=page.getByRole('dialog',{name:'New voting session',exact:true});
      if(await setup.isVisible()){await setup.getByRole('button',{name:'Close',exact:true}).click();await setup.waitFor({state:'hidden'});}
    }
    if(to==='personal'||to==='club2'||from==='personal'||from==='club2')await page.getByRole('button',{name:/Switch workspace:/}).first().click();
    else if(!['voting'].includes(from)&&to!=='voting'&&descriptors[to].tour){
      const item=page.locator('[data-tour="'+descriptors[to].tour+'"]').first();
      if(!process.argv.includes('--phase2')&&!await item.isVisible()&&['applicants','decisions'].includes(to))await page.getByRole('button',{name:to==='decisions'?'Decisions':'Applicants',exact:true}).first().click();
    }
    const beforeMetrics=Object.fromEntries((await s.cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
    const startIndex=s.requests.length;
    s.sampleStartIndex=startIndex;
    await page.evaluate(desc=>{
      const a=window.__navAudit;a.phase='navigation';a.armed=true;a.click=0;a.url=0;a.ready=0;a.interactive=0;
      if(a.observer)a.observer.disconnect();
      let scheduled=false;
      const check=()=>{
        if(!a.click||scheduled||a.ready)return;
        if(desc.href&&location.pathname!==new URL(desc.href,location.origin).pathname)return;
        if(desc.clubLabel&&![...document.querySelectorAll('.oc-workspace-switcher-trigger, [aria-label^="Switch club:"]')].some(el=>el.textContent.includes(desc.clubLabel)))return;
        const root=[...document.querySelectorAll(desc.selector)].find(el=>el.getClientRects().length&&el.textContent.includes(desc.text));
        if(!root)return;
        // Closing Voting reveals Applicants already mounted underneath.
        if(desc.selector==='.oc-live-pipeline'&&document.querySelector('[data-slot="dialog-content"][data-state="open"]'))return;
        scheduled=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{a.ready=performance.now();const control=[...root.querySelectorAll('button,input,select,a[href]')].find(el=>el.getClientRects().length&&!el.disabled);a.interactive=control?performance.now():null;}));
      };
      a.observer=new MutationObserver(check);a.observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true});a.check=check;
    },descriptors[to]);
    if(gate)await gate(); // Synchronize real clicks; outside the measured interval.
    if(to==='personal'||to==='club2'||from==='personal'||from==='club2')await page.getByRole('menuitem',{name:to==='personal'?'Personal workspace':to==='club2'?/Navigation Audit Club 2/:/Navigation Audit Club 1/}).click();
    else await clickTarget(s,from,to);
    await page.evaluate(()=>window.__navAudit.check());
    await page.waitForFunction(()=>window.__navAudit.ready>0,null,{timeout:30000});
    await settle(s);
    const afterMetrics=Object.fromEntries((await s.cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
    const marks=await page.evaluate(()=>{const a=window.__navAudit;a.armed=false;a.observer.disconnect();return{click:a.click,origin:performance.timeOrigin,url:a.url,ready:a.ready,interactive:a.interactive,longTasks:a.longTasks.filter(t=>t.start>=a.click&&t.start<a.ready),commits:a.commits.filter(t=>t>=a.click&&t<=a.ready).length};});
    const clickWall=marks.origin+marks.click;
    const rows=s.requests.slice(startIndex).map(({req,...r},offset)=>{
      let encodedBodyBytes=r.bytes,bodyBytesSource='playwright';
      if(process.argv.includes('--phase3') && encodedBodyBytes===null && r.failed) {
        const key=req.method()+' '+req.url()+' '+(req.headers()['next-action']||'');
        const ordinal=s.requests.slice(0,startIndex+offset).filter(row=>row.req.method()+' '+row.req.url()+' '+(row.req.headers()['next-action']||'')===key).length;
        const received=s.wire.filter(row=>row.key===key)[ordinal];
        if(received){encodedBodyBytes=received.bytes;bodyBytesSource='cdp_received_chunks_before_cancel';}
      }
      return {route:r.route,type:r.type,method:r.method,status:r.status,serverTiming:r.serverTiming||null,traceId:r.traceId||null,startMs:r.start-clickWall,endMs:r.end===null?null:r.end-clickWall,encodedBodyBytes,failed:r.failed||false,failureReason:r.failureReason||null,ttfbMs:r.timing?.responseStart>=0?r.timing.responseStart-r.timing.requestStart:null,transferMs:r.timing?.responseEnd>=0?r.timing.responseEnd-r.timing.responseStart:null,...(process.argv.includes('--phase3')?{bodyBytesSource}:{})};
    });
    const row={...(s.preparation?{preparation:s.preparation}:{}),path:from+' → '+to,condition,index,clickToUrlMs:marks.url?marks.url-marks.click:null,meaningfulMs:marks.ready-marks.click,interactiveMs:marks.interactive?marks.interactive-marks.click:null,networkCompleteMs:Math.max(0,...rows.filter(r=>r.type!=='eventsource').map(r=>r.endMs||0)),requestCount:rows.length,encodedBodyBytes:rows.reduce((n,r)=>n+(r.encodedBodyBytes||0),0),scriptMs:(afterMetrics.ScriptDuration-beforeMetrics.ScriptDuration)*1000,taskMs:(afterMetrics.TaskDuration-beforeMetrics.TaskDuration)*1000,layoutMs:(afterMetrics.LayoutDuration-beforeMetrics.LayoutDuration)*1000,longTasks:marks.longTasks,reactCommitCount:marks.commits,reactRenderDurationMs:null,heapBeforeBytes:beforeMetrics.JSHeapUsedSize,heapAfterBytes:afterMetrics.JSHeapUsedSize,authorityEvents:await s.page.evaluate(()=>window.__workspaceReadEvents||[]),requests:rows};
    if(process.argv.includes('--diagnose-hydration')){const diagnostic=await page.evaluate(()=>({hydration:window.__navAudit.hydration,dom:window.__navAudit.domMismatches}));row.hydration=diagnostic.hydration;row.hydrationDom=diagnostic.dom;}
    if(active){row.pageErrorCount=s.pageErrors.length;row.pageErrorKinds=[...s.pageErrors];row.participant=s.participant;row.wave=index;row.renderedRooms=await page.locator('section[aria-label="Interview rooms"] li').count();row.openInterviewLinks=await page.locator('section[aria-label="Interview rooms"]').getByRole('link',{name:'Open interview',exact:true}).count();}
    if(process.argv.includes('--phase2')){row.pageErrorCount=s.pageErrors.length;row.pageErrorKinds=[...s.pageErrors];row.inputMethod=process.argv.includes('--phase3')&&to==='applicantDetail'?'pointer':'keyboard';row.initialScriptBytes=s.requests.slice(0,startIndex).filter(r=>r.type==='script').reduce((n,r)=>n+(r.bytes||0),0);}
    allSamples.push(row);
    if(process.argv.includes('--phase3')) {
      row.cycleReadError=await page.getByText('Cycles could not load.',{exact:true}).count()>0;
      assert.equal(row.cycleReadError,false,'Recruitment cycle read failed in the UI');
    }
    if(process.argv.includes('--phase2'))assert.equal(row.pageErrorCount,0,'browser_script_error');
    if(active){assert.equal(row.pageErrorCount,0,'browser_script_error');if(row.hydration)assert.equal(row.hydration.length,0,'hydration_recovery');assert.equal(row.renderedRooms,24,'room_count');assert.equal(row.openInterviewLinks,24,'open_link_count');}
    return row;
  }
  if(active){
    const poolUrl=new URL(config.status.DB_URL);poolUrl.searchParams.set('connection_limit','1');
    const monitor=new PrismaClient({datasourceUrl:poolUrl.href}),poolSamples=[];
    const checkpoint=()=>fs.writeFileSync(path.join(outDir,'browser-samples.json'),JSON.stringify({environment:'local production Next + real disposable Auth/PostgreSQL; active owner-attested rooms',build:config.activeWorkload||null,fixture:{...fixture.counts,...active.counts},clients,wavesPerCondition:sampleCount,metricsNotes:{cold:'fresh browser contexts; warm server/database',synchronization:'Client clicks released together before click timestamps; no synthetic application delay',pool:'50 ms sampled aggregates for same-role database backends, excluding the monitor; no SQL text or identities retained',observationUnit:'participant navigation; concurrent observations share a wave'},samples:allSamples,poolSamples,failures},null,2));
    try{
      workloadWaves:for(const condition of ['cold','warm'])for(let wave=0;wave<sampleCount;wave++){
        const sessions=[];
        try{
          // Prepare users sequentially. Only measured destination clicks form the burst.
          const prepare=async participant=>{
            const s=await session(participant);sessions[participant]=s;s.stage='initial';await open(s,'applicants');s.stage='prepared';
            if(condition==='warm'){s.stage='warmup_interviews';if(process.argv.includes('--diagnose-hydration'))await s.page.evaluate(()=>{window.__navAudit.phase='warmup'});await clickTarget(s,'applicants','interviews');await waitReady(s.page,descriptors.interviews);await settle(s);s.stage='warmup_applicants';await clickTarget(s,'interviews','applicants');await waitReady(s.page,descriptors.applicants);await settle(s);s.stage='prepared';}
          };
          if(process.argv.includes('--parallel-initial-loads')){
            assert.ok(process.argv.includes('--diagnose-hydration'),'Parallel initial loads are a separate diagnostic scenario');
            const prepared=await Promise.allSettled(Array.from({length:clients},(_,participant)=>prepare(participant)));
            for(const result of prepared)if(result.status==='rejected')throw result.reason;
          }else{
            for(let participant=0;participant<clients;participant++)await prepare(participant);
          }
          let arrived=0,release,rejectBarrier;const ready=new Promise((resolve,reject)=>{release=resolve;rejectBarrier=reject});
          const barrierTimeout=setTimeout(()=>rejectBarrier(Error('Click synchronization timed out')),10000);void ready.catch(()=>{});
          const gate=()=>{if(++arrived===clients)release();return ready;};
          let stopped=false;const origin=Date.now(),poll=(async()=>{while(!stopped){const [counts]=await monitor.$queryRaw`SELECT count(*)::int AS connections, count(*) FILTER (WHERE state='active')::int AS active, count(*) FILTER (WHERE state='idle in transaction')::int AS idle_in_transaction, count(*) FILTER (WHERE wait_event_type='Lock')::int AS lock_waiting FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND backend_type='client backend' AND pid<>pg_backend_pid()`;poolSamples.push({condition,wave,offsetMs:Date.now()-origin,...counts});await new Promise(r=>setTimeout(r,50));}})();
          try{
            const outcomes=await Promise.allSettled(sessions.map(async(s,participant)=>{const row=await sample(s,'applicants','interviews',condition,wave,gate);row.participant=participant;row.wave=wave;return row}));
            for(const result of outcomes)if(result.status==='rejected')throw result.reason;
          }finally{clearTimeout(barrierTimeout);stopped=true;await poll;}
          console.log('active rooms '+clients+' clients '+condition+' wave '+(wave+1)+'/'+sampleCount+' complete');
        }catch(error){const assertion=String(error.message||'').split('\n')[0];const readiness=await Promise.all(sessions.filter(Boolean).map(async s=>({participant:s.participant,stage:s.stage,dom:await s.page.evaluate(()=>({pipeline:!!document.querySelector('.oc-live-pipeline'),roomSection:!!document.querySelector('section[aria-label="Interview rooms"]'),rooms:document.querySelectorAll('section[aria-label="Interview rooms"] li').length,loading:!!document.querySelector('.oc-loading-screen'),hasApplicant:!!document.querySelector('.oc-live-pipeline')?.textContent.includes('Audit Student 000'),hasBookedApplicant:!!document.querySelector('section[aria-label="Interview rooms"]')?.textContent.includes('Audit Student 099'),emptyRooms:document.body.textContent.includes('No assigned interviews.'),accessChanged:document.body.textContent.includes('Your access changed'),tool:['applicants','interviews','decisions','overview'].find(v=>new URLSearchParams(location.search).get('tool')===v)||null})).catch(()=>null),requests:s.requests.slice(-16).map(r=>({route:r.route,status:r.status,failed:!!r.failed,pending:r.end===null,type:r.type})),pageErrors:s.pageErrors})));failures.push({condition,wave,error:error.name||'WorkloadFailure',assertion:['browser_script_error','room_count','open_link_count'].includes(assertion)?assertion:null,actual:typeof error.actual==='number'?error.actual:null,expected:typeof error.expected==='number'?error.expected:null,readiness});process.exitCode=1;console.log('Workload failure recorded for '+condition+' wave '+(wave+1));}
        finally{await Promise.allSettled(sessions.filter(Boolean).map(s=>s.context.close()));checkpoint();}
        if(process.argv.includes('--stop-after-hydration')&&allSamples.some(s=>s.hydration?.length))break workloadWaves;
      }
    }finally{checkpoint();await monitor.$disconnect();await browser.close();}
    return;
  }
  const pairs=[['overview','members'],['members','meetings'],['meetings','tasks'],['tasks','announcements'],['announcements','overview'],['recruiting','applicants'],['applicants','interviews'],['interviews','decisions'],['decisions','recruiting'],['applicants','voting'],['voting','applicants'],['overview','settings'],['settings','overview'],['overview','recruiting'],['recruiting','overview'],['overview','club2'],['personal','overview'],['overview','personal']];
  const selected=process.argv.includes('--deferred-screens')?[['overview','settingsProfile'],['overview','meetings'],['recruiting','scheduledDecisions'],['settingsApplication','rounds']]:process.argv.includes('--phase3')?[['recruiting','applicants'],['applicants','applicantDetail']]:process.argv.includes('--phase2')?[['overview','members'],['recruiting','applicants'],['meetings','tasks'],['tasks','announcements']]:process.argv.includes('--only-interviews')?[['applicants','interviews']]:process.argv.includes('--phase1')?[['applicants','interviews'],['members','meetings'],['meetings','tasks'],['tasks','announcements']]:process.argv.includes('--smoke')?pairs.slice(0,1):process.argv.includes('--member-details')?[['members','memberDetail']]:process.argv.includes('--cross-club')?[['recruiting','club2'],['personal','recruiting'],['recruiting','personal']]:process.argv.includes('--details')?[['applicants','applicantDetail'],['members','memberDetail']]:process.argv.includes('--only-voting')?pairs.filter(p=>p.includes('voting')):process.argv.includes('--waterfalls')?pairs.filter(([f,t])=>f==='overview'&&t==='members'||f==='recruiting'&&t==='applicants'||f==='applicants'&&t==='interviews'):pairs.filter(p=>!p.includes('club2')&&!p.includes('personal')).concat([['recruiting','club2'],['personal','recruiting'],['recruiting','personal']]);
  const outputStem=process.argv.includes('--member-details')?'member-detail':process.argv.includes('--cross-club')?'cross-club':process.argv.includes('--details')?'detail':process.argv.includes('--only-voting')?'voting':process.argv.includes('--waterfalls')?'waterfall':'browser';
  try {
    for(const [from,to] of selected)for(const condition of (process.argv.includes('--cold-warm')?['cold','warm']:['cold','warm','repeated'])){
      let shared;
      try {
        if(condition==='repeated') {shared=await session();await open(shared,from==='voting'?'applicants':from);if(from==='voting'){await clickTarget(shared,'applicants','voting');await waitReady(shared.page,descriptors.voting);await settle(shared);}}
        for(let i=0;i<sampleCount;i++) {
          const s=shared||await session();
          let attemptStage='source';
          try {
            if(!shared){await open(s,from==='voting'?'applicants':from);if(from==='voting'){await clickTarget(s,'applicants','voting');await waitReady(s.page,descriptors.voting);await settle(s);}}
            if(condition==='warm'){attemptStage='warm target';await clickTarget(s,from,to);await waitReady(s.page,descriptors[to]);await settle(s);attemptStage='warm return';await clickTarget(s,to,from);await waitReady(s.page,descriptors[from]);await settle(s);}
            attemptStage='measured';
            const r=await sample(s,from,to,condition,i);console.log(`${r.path} ${condition} ${i+1}/${sampleCount}: ${r.meaningfulMs.toFixed(1)} ms, ${r.requestCount} requests`);
            if(shared&&i<sampleCount-1){await clickTarget(s,to,from);await waitReady(s.page,descriptors[from]);await settle(s);}
          } catch(error) {
            if(!process.argv.includes('--record-failures')) throw error;
            const message=String(error.message).replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,'[fixture-id]').slice(0,1800);
            let diagnostic=null;
            try { diagnostic=await Promise.race([s.page.evaluate(()=>({tool:new URLSearchParams(location.search).get('tool'),pipeline:!!document.querySelector('.oc-live-pipeline'),sheet:!!document.querySelector('[data-slot="sheet-content"]'),alerts:document.querySelectorAll('[role="alert"]').length,click:window.__navAudit.click,origin:performance.timeOrigin,now:performance.now()})),new Promise(resolve=>setTimeout(()=>resolve(null),2000))]); } catch {}
            const requests=s.requests.slice(attemptStage==='measured'?(s.sampleStartIndex??0):0).map(r=>({route:r.route,type:r.type,method:r.method,status:r.status,failed:r.failed||false,failureReason:r.failureReason||null,encodedBodyBytes:r.bytes}));
            const observation={...(s.preparation?{preparation:s.preparation}:{}),path:from+' → '+to,condition,index:i,failed:true,stage:attemptStage,error:message,diagnostic:diagnostic?{tool:diagnostic.tool,pipeline:diagnostic.pipeline,sheet:diagnostic.sheet,alerts:diagnostic.alerts}:null,clickToContentLowerBoundMs:attemptStage==='measured'&&diagnostic?.click?diagnostic.now-diagnostic.click:null,meaningfulMs:null,interactiveMs:null,pageErrorCount:s.pageErrors.length,pageErrorKinds:[...s.pageErrors],requests};
            failures.push({path:observation.path,condition,index:i,stage:attemptStage,error:message});allSamples.push(observation);
            console.log('RECORDED FAILURE '+observation.path+' '+condition+' '+(i+1)+'/'+sampleCount+' '+attemptStage);
          } finally {if(!shared)await s.context.close();}
        }
      } catch(e){failures.push({path:from+' → '+to,condition,error:String(e.message).slice(0,1800)});console.log('UNAVAILABLE '+from+' → '+to+' '+condition+': '+String(e.message).slice(0,800));if(shared)console.log('Fixture UI diagnostics: '+await shared.page.locator('body').innerText().then(s=>s.slice(0,1800)).catch(()=>''));}
      finally {if(shared)await shared.context.close();}
      fs.writeFileSync(path.join(outDir,outputStem+'-samples.json'),JSON.stringify({environment:'local Next production build + disposable local Supabase',fixture:fixture.counts,sampleCount,metricsNotes:{profile:process.argv.includes('--constrained-network')?'Local CDP 80ms latency, 1.6Mbps down/0.75Mbps up, CPU4x':'Local unthrottled',meaningfulMs:'DOM content predicate followed by two requestAnimationFrame callbacks; paint proxy, not screenshot timing',interactiveMs:'first enabled visible control after content predicate; no mutation is invoked',requestOffsets:'relative to captured DOM click timestamp',networkCompleteMs:'observed non-SSE requests drained after useful content; includes background traffic',cpu:'CDP delta through settle, so includes post-content background work',react:'production commit notifications only; profiler render durations unavailable'},samples:allSamples,failures},null,2));
    }
    const groups=[...new Set(allSamples.map(s=>s.path+'|'+s.condition))].map(key=>{const samples=allSamples.filter(s=>s.path+'|'+s.condition===key);return{path:samples[0].path,condition:samples[0].condition,meaningfulMs:distribution(samples.map(s=>s.meaningfulMs)),interactiveMs:distribution(samples.map(s=>s.interactiveMs)),clickToUrlMs:distribution(samples.map(s=>s.clickToUrlMs)),networkCompleteMs:distribution(samples.map(s=>s.networkCompleteMs)),scriptMs:distribution(samples.map(s=>s.scriptMs)),taskMs:distribution(samples.map(s=>s.taskMs)),requestCount:distribution(samples.map(s=>s.requestCount)),encodedBodyBytes:distribution(samples.map(s=>s.encodedBodyBytes))};});
    fs.writeFileSync(path.join(outDir,outputStem+'-summary.json'),JSON.stringify({generatedAt:new Date().toISOString(),sampleCount,groups,failures},null,2));
    if(failures.length)process.exitCode=1;
  } finally {await browser.close();}
}
module.exports={distribution,safeRoute,validateActiveOutput,installBrowserObservers};
if(require.main===module)main().catch(e=>{console.error(e.name, e.code || '', String(e.message).split('\n').filter(line=>/Invalid|constraint|argument|Unknown|verification|failed|Error/.test(line)).slice(-3).join('\n'));process.exitCode=1;});
