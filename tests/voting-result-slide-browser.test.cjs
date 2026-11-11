const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {sessionId,apps,leaderId}=require('./helpers/voting-room-harness.cjs');
// One fixture (the loopback bundle is slow to build), four scenarios against the same live room:
// Undo during the result, the result on every view with no blank gap, projector fit, and reduced motion
// with the leader advancing during the result.
test('decision result slide between applicants: views, no blank gap, projector fit, reduced motion and Undo',{timeout:600000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[];
 const contexts=[],open=async(viewport,view,actor,options={})=>{const c=await browser.newContext({viewport,...options});contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(`${view}: ${e.message}`));await p.goto(`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}&view=${view}&actor=${actor}`);return p;};
 const refresh=pages=>Promise.all(pages.map(p=>p.evaluate(()=>window.dispatchEvent(new Event('focus')))));
 const heading=(p,name)=>p.locator('.vr-slide-in [data-applicant-heading]',{hasText:name});
 const leaderAct=async(...commands)=>{f.h.as(leaderId);for(const c of commands)await f.h.command(c);};
 try{
  await f.h.create();await leaderAct('START','OPEN_VOTING','CLOSE_VOTING');
  const leader=await open({width:1366,height:768},'leader','leader');
  await heading(leader,'QA Applicant One').waitFor();

  // 1. Undo during the result slide returns to the applicant. The next slide's read is slow, so the result is still up.
  f.delay('getLiveVotingPresentation',4000);
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic decision reason');
  await leader.getByRole('button',{name:'Pass',exact:true}).click();
  const leaderResult=leader.getByRole('region',{name:'Decision result'});
  await leaderResult.waitFor();
  assert.equal(await leaderResult.getByRole('heading').textContent(),'QA Applicant One');
  assert.match(await leaderResult.textContent(),/Passed$/);
  assert.equal(f.h.state().sessions[0].activeApplicationId,apps[1]);
  await leader.getByRole('button',{name:'Undo',exact:true}).click();
  await leaderResult.waitFor({state:'detached'});
  await heading(leader,'QA Applicant One').waitFor();
  await leader.getByRole('button',{name:'Pass',exact:true}).waitFor();
  assert.equal(f.h.state().sessions[0].activeApplicationId,apps[0]);
  assert.equal(await leader.locator('.vr-result').count(),0);

  // 2. Presentation (1366×768 and 1920×1080), member and leader all show the same result, then the next applicant.
  f.delay('getLiveVotingPresentation',0);
  const small=await open({width:1366,height:768},'present','leader'),large=await open({width:1920,height:1080},'present','leader'),member=await open({width:390,height:844},'member','member');
  const join=member.getByRole('button',{name:'Join session',exact:true});
  if(await join.isVisible().catch(()=>false))await join.click();
  const viewers=[small,large,member];
  for(const p of viewers)await heading(p,'QA Applicant One').waitFor();
  // Joining moves the room revision; the leader picks it up before deciding (as its poll would).
  await leader.reload();await heading(leader,'QA Applicant One').waitFor();
  // Sample every frame on the projector: something (the result or an applicant) is always on the stage.
  await small.evaluate(()=>{const shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});window.__frames={blank:0,result:0,loading:0,done:false};
   const tick=()=>{const s=window.__frames;const r=document.querySelector('.vr-result'),h=document.querySelector('.vr-slide-in [data-applicant-heading]'),l=[...document.querySelectorAll('.vr-slide-stage [data-slot=loading-state]')].some(shown);
    if(shown(r))s.result++;else if(!shown(h))s.blank++;if(l&&!shown(r))s.loading++;if(!(shown(h)&&h.textContent==='QA Applicant Two'&&document.querySelector('.vr-slide-ready')))requestAnimationFrame(tick);else s.done=true;};requestAnimationFrame(tick);});
  f.delay('getLiveVotingPresentation',3000);
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic decision reason');
  await leader.getByRole('button',{name:'Pass',exact:true}).click();
  const results=[leader,...viewers].map(p=>p.getByRole('region',{name:'Decision result'}));
  const poll=setInterval(()=>void refresh(viewers).catch(()=>{}),400);
  try{
   const names=['leader','present 1366','present 1920','member'],pages=[leader,...viewers];
   for(const [i,r] of results.entries()){await r.waitFor().catch(async e=>{const dump=await Promise.all(pages.map(async(p,j)=>`${names[j]}: ${await p.evaluate(()=>`${document.querySelector('.vr-slide-stage')?.className} | ${[...document.querySelectorAll('[data-applicant-heading]')].map(h=>h.textContent).join(',')} | ${document.querySelector('.vr-stats')?.textContent}`)}`));const messages=await leader.locator('[role=alert],[role=status]').allTextContents();throw Error(`${names[i]} never showed the result\n${dump.join('\n')}\nleader messages: ${messages.join(' | ')}\naudit: ${f.h.state().audit.map(x=>x.action).join(',')}\n${e.message}`);});assert.equal(await r.getByRole('heading').textContent(),'QA Applicant One');assert.match(await r.textContent(),/Passed$/);
    // Outcome only: no ballot totals on the result, whatever the room's anonymity rules.
    assert.doesNotMatch(await r.textContent(),/\d|Hold|Do not pass/);}
   for(const [p,size] of [[small,'1366×768'],[large,'1920×1080']]){
    const fit=await p.evaluate(()=>{const b=document.querySelector('.vr-result').getBoundingClientRect();return {w:document.documentElement.scrollWidth<=innerWidth,h:document.documentElement.scrollHeight<=innerHeight,inside:b.top>=0&&b.left>=0&&b.right<=innerWidth&&b.bottom<=innerHeight};});
    assert.deepEqual(fit,{w:true,h:true,inside:true},`result slide fits the projector at ${size}`);}
  }finally{clearInterval(poll);}
  for(const p of [leader,...viewers])await heading(p,'QA Applicant Two').waitFor({timeout:20000});
  await small.waitForFunction(()=>window.__frames.done);
  const frames=await small.evaluate(()=>window.__frames);
  assert.equal(frames.blank,0,'no frame without the result or an applicant');
  assert.equal(frames.loading,0,'the loading placeholder never replaces the result');
  assert.ok(frames.result>0);
  for(const p of [leader,...viewers])await p.locator('.vr-result').waitFor({state:'detached',timeout:5000});

  // 3. Reduced motion: the result appears with no animation, and the leader can open voting on the next applicant at once.
  f.delay('getLiveVotingPresentation',0);
  await leader.emulateMedia({reducedMotion:'reduce'});
  await leaderAct('OPEN_VOTING','CLOSE_VOTING');await refresh([leader]);
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Reduced motion test');
  // Every frame: never the result and the next applicant on screen together (no one-frame overlap).
  await leader.evaluate(()=>{const shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});window.__overlap=0;window.__sampling=true;
   const tick=()=>{if(shown(document.querySelector('.vr-result'))&&shown(document.querySelector('.vr-slide-in [data-applicant-heading]'))){window.__overlap++;(window.__od??=[]).push(document.querySelector('.vr-slide-stage').className+' | '+getComputedStyle(document.querySelector('.vr-result-layer')).display+' | '+getComputedStyle(document.querySelector('.vr-slide-in')).visibility+' | '+getComputedStyle(document.querySelector('.vr-slide-in [data-applicant-heading]')).visibility);}if(window.__sampling)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  await leader.getByRole('button',{name:'Do not pass',exact:true}).click();
  await leaderResult.waitFor();
  const shownAt=Date.now();
  assert.match(await leaderResult.textContent(),/QA Applicant Two\s*Not passed$/);
  assert.equal(await leader.locator('.vr-result').evaluate(e=>getComputedStyle(e).animationName),'none');
  // Not blocked by the result: Open voting for the next applicant is enabled while the result is still showing.
  const openVoting=leader.getByRole('button',{name:'Open voting',exact:true});
  await leader.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Open voting');return !!b&&!b.closest('fieldset')?.disabled;});
  assert.equal(await leader.locator('.vr-result').count(),1,'controls unlocked during the result');
  await openVoting.click();
  await leader.locator('.vr-result').waitFor({state:'detached'});
  // Reduced motion has no slide-out, so ending before the 1400 ms hold means opening voting released it.
  const lasted=Date.now()-shownAt;assert.ok(lasted<1400,`opening voting ends the result without waiting out the hold (${lasted} ms)`);
  await leader.locator('.vr-slide-ready').waitFor();
  assert.equal(await leader.locator('.vr-slide-in').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.equal(await leader.evaluate(()=>{window.__sampling=false;return window.__overlap;}),0,'reduced motion: result and next applicant never overlap '+JSON.stringify(await leader.evaluate(()=>window.__od)));
  const pass=f.h.state().sessions[0].passes.find(p=>p.number===1);
  assert.equal(pass.candidates.find(c=>c.applicationId===apps[2]).ballotState,'OPEN');
  assert.deepEqual(errors,[]);
 }finally{for(const c of contexts)await c.close();await browser.close();await f.close();}
});

