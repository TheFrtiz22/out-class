const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {sessionId,uuid}=require('./helpers/voting-room-harness.cjs');

// The projector shows the same one-line Pass meaning as the leader's target summary: both read
// room.targetSummary.pass (passMeaning() in lib/voting-target-summary.ts), never a second copy of the words.
const fits=page=>page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,innerHeight,innerWidth}));
const assertFits=async(page,label)=>{const m=await fits(page);assert.ok(m.height<=m.innerHeight+1&&m.width<=m.innerWidth,`${label}: no scroll (${JSON.stringify(m)})`)};

// One fixture for the file: bundling takes minutes on Windows.
test('projector shows the leader\'s Pass meaning for final and later-round wording, and still fits without scrolling',{timeout:400000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[];
 const base=`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}`;
 const open=async(view,width,height)=>{const page=await (await browser.newContext({viewport:{width,height}})).newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}&view=${view}&actor=leader`);await page.getByRole('heading',{name:'QA Applicant One',exact:true}).waitFor();return page;};
 const leaderMeaning=async page=>{const el=page.getByRole('region',{name:'Decision totals'}).locator('[data-pass-meaning]');await el.waitFor();return {kind:await el.getAttribute('data-pass-meaning'),text:(await el.innerText()).trim()};};
 const projectorMeaning=async page=>{const el=page.getByRole('region',{name:'Passed and target'}).locator('[data-pass-meaning]');await el.waitFor();return {kind:await el.getAttribute('data-pass-meaning'),text:(await el.innerText()).trim()};};
 try{
  await f.h.create({targetSize:2});await f.h.command('START');
  const sizes=[[1366,768],[1920,1080],[1280,720]];

  // The harness has one round, so this is the club's final decision round.
  const leader=await open('leader',1366,768);const finalLeader=await leaderMeaning(leader);
  assert.equal(finalLeader.kind,'final');assert.equal(finalLeader.text,'Pass means a final acceptance recommendation.');
  for(const [w,h] of sizes){
   const present=await open('present',w,h);
   assert.deepEqual(await projectorMeaning(present),finalLeader,`projector matches the leader at ${w}×${h}`);
   const style=await present.getByRole('region',{name:'Passed and target'}).locator('[data-pass-meaning]').evaluate(e=>{const s=getComputedStyle(e),stats=getComputedStyle(e.parentElement);return{size:parseFloat(s.fontSize),statsSize:parseFloat(stats.fontSize),color:s.color,muted:(()=>{const p=document.createElement('span');p.style.color='var(--muted-foreground)';e.appendChild(p);const c=getComputedStyle(p).color;p.remove();return c})()}});
   assert.ok(style.size<=style.statsSize,'quiet text: no larger than the counts line');assert.equal(style.color,style.muted,'muted foreground');
   await assertFits(present,`final wording ${w}×${h}`);
   await present.context().close();
  }

  // Add a later, non-archived round: Pass now advances, on both screens, from the same projection.
  f.h.rounds.push({...f.h.round,id:uuid(950),name:'Synthetic final round',order:f.h.round.order+1,archivedAt:null});
  await leader.reload();await leader.getByRole('heading',{name:'QA Applicant One',exact:true}).waitFor();
  const advanceLeader=await leaderMeaning(leader);
  assert.equal(advanceLeader.kind,'advance');assert.equal(advanceLeader.text,'Pass means advance to a later round.');
  for(const [w,h] of sizes){
   const present=await open('present',w,h);
   assert.deepEqual(await projectorMeaning(present),advanceLeader,`projector matches the leader at ${w}×${h}`);
   await assertFits(present,`later-round wording ${w}×${h}`);
   await present.context().close();
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});
