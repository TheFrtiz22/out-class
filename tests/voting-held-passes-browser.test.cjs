// Held-applicant passes and ending across independent sessions (leader, voting member on a phone with reduced motion,
// projector): a compact intermission instead of wrapping back; the leader chooses; a crossfade into each new pass and
// into the summary; the horizontal transition inside a pass; fresh ballots; counts move once; target is guidance.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {sessionId,apps,leaderId}=require('./helpers/voting-room-harness.cjs');

const roomUrl=(f,view,actor)=>`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}&view=${view}&actor=${actor}`;
const focus=pages=>Promise.all(pages.map(p=>p.evaluate(()=>window.dispatchEvent(new Event('focus'))).catch(()=>{})));
// Records every transition: its mode, any movement during a crossfade, and each heading that reached the screen.
const watch=p=>p.evaluate(()=>{const s=window.__w={modes:[],fadeMoved:0,headings:[],header:[],on:true,sliding:false};const shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});
 const x=e=>{const m=e&&getComputedStyle(e).transform;return !m||m==='none'?0:Math.abs(new DOMMatrix(m).m41);};
 const tick=()=>{const st=document.querySelector('.vr-slide-stage');if(st){const sl=st.classList.contains('vr-slide-sliding'),fade=st.classList.contains('vr-slide-fade');if(sl&&!s.sliding)s.modes.push(fade?'fade':'slide');s.sliding=sl;
  if(sl&&fade&&(x(st.querySelector('.vr-slide-out'))>0.5||x(st.querySelector('.vr-slide-in'))>0.5))s.fadeMoved++;
  const h=st.querySelector('.vr-slide-in [data-applicant-heading]');if(st.classList.contains('vr-slide-ready')&&shown(h)&&s.headings.at(-1)!==h.textContent)s.headings.push(h.textContent);
  const hd=document.querySelector('.vr-header')?.getBoundingClientRect().top+scrollY;if(hd!==undefined&&s.header.at(-1)!==Math.round(hd))s.header.push(Math.round(hd));}
  if(s.on)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
const stop=p=>p.evaluate(()=>{window.__w.on=false;return window.__w;});

async function session(browser,contexts,errors,f){
 const open=async(view,actor,options={})=>{const c=await browser.newContext({viewport:{width:1366,height:768},...options});contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(`${view}: ${e.message}`));await p.goto(roomUrl(f,view,actor));return p;};
 const leader=await open('leader','leader'),member=await open('member','member',{viewport:{width:390,height:844},reducedMotion:'reduce'}),projector=await open('present','leader');
 const join=member.getByRole('button',{name:'Join session',exact:true});if(await join.isVisible().catch(()=>false))await join.click();
 return {leader,member,projector,all:[leader,member,projector]};
}
const act=async(f,...commands)=>{f.h.as(leaderId);for(const [c,extra] of commands)assert.equal((await f.h.command(c,extra)).ok,true,c);};
const decide=(f,applicationId,passNumber,choice)=>act(f,['OPEN_VOTING'],['CLOSE_VOTING'],['DECIDE_AND_ADVANCE',{applicationId,passNumber,choice,reason:'Synthetic'}]);
const settle=async(pages,heading)=>{for(const p of pages){await focus([p]);await p.locator('.vr-slide-in [data-applicant-heading]',{hasText:heading}).waitFor({timeout:20000});await p.locator('.vr-slide-ready').waitFor();}};

