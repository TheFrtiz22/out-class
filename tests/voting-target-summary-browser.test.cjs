const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {sessionId}=require('./helpers/voting-room-harness.cjs');
const AxeBuilder=require('@axe-core/playwright').default;
test('target summary stays stationary through slide transitions, syncs to the audience device, and never blocks Pass over target',{timeout:120000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[];
 const leader=await (await browser.newContext({viewport:{width:1366,height:768}})).newPage(),audience=await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();
 for(const p of [leader,audience])p.on('pageerror',e=>errors.push(e.message));
 const base=`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}`;
 try{
  await f.h.create({targetSize:1});await f.h.command('START');await f.h.command('OPEN_VOTING');await f.h.command('CLOSE_VOTING');
  await leader.goto(`${base}&view=leader&actor=leader`);await audience.goto(`${base}&view=present&actor=leader`);
  const summary=leader.getByRole('region',{name:'Decision totals'});await summary.waitFor();
  await leader.locator('.vr-slide-ready').waitFor();
  assert.match(await summary.innerText(),/Final class-size target/);assert.match(await summary.innerText(),/0 passed · Target 1/);
  assert.match(await summary.innerText(),/Decisions · This session/);
  await summary.getByText('Decisions · Entire round',{exact:false}).waitFor();
  assert.equal(await leader.locator('.vr-slide-stage .oc-target-summary').count(),0,'summary is outside the animated slide region');
  // Mark the node: a stationary summary is the same element after the slide changes.
  await summary.evaluate(e=>{e.dataset.marker='stationary'});
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic decision reason');await leader.getByRole('button',{name:'Pass',exact:true}).click();
  await leader.locator('.vr-slide-sliding').waitFor();
  assert.equal(await leader.locator('[data-marker="stationary"]').count(),1,'summary not remounted during the transition');
  await leader.locator('.vr-slide-ready').waitFor();await leader.getByRole('heading',{name:'QA Applicant Two',exact:true}).waitFor();
  await leader.waitForFunction(()=>/1 passed · Target 1/.test(document.querySelector('[data-marker="stationary"]')?.textContent??''));
  assert.match(await summary.innerText(),/Target reached/);
  // The audience screen picks up the counts through the room's polling path, without reload.
  await audience.getByText('Passed 1',{exact:true}).waitFor({timeout:15000});
  // Target reached: Pass remains available and nobody is rejected automatically.
  await leader.getByRole('button',{name:'Open voting',exact:true}).click();leader.once('dialog',d=>d.accept());await leader.getByRole('button',{name:'Close voting',exact:true}).click();
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Also strong');const pass=leader.getByRole('button',{name:'Pass',exact:true});assert.equal(await pass.isDisabled(),false);await pass.click();
  await leader.getByText('1 over target',{exact:true}).first().waitFor();assert.match(await summary.innerText(),/2 passed · Target 1/);
  assert.equal(f.h.state().sessions[0].passes[0].candidates.filter(c=>c.confirmedDecision==='NOT_PASS').length,0,'no automatic rejection');
  await audience.getByText('1 over target',{exact:true}).waitFor({timeout:15000});
  assert.doesNotMatch(await summary.innerText(),/QA voter|ballot/i,'counts only');
  await leader.setViewportSize({width:390,height:844});assert.ok(await leader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone layout has no horizontal overflow');
  const a11y=await new AxeBuilder({page:leader}).include('.oc-target-summary').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(a11y.violations.map(v=>v.id),[]);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});

test('ranked review: round target, discussion groups and round decisions are separate, labelled and show overage in text',{timeout:120000},async()=>{
 const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),{bundle}=require('./helpers/browser-bundle.cjs');
 const js=bundle(`import React from'react';import{createRoot}from'react-dom/client';import{RankedReviewList}from'@/components/ranked-review-list';import{roundTargetSummary}from'@/lib/voting-target-summary';
 const round='00000000-0000-4000-8000-000000000001';
 const app=(n,score)=>({id:'00000000-0000-4000-8000-00000000010'+n,roundId:round,status:'INTERVIEWING',studentId:'anonymous-'+n,recruitmentCycleId:null,student:{email:'',studentProfile:null},roundScore:score});
 const s=(average,submitted)=>({average,submitted,required:2,provisional:false});
 const apps=[app(1,s(9,2)),app(2,s(8,2)),app(3,s(null,0)),app(4,null)];
 window.__inputs=[];let version=0;
 const outcomes=()=>[...Array.from({length:32+version},(_,i)=>({applicationId:'p'+i,outcome:'ACCEPT'})),{applicationId:'h',outcome:'HOLD'},{applicationId:'r',outcome:'REJECT'},{applicationId:'u1',outcome:'UNREVIEWED'},{applicationId:'u2',outcome:null}];
 window.__bump=()=>{version++};
 const api={loadRound:async()=>({rounds:[],genderCounts:null,applications:structuredClone(apps)}),loadSettings:async()=>({roundId:round,cycles:[],canManage:false,scopes:{'no-cycle':{bands:{green:{start:1,end:1},yellow:{start:2,end:2},red:{start:3}},revision:1}}}),saveBands:async()=>{throw Error('read only')},
  loadRoundSummary:async input=>{window.__inputs.push(input);return{...roundTargetSummary({round:{name:'Interview',final:false},sessions:[{id:'s1',createdAt:'2026-11-01',revision:3+version,targetSize:30,outcomes:outcomes()}]}),sessions:1,partial:true}}};
 createRoot(document.getElementById('root')).render(<main className="p-4"><RankedReviewList clubId="00000000-0000-4000-8000-000000000009" rounds={[{id:round,name:'Interview',anonymousReview:true}]} initialRoundId={round} api={api} onOpen={()=>{}}/></main>);`);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'outclass-target-'));cp.execFileSync(process.execPath,['tests/helpers/interview-browser-css.cjs',path.join(tmp,'style.css')],{windowsHide:true});
 const css=fs.readFileSync(path.join(tmp,'style.css'),'utf8')+fs.readFileSync('components/applicant-identity.css','utf8')+fs.readFileSync('components/ranked-review-list.css','utf8')+fs.readFileSync('components/voting-target-summary.css','utf8');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':req.url==='/style.css'?'text/css':'text/html');res.end(req.url==='/app.js'?js:req.url==='/style.css'?css:'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/app.js"></script>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
   const page=await (await browser.newContext({viewport})).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
   const summary=page.getByRole('region',{name:'Round target and counts'});await summary.getByText('Decisions · Entire round',{exact:false}).waitFor();const st=await summary.innerText();
   assert.match(st,/Advancement target for Interview\s*30/);assert.match(st,/32 passed · Target 30/);assert.match(st,/2 over target/);
   assert.match(st,/Discussion groups · Entire round/);assert.match(st,/Green\s*1/);assert.match(st,/Yellow\s*1/);assert.match(st,/Red\s*0/);assert.match(st,/Not scored\s*1/);assert.match(st,/Score not available\s*1/);
   assert.match(st,/Pass\s*32/);assert.match(st,/Hold\s*1/);assert.match(st,/Do not pass\s*1/);assert.match(st,/Unreviewed\s*2/);assert.match(st,/Includes only voting sessions you can open/);
   assert.equal(await summary.locator('.oc-target-bar > span').evaluate(e=>e.style.width),'100%','bar caps at 100%; text shows the overage');
   assert.deepEqual(await page.evaluate(()=>window.__inputs[0]),{roundId:'00000000-0000-4000-8000-000000000001'},'anonymous round: whole round, no cycle');
   // A background check refreshes counts without reordering the list.
   await page.evaluate(()=>{window.__bump();window.dispatchEvent(new CustomEvent('outclass:data-changed',{detail:{scope:'decisions'}}))});
   await summary.getByText('3 over target',{exact:true}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
   const a11y=await new AxeBuilder({page}).include('.oc-target-summary').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(a11y.violations.map(v=>v.id),[]);
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true})}
});
