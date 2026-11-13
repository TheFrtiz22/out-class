const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright'),{fixture}=require('./helpers/scheduling-ui-fixture.cjs');
// The confirmation refusal is the server's own typed result; the UI must show its reason and the action that fixes it.
test('a stale draft shows the specific server reason with Regenerate draft, which rebuilds the draft so it can be confirmed',async()=>{
 const f=await fixture({fresh:true});let browser;
 try{
  f.asLeader();await f.api.createInterviewRoom({...f.scope,name:'Synthetic stale draft',location:'Hall',kind:'IN_PERSON',timezone:'America/New_York',dates:['2099-12-01'],start:'10:00',end:'10:40',duration:20,buffer:5,capacity:1,interviewersNeeded:1,panelMemberIds:[]});
  await f.api.generatePanelProposal({...f.scope,revision:0,window:{start:'2099-12-01T05:00:00.000Z',end:'2099-12-02T05:00:00.000Z'},options:{maxConsecutiveMinutes:null,breakMinutes:15},mode:'REGENERATE'});
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);await page.route('**/*',r=>r.request().url().startsWith(f.url)?r.continue():r.abort());await page.goto(f.url+'/?roundId='+f.scope.roundId+'&schedule=review');
  const panel=page.getByRole('region',{name:'Review Panel Assignments'}),issues=panel.getByRole('region',{name:'Staffing issues'}),confirm=panel.getByRole('button',{name:'Confirm assignments',exact:true});await confirm.waitFor()
  const message='Session times or staffing configuration changed. Regenerate the draft, then review it again.';let refuse=true
  await page.route('**/action',async route=>{const {name}=route.request().postDataJSON();if(name==='reviewPanelPublication'&&refuse){refuse=false;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,error:message,code:'DRAFT_STALE'})})}else await route.fallback()})
  await confirm.click();const alert=issues.getByRole('alert').filter({hasText:message});await alert.waitFor()
  assert.equal(await page.getByText(/Could not apply this change/).count(),0,'the generic fallback is not shown')
  assert.equal(await alert.getByRole('button',{name:'Reload draft',exact:true}).count(),0)
  const writes=f.writes.length,regenerated=page.waitForResponse(r=>r.url().endsWith('/action')&&r.request().postDataJSON().name==='generatePanelProposal')
  await alert.getByRole('button',{name:'Regenerate draft',exact:true}).click();await regenerated;await page.waitForFunction(()=>document.querySelector('[aria-label="Review Panel Assignments"]')?.getAttribute('data-saving')==='false')
  const call=f.writes.slice(writes).find(w=>w.name==='generatePanelProposal');assert.equal(call.args[0].mode,'FILL_MISSING');assert.ok(call.args[0].assignments,'the leader\'s positions are sent so they are kept')
  assert.equal(await issues.getByRole('alert').count(),0)
  await confirm.click();await page.getByRole('dialog',{name:/Final panel approval|Review panel schedule changes/}).waitFor()
  assert.equal(f.liveCalls(),0);assert.deepEqual(errors,[])
 }finally{await browser?.close();await f.close()}
});