test('full session across devices: intermission, held passes with fresh ballots, over target, end with no holds',{timeout:600000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[],contexts=[];
 try{
  await f.h.create();await act(f,['START']);
  const {leader,member,projector,all}=await session(browser,contexts,errors,f);
  for(const p of all)await p.locator('.vr-slide-ready').waitFor();
  // Pass 1: Pass, Hold; then Do not pass on the last applicant, watched on every device.
  await decide(f,apps[0],1,'ACCEPT');await decide(f,apps[1],1,'HOLD');await settle(all,'QA Applicant Two');
  for(const p of all)await watch(p);
  await decide(f,apps[2],1,'REJECT');
  await focus([leader]);await leader.locator('.vr-slide-sliding').waitFor();
  assert.ok(await leader.evaluate(()=>!![...document.querySelectorAll('.vr-leader fieldset')].find(f=>f.disabled)),'leader controls locked until the intermission has arrived');
  const poll=setInterval(()=>void focus(all),300);
  try{await settle(all,'Review held applicants');}finally{clearInterval(poll);}
  for(const [i,p] of all.entries()){const w=await stop(p);assert.deepEqual(w.modes,['slide'],`device ${i}: the last applicant slides out into the intermission`);
   assert.ok(!w.headings.includes('QA Applicant One'),'never wraps back to the first applicant');assert.equal(new Set(w.header).size,1,`device ${i}: header stays put (${w.header})`);}
  for(const p of all)await p.getByText(/^1 held applicant remaining/).waitFor();
  await projector.getByText('1 held applicant remaining · Waiting for the leader',{exact:true}).waitFor();
  await member.getByText('Waiting for the leader',{exact:true}).waitFor();
  // The intermission fills the stage the last applicant held: no blank gap, no jump.
  for(const p of all)assert.ok(await p.evaluate(()=>{const st=document.querySelector('.vr-slide-stage').getBoundingClientRect().height,c=document.querySelector('.vr-intermission').getBoundingClientRect().height;return Math.abs(st-c)<=2;}),'intermission fills the stage');
  assert.equal(await leader.locator('.vr-intermission-counts').count(),0,'leaders keep their own totals; no duplicate counts');
  assert.equal(f.h.state().sessions[0].currentPass,1,'no automatic next pass');
  const card=leader.getByRole('list').first();void card;
  assert.match(await projector.locator('.vr-intermission-counts').innerText(),/Passed\s*1[\s\S]*Held\s*1[\s\S]*Not passed\s*1[\s\S]*Unreviewed\s*0/);

  // The leader starts pass 2: every device crossfades (no movement) into the held applicant.
  for(const p of all)await watch(p);
  await leader.getByRole('button',{name:'Review held applicants',exact:true}).click();
  const poll2=setInterval(()=>void focus([member,projector]),300);
  try{for(const p of all){await p.getByText(/Pass 2$/).first().waitFor({timeout:20000});await p.locator('.vr-slide-ready').waitFor();}}finally{clearInterval(poll2);}
  for(const [i,p] of all.entries()){const w=await stop(p);assert.deepEqual(w.modes,['fade'],`device ${i}: a crossfade into the new pass`);assert.equal(w.fadeMoved,0,'a crossfade never moves');assert.equal(new Set(w.header).size,1);}
  await leader.waitForFunction(()=>document.activeElement?.hasAttribute('data-applicant-heading'));
  // Fresh ballot: the member's pass-1 Hold is not carried over.
  await act(f,['OPEN_VOTING']);await focus([member]);
  await member.getByRole('button',{name:'Hold',exact:true}).waitFor();
  for(const c of ['Pass','Hold','Do not pass'])assert.equal(await member.getByRole('button',{name:c,exact:true}).getAttribute('aria-pressed'),'false',c);
  await member.getByText('Choose your vote',{exact:true}).waitFor();
  await member.getByRole('button',{name:'Hold',exact:true}).click();await member.getByText('Vote recorded · Hold',{exact:true}).waitFor();
  // Hold again: back to the intermission for pass 2, then a third pass where they pass, beyond the target of 1.
  await act(f,['CLOSE_VOTING'],['DECIDE_AND_ADVANCE',{applicationId:apps[1],passNumber:2,choice:'HOLD',reason:'Synthetic'}]);
  await settle(all,'Review held applicants');await leader.getByText('Pass 2 complete',{exact:true}).waitFor();
  await leader.getByRole('button',{name:'Review held applicants',exact:true}).click();await settle([leader],'QA Applicant Two');
  await decide(f,apps[1],3,'ACCEPT');await settle(all,'Review complete');
  for(const p of all)await p.getByText(/^No held applicants remain\./).waitFor();
  assert.equal(await leader.getByRole('button',{name:'Review held applicants',exact:true}).count(),0);
  await leader.getByText('1 over target',{exact:true}).first().waitFor();
  assert.match(await member.locator('.vr-intermission-counts').innerText(),/Passed\s*2[\s\S]*Held\s*0[\s\S]*Not passed\s*1[\s\S]*Unreviewed\s*0/);

  // End voting: the leader's explicit action; every device fades to the summary with passed applicants first.
  for(const p of all)await watch(p);
  leader.once('dialog',d=>d.accept());await leader.getByRole('button',{name:'End voting',exact:true}).click();
  const poll3=setInterval(()=>void focus([member,projector]),300);
  try{for(const p of all)await p.locator('.vr-intermission-kicker',{hasText:'Voting ended'}).waitFor({timeout:20000});}finally{clearInterval(poll3);}
  await member.getByRole('region',{name:'Voting summary',exact:true}).waitFor();
  for(const p of [member,projector]){const s=p.getByRole('region',{name:'Voting summary',exact:true});
   await s.getByRole('heading',{name:'2 passed',exact:true}).waitFor();assert.deepEqual(await s.getByRole('list',{name:'Passed applicants'}).getByRole('listitem').allTextContents(),['Applicant 1','Applicant 2']);
   assert.match(await s.locator('.vr-intermission-counts').innerText(),/Passed\s*2[\s\S]*Held\s*0[\s\S]*Not passed\s*1[\s\S]*Unreviewed\s*0/);
  }
  await leader.getByRole('region',{name:'Voting result',exact:true}).waitFor();
  // The pressed End voting button is gone: focus lands on the result heading, not the page.
  await leader.waitForFunction(()=>document.activeElement?.textContent==='2 passed');
  for(const p of all){const w=await stop(p);assert.deepEqual(w.modes,['fade'],'ending crossfades into the summary');assert.equal(w.fadeMoved,0);assert.equal(new Set(w.header).size,1,'header stays put');}
  assert.equal(f.h.state().notifications.length,0,'ending sends nothing');
  assert.deepEqual(errors,[]);
 }finally{for(const c of contexts)await c.close();await browser.close();await f.close();}
});

