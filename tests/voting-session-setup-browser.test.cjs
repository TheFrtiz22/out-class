const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{fixture}=require('./helpers/voting-room-ui-fixture.cjs');
test('three steps restore a private draft, schedule without starting, expose details/QR and permit explicit edits/cancellation',{timeout:180000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(f.url+'/voting/rooms/new?actor=leader');await page.getByRole('textbox',{name:'Session name',exact:true}).waitFor();await page.getByRole('textbox',{name:'Session name',exact:true}).fill('Synthetic planning meeting');await page.getByRole('radio',{name:'Schedule for later'}).check();await page.getByRole('textbox',{name:'Date and start time'}).fill(new Date(Date.now()+2*86400000).toISOString().slice(0,16));await page.getByText('Location and participant instructions · Optional',{exact:true}).click();await page.getByRole('textbox',{name:'Location or meeting link'}).fill('QA Hall');
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Draft saved',{exact:true}).waitFor();assert.equal(f.h.state().sessions.length,0);assert.equal(f.h.state().notifications.length,0);
 await page.reload();await page.getByRole('textbox',{name:'Session name',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Session name',exact:true}).inputValue(),'Synthetic planning meeting');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Select all voters',exact:true}).click();await page.getByRole('spinbutton',{name:'Target number to pass',exact:true}).fill('1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('region',{name:'Session review'}).waitFor();await page.getByRole('heading',{name:'Presentation preview'}).waitFor();
 const dir=path.resolve('test-results/voting-session-setup');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,'review-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(dir,'review-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Schedule session',exact:true}).click();await page.getByText('Session options',{exact:true}).click();await page.getByRole('region',{name:'Session details'}).waitFor();assert.equal(f.h.state().sessions.length,1);assert.equal(f.h.state().sessions[0].state,'DRAFT');assert.equal(f.h.state().sessions[0].passes.length,0);await page.getByText('Voting has not started.',{exact:true}).waitFor();await page.getByRole('link',{name:'Edit session',exact:true}).click();await page.getByRole('textbox',{name:'Session name',exact:true}).waitFor();await page.getByRole('textbox',{name:'Session name',exact:true}).fill('Revised synthetic meeting');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Save session changes',exact:true}).click();await page.getByText('Session options',{exact:true}).click();await page.getByRole('heading',{name:'Revised synthetic meeting',exact:true}).waitFor();assert.equal(f.h.state().sessions.length,1);assert.equal(f.h.state().sessions[0].passes.length,0);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Cancel session',exact:true}).click();await page.getByText('Cancelled',{exact:true}).waitFor();assert.equal(f.h.state().sessions[0].state,'COMPLETED');assert.equal(await page.getByRole('button',{name:'Finalize decisions',exact:true}).count(),0);assert.ok(f.h.state().apps.every(a=>a.status==='IN_REVIEW'));assert.equal(f.h.state().notifications.length,0);assert.deepEqual(errors,[]);
 }finally{await browser.close();await f.close()}
});
// Production QA: ticking fields and clicking Start session while "Saving draft…" showed did nothing twice.
test('Start session clicked while the draft autosaves is queued and visibly pending, then starts exactly one session',{timeout:180000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:800}}),calls=[];
 let release;const held=new Promise(r=>release=r);
 // Hold the autosave in flight until the Start click has been checked.
 await page.route('**/action',async route=>{const name=route.request().postDataJSON()?.name;calls.push(name);if(name==='saveEditorDraft'&&calls.includes('previewVotingSetup'))await held;await route.continue();});
 try{
  await page.goto(f.url+'/voting/rooms/new?actor=leader');await page.getByRole('button',{name:'Continue',exact:true}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Select all voters',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('heading',{name:'Presentation preview'}).waitFor();
  await page.locator('fieldset').filter({hasText:'Presentation fields'}).getByRole('checkbox').last().click();
  await page.getByText('Saving draft…',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Start session',exact:true}).click();
  const pending=page.getByRole('button',{name:'Saving draft…',exact:true});await pending.waitFor();
  assert.equal(await pending.isDisabled(),true);assert.equal(await pending.getAttribute('aria-busy'),'true');
  await page.getByText('Saving draft… the session starts as soon as it is saved').waitFor();
  assert.equal(f.h.state().sessions.length,0,'nothing is created before the draft save finishes');
  release();
  await page.getByRole('button',{name:'Open voting',exact:true}).waitFor({timeout:20000});
  assert.equal(f.h.state().sessions.length,1);assert.equal(f.h.state().sessions[0].state,'OPEN');
  assert.equal(calls.filter(n=>n==='createLiveVotingRoom').length,1);assert.equal(calls.filter(n=>n==='commandLiveVotingRoom').length,1);
 }finally{release();await page.unrouteAll({behavior:'ignoreErrors'});await browser.close();await f.close()}
});
test('start-now validates the advisory target, retains setup across a lost creation response and retries into exactly one active session',{timeout:180000},async()=>{
 const f=await fixture(),browser=await chromium.launch({headless:true}),page=await browser.newPage();try{
 await page.goto(f.url+'/voting/rooms/new?actor=leader');await page.getByRole('button',{name:'Continue',exact:true}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();const target=page.getByRole('spinbutton',{name:'Target number to pass',exact:true});await target.fill('0');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('alert').filter({hasText:'positive whole number'}).waitFor();assert.equal(f.h.state().sessions.length,0);await target.fill('1');await page.getByRole('button',{name:'Continue',exact:true}).click();f.dropCreate();await page.getByRole('button',{name:'Start session',exact:true}).click();await page.getByRole('button',{name:'Retry session',exact:true}).waitFor();assert.equal(f.h.state().sessions.length,1);assert.equal(f.h.state().sessions[0].state,'DRAFT');await page.getByRole('button',{name:'Retry session',exact:true}).click();await page.getByRole('button',{name:'Open voting',exact:true}).waitFor();assert.equal(f.h.state().sessions.length,1);assert.equal(f.h.state().sessions[0].state,'OPEN');assert.equal(f.h.state().sessions[0].passes.length,1);assert.equal(f.h.state().notifications.length,0);assert.ok(f.h.state().apps.every(a=>a.status==='IN_REVIEW'));
 }finally{await browser.close();await f.close()}
});
