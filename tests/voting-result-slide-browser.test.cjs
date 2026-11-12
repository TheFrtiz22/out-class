const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {sessionId,apps,leaderId}=require('./helpers/voting-room-harness.cjs');
// Applicant-to-applicant motion: the confirmed outcome shows beside the outgoing applicant's name (~200 ms), then the
// outgoing applicant moves left and fades while the next arrives from the right (~520 ms), with no blank frame.
// Synthetic applicants only. The fixture's applicants have no photos, so every slide uses the reserved placeholder.

const roomUrl=(f,view,actor)=>`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}&view=${view}&actor=${actor}`;
const focus=pages=>Promise.all(pages.map(p=>p.evaluate(()=>window.dispatchEvent(new Event('focus')))));
const heading=(p,name)=>p.locator('.vr-slide-in [data-applicant-heading]',{hasText:name});
// Per-frame sampler: blank frames, loading placeholders, outcome marks seen, and the slide's direction and timing.
const sample=p=>p.evaluate(()=>{const shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});const s=window.__s={blank:0,loading:0,outcomes:[],firstOutcome:0,slideStart:0,slideEnd:0,outX:[],inX:[],on:true};
 const x=e=>{const m=e&&getComputedStyle(e).transform;return !m||m==='none'?0:new DOMMatrix(m).m41;};
 const tick=t=>{const stage=document.querySelector('.vr-slide-stage');if(stage){const heads=[...stage.querySelectorAll('[data-applicant-heading]')].filter(shown);if(!heads.length)s.blank++;
  if([...stage.querySelectorAll('[data-slot=loading-state]')].some(shown))s.loading++;
  const mark=stage.querySelector('.vr-slide-out .vr-outcome');if(shown(mark)){const text=mark.textContent;if(s.outcomes.at(-1)!==text)s.outcomes.push(text);s.firstOutcome||=t;}
  if(stage.classList.contains('vr-slide-sliding')){s.slideStart||=t;s.outX.push(x(stage.querySelector('.vr-slide-out')));s.inX.push(x(stage.querySelector('.vr-slide-in')));}else if(s.slideStart&&!s.slideEnd)s.slideEnd=t;}
  if(s.on)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
const stop=p=>p.evaluate(()=>{window.__s.on=false;return window.__s;});
const unlocked=(p,name)=>p.waitForFunction(n=>{const b=[...document.querySelectorAll('.vr-leader button')].find(b=>b.textContent.trim()===n);return !!b&&!b.closest('fieldset')?.disabled;},name);

test('decision motion: outcome beside the name, then a same-direction slide on every view; Undo; reduced motion; repeated clicks',{timeout:600000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[],contexts=[];
 const open=async(viewport,view,actor)=>{const c=await browser.newContext({viewport});contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(`${view}: ${e.message}`));await p.goto(roomUrl(f,view,actor));return p;};
 const leaderAct=async(...commands)=>{f.h.as(leaderId);for(const c of commands)await f.h.command(c);};
 try{
  await f.h.create();await leaderAct('START','OPEN_VOTING','CLOSE_VOTING');
  const leader=await open({width:1366,height:768},'leader','leader');
  await heading(leader,'QA Applicant One').waitFor();

  // 1. Undo while the outcome is showing (next slide slow to load): back to the same applicant, no reload, no skeleton.
  f.delay('getLiveVotingPresentation',3000);
  await sample(leader);
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic decision reason');
  await leader.getByRole('button',{name:'Pass',exact:true}).click();
  const mark=leader.locator('.vr-slide-out .vr-outcome');
  await mark.waitFor();
  assert.equal((await mark.textContent()).trim(),'Passed');assert.equal(await mark.getAttribute('data-outcome'),'ACCEPT');
  assert.equal(await leader.locator('.vr-slide-out [data-applicant-heading]').textContent(),'QA Applicant One','outcome beside the outgoing name');
  await leader.getByRole('button',{name:'Undo',exact:true}).click();
  await mark.waitFor({state:'detached'});
  await heading(leader,'QA Applicant One').waitFor();await leader.getByRole('button',{name:'Pass',exact:true}).waitFor();
  assert.equal(f.h.state().sessions[0].activeApplicationId,apps[0]);
  let s=await stop(leader);assert.equal(s.blank,0,'no blank frame through Undo');assert.equal(s.loading,0,'the applicant is not reloaded on Undo');

  // 2. Every view: outcome beside the name, ~200 ms, then out left / in from the right; fits both projector sizes.
  f.delay('getLiveVotingPresentation',0);
  const small=await open({width:1366,height:768},'present','leader'),large=await open({width:1920,height:1080},'present','leader'),member=await open({width:390,height:844},'member','member');
  const join=member.getByRole('button',{name:'Join session',exact:true});if(await join.isVisible().catch(()=>false))await join.click();
  const viewers=[small,large,member];for(const p of viewers)await heading(p,'QA Applicant One').waitFor();
  await leader.reload();await heading(leader,'QA Applicant One').waitFor(); // picks up the join's revision
  for(const p of [leader,...viewers])await sample(p);
  const poll=setInterval(()=>void focus(viewers).catch(()=>{}),300);
  try{
   await leader.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic decision reason');
   await leader.getByRole('button',{name:'Pass',exact:true}).click();
   for(const p of [leader,...viewers])await heading(p,'QA Applicant Two').waitFor({timeout:20000});
   for(const p of [leader,...viewers])await p.locator('.vr-slide-ready').waitFor();
  }finally{clearInterval(poll);}
  for(const [i,p] of [leader,...viewers].entries()){
   const r=await stop(p),name=['leader','present 1366','present 1920','member'][i];
   assert.deepEqual(r.outcomes,['Passed'],`${name}: outcome shown beside the name`);
   assert.equal(r.blank,0,`${name}: no blank frame`);assert.equal(r.loading,0,`${name}: no loading placeholder between applicants`);
   assert.ok(r.slideStart-r.firstOutcome>=150,`${name}: outcome holds ~200 ms (${Math.round(r.slideStart-r.firstOutcome)} ms)`);
   assert.ok(r.slideEnd-r.slideStart>=400&&r.slideEnd-r.slideStart<=900,`${name}: slide ~520 ms (${Math.round(r.slideEnd-r.slideStart)} ms)`);
   assert.ok(r.outX.some(v=>v<-1)&&r.outX.every(v=>v<=0.5),`${name}: outgoing moves left only`);
   assert.ok(r.inX.some(v=>v>1)&&r.inX.every(v=>v>=-0.5),`${name}: incoming arrives from the right and settles without overshoot`);
  }
  for(const [p,size] of [[small,'1366×768'],[large,'1920×1080']])assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),`projector fits at ${size}`);
  assert.ok(await member.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone: no horizontal scroll');
  // Counters come from the confirmed room state.
  await leader.getByText('Reviewed 1 of 3 this pass · Pass 1',{exact:true}).waitFor();
  // Focus lands on the new applicant's name, never on a decision control.
  assert.equal(await leader.evaluate(()=>document.activeElement?.textContent),'QA Applicant Two');

  // 3. Reduced motion: a short crossfade (no movement); repeated clicks decide once and never touch the next applicant.
  await leader.emulateMedia({reducedMotion:'reduce'});
  await leaderAct('OPEN_VOTING','CLOSE_VOTING');await focus([leader]);
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Reduced motion test');
  await sample(leader);
  const decided=f.h.state().audit.filter(a=>a.action==='voting.room.decide_and_advance').length;
  await unlocked(leader,'Do not pass');
  await leader.evaluate(()=>{const b=[...document.querySelectorAll('.vr-leader button')].find(b=>b.textContent.trim()==='Do not pass');for(let i=0;i<4;i++)b.click();});
  await leader.locator('.vr-slide-out .vr-outcome[data-outcome=REJECT]').waitFor();
  assert.equal((await leader.locator('.vr-slide-out .vr-outcome').textContent()).trim(),'Not passed');
  await leader.locator('.vr-slide-sliding').waitFor();
  const fade=await leader.evaluate(()=>[...document.querySelectorAll('.vr-slide-sliding>div')].map(e=>getComputedStyle(e).animationName));
  assert.deepEqual(fade.sort(),['vr-fade-in','vr-fade-out']);
  await leader.locator('.vr-slide-ready').waitFor();
  s=await stop(leader);assert.equal(s.blank,0);assert.ok(s.outX.every(v=>v===0)&&s.inX.every(v=>v===0),'reduced motion: no movement');
  assert.ok(s.slideEnd-s.slideStart<400,`reduced motion: short crossfade (${Math.round(s.slideEnd-s.slideStart)} ms)`);
  assert.equal(f.h.state().audit.filter(a=>a.action==='voting.room.decide_and_advance').length,decided+1,'four rapid clicks decide once');
  const pass=f.h.state().sessions[0].passes.find(p=>p.number===1);
  assert.equal(pass.candidates.find(c=>c.applicationId===apps[2]).ballotState,'PENDING','the next applicant is not decided by a repeated click');
  assert.deepEqual(errors,[]);
 }finally{for(const c of contexts)await c.close();await browser.close();await f.close();}
});