test('ending early from an applicant: crossfade to the summary; Hold and Unreviewed stay distinct from Do not pass',{timeout:600000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[],contexts=[];
 try{
  await f.h.create();await act(f,['START']);
  const {leader,member,projector,all}=await session(browser,contexts,errors,f);
  await decide(f,apps[0],1,'ACCEPT');await decide(f,apps[1],1,'HOLD');await settle(all,'QA Applicant Two');
  for(const p of all)await watch(p);
  // End voting while applicant 3 is current and undecided (More actions → End voting).
  await leader.getByText('More actions',{exact:true}).click();
  leader.once('dialog',d=>d.accept());await leader.getByRole('button',{name:'End voting',exact:true}).click();
  const poll=setInterval(()=>void focus([member,projector]),300);
  try{for(const p of all){await p.locator('.vr-intermission-kicker',{hasText:'Voting ended'}).waitFor({timeout:20000});await p.locator('.vr-slide-ready').waitFor();}}finally{clearInterval(poll);}
  for(const [i,p] of all.entries()){const w=await stop(p);assert.deepEqual(w.modes,['fade'],`device ${i}: a gentle crossfade to the summary`);assert.equal(w.fadeMoved,0);assert.equal(new Set(w.header).size,1);}
  for(const p of [member,projector])assert.match(await p.getByRole('region',{name:'Voting summary',exact:true}).locator('.vr-intermission-counts').innerText(),/Passed\s*1[\s\S]*Held\s*1[\s\S]*Not passed\s*0[\s\S]*Unreviewed\s*1/);
  assert.equal(f.h.state().notifications.length,0);
  assert.deepEqual(errors,[]);
 }finally{for(const c of contexts)await c.close();await browser.close();await f.close();}
});