// Review findings: a failed next-slide load must not freeze the result or hide its Retry, and a decision made
// while a result is up (before the next slide is revealed) still gets its own result, never re-showing a decided slide.
test('result slide: failed next-slide load shows Retry; a decision made during the result gets its own result',{timeout:600000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[];
 const c=await browser.newContext({viewport:{width:1366,height:768}}),leader=await c.newPage();leader.on('pageerror',e=>errors.push(e.message));
 const heading=name=>leader.locator('.vr-slide-in [data-applicant-heading]',{hasText:name});
 const leaderAct=async(...commands)=>{f.h.as(leaderId);for(const [c,extra] of commands)assert.equal((await f.h.command(c,extra)).ok,true,c);};
 try{
  await f.h.create();await leaderAct(['START'],['OPEN_VOTING'],['CLOSE_VOTING']);
  await leader.goto(`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}&view=leader&actor=leader`);
  await heading('QA Applicant One').waitFor();

  // 1. The next applicant's slide fails to load: the result gives way at once and Retry is reachable.
  f.failAction('getLiveVotingPresentation');
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic decision reason');
  await leader.getByRole('button',{name:'Pass',exact:true}).click();
  const retry=leader.getByRole('button',{name:'Retry presentation',exact:true});
  await retry.click({timeout:4000});
  await heading('QA Applicant Two').waitFor();
  assert.equal(await leader.locator('.vr-result').count(),0);

  // 2. While B's result is up and C has loaded beneath it, C is decided (e.g. on another leader device).
  await leaderAct(['OPEN_VOTING'],['CLOSE_VOTING']);await leader.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await leader.getByRole('button',{name:'Hold',exact:true}).waitFor();
  await leader.evaluate(()=>{const shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});window.__s={results:[],decidedSlide:0,on:true};
   const tick=()=>{const r=document.querySelector('.vr-result');if(shown(r)){const t=r.innerText;if(window.__s.results.at(-1)!==t)window.__s.results.push(t);}
    // A decided applicant's slide must never slide out again once its result has shown.
    if([...document.querySelectorAll('.vr-slide-out:not(.vr-result-layer) [data-applicant-heading]')].some(shown))window.__s.decidedSlide++;
    if(window.__s.on)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic decision reason');
  await leader.getByRole('button',{name:'Hold',exact:true}).click();
  await leader.getByRole('region',{name:'Decision result'}).waitFor();
  // C loaded under B's result: the leader's controls unlock; decide C before B's result has given way.
  await leader.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Open voting');return !!b&&!b.closest('fieldset')?.disabled;});
  await leader.waitForTimeout(100);
  await leaderAct(['DECIDE_WITHOUT_VOTE_AND_ADVANCE',{applicationId:apps[2],passNumber:1,choice:'REJECT',reason:'Decided on another device',confirmed:true}]);
  await leader.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await leader.locator('.vr-slide-in [data-applicant-heading]',{hasText:'Pass complete'}).waitFor({timeout:20000});
  const s=await leader.evaluate(()=>{window.__s.on=false;return window.__s;});
  assert.deepEqual(s.results.map(t=>t.replace(/\s+/g,' ').trim()),['QA Applicant Two Held for another pass','QA Applicant Two Not passed without a vote']);
  assert.equal(s.decidedSlide,0,'no decided applicant slides back out');
  assert.deepEqual(errors,[]);
 }finally{await c.close();await browser.close();await f.close();}
});
