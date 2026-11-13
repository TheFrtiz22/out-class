const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright'),{fixture}=require('./helpers/scheduling-ui-fixture.cjs');
// Production: a draft built while its only session was upcoming; the session has since passed. Regenerate
// must say why it can't, and offer Discard draft, which returns the workspace to its empty state.
test('regenerating a draft with no upcoming open sessions shows the reason and Discard draft, which empties the workspace',async()=>{
 const f=await fixture({fresh:true});let browser;
 try{
  f.asLeader();await f.api.createInterviewRoom({...f.scope,name:'Synthetic passed draft',location:'Hall',kind:'IN_PERSON',timezone:'America/New_York',dates:['2099-12-01'],start:'10:00',end:'10:20',duration:20,buffer:5,capacity:1,interviewersNeeded:1,panelMemberIds:[]});
  await f.api.generatePanelProposal({...f.scope,revision:0,window:{start:'2099-12-01T05:00:00.000Z',end:'2099-12-02T05:00:00.000Z'},options:{maxConsecutiveMinutes:null,breakMinutes:15},mode:'REGENERATE'});
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);await page.route('**/*',r=>r.request().url().startsWith(f.url)?r.continue():r.abort());await page.goto(f.url+'/?roundId='+f.scope.roundId+'&schedule=review');
  const panel=page.getByRole('region',{name:'Review Panel Assignments'}),issues=panel.getByRole('region',{name:'Staffing issues'}),confirm=panel.getByRole('button',{name:'Confirm assignments',exact:true});await confirm.waitFor()
  // The session passes, and confirmation reports the draft as stale, as production did.
  f.mutate(s=>{for(const room of s.interviewRooms.filter(r=>r.name==='Synthetic passed draft'))for(const slot of room.slots){slot.startTime='2020-12-01T15:00:00.000Z';slot.endTime='2020-12-01T15:20:00.000Z'}})
  let refuse=true
  await page.route('**/action',async route=>{const {name}=route.request().postDataJSON();if(name==='reviewPanelPublication'&&refuse){refuse=false;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,error:'Session times or staffing configuration changed. Regenerate the draft, then review it again.',code:'DRAFT_STALE'})})}else await route.fallback()})
  await confirm.click();await issues.getByRole('alert').getByRole('button',{name:'Regenerate draft',exact:true}).click()
  const alert=issues.getByRole('alert').filter({hasText:/no upcoming, open sessions left/});await alert.waitFor()
  assert.equal(await page.getByText(/Could not apply this change/).count(),0,'the generic fallback is not shown')
  assert.equal(await alert.getByRole('button',{name:'Reload draft',exact:true}).count(),0)
  assert.equal(await alert.getByRole('button',{name:'Reopen a room',exact:true}).count(),1)
  assert.ok(f.state().bookingFlow.panels[f.scope.roundId].draft,'the refused regeneration kept the draft')
  // Cancelling keeps the draft; confirming discards it.
  await alert.getByRole('button',{name:'Discard draft',exact:true}).click()
  let dialog=page.getByRole('alertdialog',{name:'Discard this draft?'});await dialog.getByText('Nothing has been published from it.').waitFor()
  await dialog.getByRole('button',{name:'Cancel'}).click();await dialog.waitFor({state:'hidden'});assert.ok(f.state().bookingFlow.panels[f.scope.roundId].draft)
  const writes=f.writes.length
  await alert.getByRole('button',{name:'Discard draft',exact:true}).click();dialog=page.getByRole('alertdialog',{name:'Discard this draft?'});await dialog.getByRole('button',{name:'Discard draft',exact:true}).click()
  await panel.getByText('Draft discarded.').waitFor()
  assert.deepEqual(f.writes.slice(writes).map(w=>w.name),['discardPanelProposal'])
  assert.equal(f.state().bookingFlow.panels[f.scope.roundId].draft,null)
  assert.equal(await confirm.count(),0);assert.equal(await issues.count(),0)
  await panel.getByRole('heading',{name:'No upcoming interview sessions'}).waitFor();await panel.getByRole('button',{name:'Assign available interviewers',exact:true}).waitFor()
  assert.equal(f.liveCalls(),0);assert.deepEqual(errors,[])
 }finally{await browser?.close();await f.close()}
});