test('decision motion: failed and delayed saves, failed next slide, Hold, reserved photo box, narrow layout, decision from another device',{timeout:600000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[],contexts=[];
 const open=async(viewport,view,actor)=>{const c=await browser.newContext({viewport});contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(`${view}: ${e.message}`));await p.goto(roomUrl(f,view,actor));return p;};
 try{
  await f.h.create();f.h.as(leaderId);for(const c of ['START','OPEN_VOTING','CLOSE_VOTING'])await f.h.command(c);
  const leader=await open({width:1366,height:768},'leader','leader');
  await heading(leader,'QA Applicant One').waitFor();
  const photo=await leader.locator('.vr-slide-in .oc-applicant-identity-photo').evaluate(e=>{const r=e.getBoundingClientRect();return [r.width,r.height,e.getAttribute('data-photo')];});
  assert.equal(photo[2],'placeholder');assert.ok(photo[0]>0&&photo[1]>0,'missing photo keeps a reserved box');

  // 1. Failed save: the applicant stays, no outcome, Retry. Then a failed next-slide load: Retry is reachable.
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic decision reason');
  f.failCommand();await leader.getByRole('button',{name:'Pass',exact:true}).click();
  await leader.getByRole('button',{name:'Retry command',exact:true}).waitFor();
  assert.equal(f.h.state().sessions[0].activeApplicationId,apps[0]);assert.equal(await leader.locator('.vr-outcome').count(),0);
  await heading(leader,'QA Applicant One').waitFor();
  f.failAction('getLiveVotingPresentation');
  await leader.getByRole('button',{name:'Retry command',exact:true}).click();
  await leader.getByRole('button',{name:'Retry presentation',exact:true}).click({timeout:5000});
  await heading(leader,'QA Applicant Two').waitFor();await leader.locator('.vr-slide-ready').waitFor();
  // After Retry the new applicant is focused and announced, as after any other arrival.
  await leader.waitForFunction(()=>document.activeElement?.textContent==='QA Applicant Two');
  await leader.locator('.sr-only[role=status]',{hasText:'QA Applicant Two'}).first().waitFor({state:'attached'});
  assert.equal(await leader.locator('.vr-slide-in .oc-applicant-identity-photo').evaluate(e=>{const r=e.getBoundingClientRect();return `${r.width}x${r.height}`;}),`${photo[0]}x${photo[1]}`,'the photo box keeps its size');
  await unlocked(leader,'Open voting'); // controls unlock after Retry

  // 2. Delayed save: acknowledged at once (locked), a restrained "Saving" line only once it takes a moment; then Hold.
  const member=await open({width:390,height:844},'member','member');
  const join=member.getByRole('button',{name:'Join session',exact:true});if(await join.isVisible().catch(()=>false))await join.click();
  await heading(member,'QA Applicant Two').waitFor();
  f.h.as(leaderId);for(const c of ['OPEN_VOTING','CLOSE_VOTING'])await f.h.command(c);
  await leader.reload();await heading(leader,'QA Applicant Two').waitFor();
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic decision reason');
  f.delay('commandLiveVotingRoom',1500);
  await sample(member);const poll=setInterval(()=>void focus([member]).catch(()=>{}),300);
  const hold=leader.getByRole('button',{name:'Hold',exact:true});await hold.click();
  assert.ok(await hold.isDisabled(),'the press is acknowledged at once');
  await leader.getByText('Saving Hold...',{exact:true}).waitFor();
  assert.equal(await leader.locator('.vr-outcome').count(),0,'no outcome before the save is confirmed');
  f.delay('commandLiveVotingRoom',0);
  const holdMark=leader.locator('.vr-slide-out .vr-outcome[data-outcome=HOLD]');await holdMark.waitFor();
  assert.equal((await holdMark.textContent()).trim(),'Held for another vote');
  // Narrow layout: the member sees the same outcome; nothing overflows.
  try{await member.waitForFunction(()=>window.__s.outcomes.length>0&&document.querySelector('.vr-slide-ready'),null,{timeout:20000});}finally{clearInterval(poll);}
  const m=await stop(member);assert.deepEqual(m.outcomes,['Held for another vote']);assert.equal(m.blank,0);
  assert.ok(await member.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone: no horizontal scroll');

  // 3. The last applicant is decided on another device: the outcome shows, then the pass ends cleanly.
  await leader.locator('.vr-slide-ready').waitFor();
  await sample(leader);
  f.h.as(leaderId);assert.equal((await f.h.command('DECIDE_WITHOUT_VOTE_AND_ADVANCE',{applicationId:apps[2],passNumber:1,choice:'REJECT',reason:'Decided on another device',confirmed:true})).ok,true);
  await focus([leader]);
  await leader.locator('.vr-slide-in [data-applicant-heading]',{hasText:'Review held applicants'}).waitFor({timeout:20000});
  const l=await stop(leader);assert.deepEqual(l.outcomes,['Not passed without a vote']);assert.equal(l.blank,0);
  assert.deepEqual(errors,[]);
 }finally{for(const c of contexts)await c.close();await browser.close();await f.close();}
});
