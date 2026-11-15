const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
const {sessionId,apps,leaderId}=require('./helpers/voting-room-harness.cjs');
// Server-backed Undo: visible after a refresh and on a second leader device, hidden after newer activity,
// and a stale Undo (from a device that has not seen the newer activity) is refused with clear wording.
test('server-backed Undo across refreshes and leader devices; hidden after newer activity; stale Undo refused',{timeout:600000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),errors=[],contexts=[];
 const open=async()=>{const c=await browser.newContext({viewport:{width:1366,height:768}});contexts.push(c);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`${f.url}/voting/rooms/${sessionId}?clubId=${f.clubId}&view=leader&actor=leader`);return p;};
 const refresh=p=>p.evaluate(()=>window.dispatchEvent(new Event('focus')));
 const undo=p=>p.getByRole('button',{name:'Undo',exact:true});
 const decidePass=async p=>{await p.getByRole('textbox',{name:'Decision reason'}).fill('Synthetic decision reason');await p.getByRole('button',{name:'Pass',exact:true}).click();};
 const undone=()=>f.h.state().audit.filter(a=>a.action==='voting.room.undo_decision').length;
 try{
  await f.h.create();f.h.as(leaderId);for(const c of ['START','OPEN_VOTING','CLOSE_VOTING'])await f.h.command(c);
  const a=await open();
  await decidePass(a);await undo(a).waitFor();
  assert.equal(f.h.state().sessions[0].activeApplicationId,apps[1]);

  // After a refresh: the decision notice and Undo come back from the room snapshot.
  await a.reload();await undo(a).waitFor();
  assert.match(await a.locator('.vr-decision-saved').textContent(),/Passed/);

  // On a second leader device: the same Undo, and it works from there.
  const b=await open();await undo(b).waitFor();
  await undo(b).click();
  await b.getByRole('button',{name:'Pass',exact:true}).waitFor();
  assert.equal(f.h.state().sessions[0].activeApplicationId,apps[0]);assert.equal(undone(),1);
  await refresh(a);await undo(a).waitFor({state:'detached'});

  // Decide again on the first device; both devices offer Undo.
  await a.getByRole('button',{name:'Pass',exact:true}).waitFor();await decidePass(a);await undo(a).waitFor();
  await refresh(b);await undo(b).waitFor();

  // Stale Undo: newer activity lands (another device opens voting) while this device's room reads lag.
  f.delay('getLiveVotingRoom',15000);
  f.h.as(leaderId);assert.equal((await f.h.command('OPEN_VOTING')).ok,true);
  await undo(a).click();
  await a.getByRole('alert').filter({hasText:'Newer room activity prevents Undo'}).waitFor();
  assert.equal(f.h.state().sessions[0].activeApplicationId,apps[1]);assert.equal(undone(),1);

  // Once the snapshot arrives, Undo is hidden on every leader device.
  f.delay('getLiveVotingRoom',0);
  for(const p of [a,b]){await refresh(p);await undo(p).waitFor({state:'detached',timeout:40000});}
  await a.reload();await a.getByRole('button',{name:'Close voting',exact:true}).waitFor();assert.equal(await undo(a).count(),0);
  assert.deepEqual(errors,[]);
 }finally{for(const c of contexts)await c.close();await browser.close();await f.close();}
});
