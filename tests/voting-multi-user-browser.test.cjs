// Independent browser sessions (separate contexts: leader, voting member, projector) against the real room UI and
// action code: a ballot never moves anyone; the leader's finalization moves every viewer once with the approved
// transition; duplicates, stale screens and catch-up after missed advances behave; other viewers never get a
// member's choice. Synthetic accounts and applicants only.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {sessionId,apps,leaderId,voterId}=require('./helpers/voting-room-harness.cjs');

const roomUrl=(f,view,actor)=>`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}&view=${view}&actor=${actor}`;
const focus=pages=>Promise.all(pages.map(p=>p.evaluate(()=>window.dispatchEvent(new Event('focus'))).catch(()=>{})));
// Counts transitions on one page: every slide start, every outcome mark shown, and every applicant arrival.
const watch=p=>p.evaluate(()=>{const s=window.__w={slides:0,outcomes:[],sliding:false,on:true};const shown=e=>!!e&&e.checkVisibility({visibilityProperty:true});
 const tick=()=>{const stage=document.querySelector('.vr-slide-stage');if(stage){const sliding=stage.classList.contains('vr-slide-sliding');if(sliding&&!s.sliding)s.slides++;s.sliding=sliding;
  const m=stage.querySelector('.vr-slide-out .vr-outcome');if(shown(m)&&s.outcomes.at(-1)!==m.textContent)s.outcomes.push(m.textContent);}if(s.on)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
const stop=p=>p.evaluate(()=>{window.__w.on=false;return window.__w;});
const position=p=>p.locator('p.sr-only',{hasText:/^Applicant \d of \d\./}).first().textContent();

test('multi-user voting: ballots never advance; finalization advances every viewer once; duplicates, stale clicks, catch-up and privacy',{timeout:600000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[],contexts=[];
 const open=async(view,actor,viewport={width:1366,height:768})=>{const c=await browser.newContext({viewport});contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(`${view}: ${e.message}`));await p.goto(roomUrl(f,view,actor));return p;};
 const leaderAct=async(...commands)=>{f.h.as(leaderId);for(const [c,extra] of commands)assert.equal((await f.h.command(c,extra)).ok,true,c);};
 try{
  await f.h.create();await leaderAct(['START']);
  const leader=await open('leader','leader'),member=await open('member','member',{width:390,height:844}),projector=await open('present','leader');
  const join=member.getByRole('button',{name:'Join session',exact:true});if(await join.isVisible().catch(()=>false))await join.click();
  await leaderAct(['OPEN_VOTING']);await focus([leader,member,projector]);
  const all=[leader,member,projector];
  for(const p of all)await p.locator('.vr-slide-ready').waitFor();
  // Privacy (6): record every room snapshot the leader and projector receive.
  const seen=[];for(const p of [leader,projector])p.on('response',async r=>{try{if(!r.url().endsWith('/action')||JSON.parse(r.request().postData()??'{}').name!=='getLiveVotingRoom')return;seen.push(await r.text());}catch{}});

  // 1. The member votes: immediate feedback, then "Vote recorded" and "Waiting for the group decision"; nobody moves.
  for(const p of all)await watch(p);
  await member.getByRole('button',{name:'Pass',exact:true}).waitFor();
  f.delay('castLiveVotingBallot',1200);
  const pass=member.getByRole('button',{name:'Pass',exact:true});
  // 3. Repeated clicks: four rapid presses record one ballot.
  await member.evaluate(()=>{const b=[...document.querySelectorAll('.vr-votes button')].find(b=>b.textContent.trim()==='Pass');for(let i=0;i<4;i++)b.click();});
  await member.getByText('Saving Pass…',{exact:true}).waitFor();assert.ok(await pass.isDisabled(),'buttons lock while the ballot saves');
  await member.getByText('Vote recorded · Pass',{exact:true}).waitFor();
  await member.getByText('Waiting for the group decision',{exact:true}).waitFor();
  f.delay('castLiveVotingBallot',0);
  const ballots=()=>f.h.state().sessions[0].passes[0].candidates[0].ballots;
  assert.equal(ballots().filter(b=>b.memberId===voterId).length,1,'one ballot from four clicks');
  for(let i=0;i<4;i++){await focus(all);await leader.waitForTimeout(150);} // duplicate refresh events
  await leader.getByText('1 of 2 eligible voters voted',{exact:true}).waitFor();
  for(const p of all){const w=await stop(p);assert.equal(w.slides,0,'a ballot never starts a transition');assert.deepEqual(w.outcomes,[]);assert.match(await position(p),/^Applicant 1 of 3\./);}
  assert.equal(f.h.state().sessions[0].activeApplicationId,apps[0]);

  // 2. The leader finalizes: every viewer advances once, even with duplicated refresh events during the slide.
  for(const p of all)await watch(p);
  await leader.getByRole('button',{name:'Close voting',exact:true}).click().catch(()=>{});
  leader.once('dialog',d=>d.accept());
  await leader.getByRole('textbox',{name:'Decision reason'}).waitFor({timeout:5000}).catch(async()=>{await leader.getByRole('button',{name:'Close voting',exact:true}).click();});
  await leader.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic group decision');
  await leader.getByRole('button',{name:'Pass',exact:true}).click();
  const spam=setInterval(()=>void focus([member,projector]),120);
  try{for(const p of all){await p.getByText(/^Applicant 2 of 3\./).first().waitFor({state:'attached',timeout:20000});await p.locator('.vr-slide-ready').waitFor();}}finally{clearInterval(spam);}
  for(const [i,p] of all.entries()){const w=await stop(p);assert.equal(w.slides,1,`viewer ${i}: exactly one transition`);assert.deepEqual(w.outcomes,['Passed'],`viewer ${i}: the confirmed outcome, once`);}
  assert.equal(f.h.state().audit.filter(a=>a.action==='voting.room.decide_and_advance').length,1);

  // 4. A stale screen: the member's room reads are held while the room moves on; their click is refused.
  let hold=true,released;const gate=new Promise(r=>released=r);
  await member.route('**/action',async route=>{const body=JSON.parse(route.request().postData()??'{}');if(hold&&body.name==='getLiveVotingRoom'){await gate;}await route.continue().catch(()=>{});});
  await leaderAct(['OPEN_VOTING']);
  // The member still shows applicant 2 with voting pending; open it on their screen by releasing one read, then hold again.
  hold=false;await focus([member]);await member.getByRole('button',{name:'Hold',exact:true}).waitFor();hold=true;
  await leaderAct(['CLOSE_VOTING'],['DECIDE_AND_ADVANCE',{applicationId:apps[1],passNumber:1,choice:'HOLD',reason:'Synthetic'}],['OPEN_VOTING']);
  await member.getByRole('button',{name:'Hold',exact:true}).click();
  await member.getByRole('alert').filter({hasText:/not recorded/}).waitFor();
  const pass1=f.h.state().sessions[0].passes[0];
  assert.equal(pass1.candidates.find(c=>c.applicationId===apps[2]).ballots.length,0,'nothing recorded for the applicant the member could not see');
  assert.equal(pass1.candidates.find(c=>c.applicationId===apps[1]).ballots.filter(b=>b.memberId===voterId).length,0);

  // 5. Catch-up: while the member's reads are still held, the last applicant is decided too. The member missed two
  //    advances (2 → 3 → pass end); when reads resume it lands on the current state directly, with no replay.
  await leaderAct(['CLOSE_VOTING'],['DECIDE_AND_ADVANCE',{applicationId:apps[2],passNumber:1,choice:'REJECT',reason:'Synthetic'}]);
  await watch(member);hold=false;released();await member.waitForTimeout(200);await member.unroute('**/action',{behavior:'ignoreErrors'});await focus([member]);
  await member.locator('.vr-slide-in [data-applicant-heading]',{hasText:'Review held applicants'}).waitFor({timeout:20000});await member.waitForTimeout(800);
  const caught=await stop(member);
  assert.equal(caught.slides,0,'missed advances are reconciled directly, never replayed');assert.deepEqual(caught.outcomes,[]);
  // A reload reconciles directly too: no transition at all.
  await member.reload();await watch(member);await member.locator('.vr-slide-in [data-applicant-heading]',{hasText:'Review held applicants'}).waitFor();
  await member.waitForTimeout(800);assert.equal((await stop(member)).slides,0,'a reload shows the current state directly');

  // 6. Privacy: no snapshot the leader or projector received carried a ballot list or the member's own choice.
  assert.ok(seen.length>3,'snapshots were observed');
  for(const body of seen){assert.ok(!body.includes('"ballots"'),'no ballot list');
   const snap=JSON.parse(body);for(const pass of snap.history??[])for(const c of pass.candidates)assert.equal(c.ownBallot,null,'never another member\'s ballot');}
  assert.deepEqual(errors,[]);
 }finally{for(const c of contexts)await c.close();await browser.close();await f.close();}
});
