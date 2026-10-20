const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {chromium}=require('playwright'),{fixture}=require('./helpers/scheduling-ui-fixture.cjs')
async function launch(){return chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})})}
async function shot(page,name){if(!process.env.OUTCLASS_SCHEDULING_SCREENSHOTS)return;fs.mkdirSync(process.env.OUTCLASS_SCHEDULING_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.OUTCLASS_SCHEDULING_SCREENSHOTS,name+'.png'),fullPage:true,animations:'disabled'})}

async function expandDates(panel){for(const header of await panel.locator('.ir-panel-day-trigger[aria-expanded="false"]').all())await header.click()}

test('browser: adding the first times after visiting an empty panel initializes assignment dates without reload',async()=>{
 const f=await fixture({fresh:true});let browser
 try{
  browser=await launch();const page=await browser.newPage();page.setDefaultTimeout(15000)
  await page.goto(`${f.url}/?roundId=${f.scope.roundId}&schedule=review`)
  await page.getByRole('heading',{name:'No upcoming interview sessions',exact:true}).waitFor()
  await page.getByRole('button',{name:'Go to Rooms',exact:true}).click()
  await page.getByRole('button',{name:'Add interview times',exact:true}).click()
  const dialog=page.getByRole('dialog');await dialog.getByLabel('Room name',{exact:true}).fill('Synthetic first times')
  await dialog.getByRole('button',{name:'Save times & continue',exact:true}).click()
  const assign=page.getByRole('region',{name:'Review Panel Assignments'}).getByRole('button',{name:'Assign available interviewers',exact:true})
  await assign.click();await expandDates(page.getByRole('region',{name:'Review Panel Assignments'}));await page.locator('.ir-schedule-row').first().waitFor()
  assert.equal(f.state().bookingFlow.panels[f.scope.roundId].draft.document.sessions.length,6)
  assert.equal(f.liveCalls(),0)
 }finally{await browser?.close();await f.close()}
})

test('browser: times → confirmed interviewers → booking, issue editor/override, pause and edits preserve reservations in isolated Demo',async()=>{
 const f=await fixture({fresh:true});let browser
 try{
  browser=await launch();const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>{errors.push(e.message);console.error('Fixture browser error:',e.message)});page.on('dialog',d=>d.accept())
  await page.route('**/*',route=>route.request().url().startsWith(f.url)?route.continue():route.abort())
  await page.goto(`${f.url}/?roundId=${f.scope.roundId}`)
  const nav=page.getByRole('navigation',{name:'Scheduling workflow'}),panel=page.getByRole('region',{name:'Review Panel Assignments'}),publication=page.getByRole('region',{name:'Publish interview booking'}),dialog=page.getByRole('dialog')
  await nav.waitFor();assert.equal(await nav.getByRole('button').count(),3)
  const steps=[];async function step(label,locator){await locator.click();steps.push(label)}
  await step('Open times form',page.getByRole('button',{name:'Add interview times',exact:true}))
  await dialog.getByRole('textbox',{name:'Room name',exact:true}).fill('Synthetic Hall A')
  assert.equal(await dialog.getByRole('textbox',{name:'Location',exact:true}).inputValue(),'Synthetic Hall A')
  assert.equal(await dialog.getByLabel('Recruitment round',{exact:true}).count(),0)
  assert.equal(await dialog.getByLabel('Interview duration',{exact:true}).inputValue(),String(f.state().clubs[0].rounds.find(r=>r.id===f.scope.roundId).configuration.duration))
  await dialog.getByLabel('Interview duration',{exact:true}).selectOption('20')
  await dialog.getByLabel('End time',{exact:true}).fill('10:20')
  await shot(page,'scheduling-times-desktop')
  await step('Save times',dialog.getByRole('button',{name:'Save times & continue',exact:true}))
  await panel.getByRole('button',{name:'Assign available interviewers',exact:true}).waitFor()
  await step('Assign available interviewers',panel.getByRole('button',{name:'Assign available interviewers',exact:true}))
  await expandDates(panel);await panel.locator('.ir-schedule-row').first().waitFor();assert.equal(await page.getByRole('dialog').count(),0,'no inline/automatic slot editor')
  await shot(page,'scheduling-confirm-desktop')
  await step('Review interviewer approval',panel.getByRole('button',{name:'Confirm interviewers',exact:true}))
  await step('Explicit owner approval',dialog.getByRole('button',{name:'Approve interviewers',exact:true}))
  await publication.getByText('1 slot ready',{exact:true}).waitFor()
  await shot(page,'scheduling-publish-desktop')
  await step('Publish booking',publication.getByRole('button',{name:'Publish booking',exact:true}))
  await page.getByRole('heading',{name:'Bookings',exact:true}).waitFor();assert.equal(steps.length,6)
  console.log('Ordinary setup/publish button actions:',JSON.stringify(steps))
  const applicant=await browser.newPage();await applicant.goto(f.url+'/?applicant=1')
  await applicant.locator('.ir-times button').first().click();await applicant.getByRole('button',{name:'Confirm interview',exact:true}).click();await applicant.getByText('Interview confirmed',{exact:true}).waitFor()
  const reservation=structuredClone(f.state().roomBookings);assert.equal(reservation.filter(b=>b.roundId===f.scope.roundId).length,1)
  await applicant.reload();await applicant.getByText('Interview confirmed',{exact:true}).waitFor()
  await page.reload();await page.getByRole('heading',{name:'Bookings',exact:true}).waitFor();await page.getByText('Full',{exact:true}).filter({visible:true}).waitFor()
  await page.getByRole('button',{name:'Edit schedule',exact:true}).click();await panel.getByRole('button',{name:'Edit interviewers',exact:true}).click();await expandDates(panel);await panel.locator('.ir-schedule-row').first().click()
  const editor=page.getByRole('dialog');await editor.getByLabel('Draft session interviewers needed',{exact:true}).selectOption('1');await editor.getByRole('button',{name:'Done',exact:true}).click();await editor.waitFor({state:'hidden'});assert.deepEqual(f.state().roomBookings,reservation)
  // Revert requirement, then resolve a real synthetic unavailable-interviewer issue.
  await panel.locator('.ir-schedule-row').first().click();await editor.getByLabel('Draft session interviewers needed',{exact:true}).selectOption('2')
  const assigned=f.state().bookingFlow.panels[f.scope.roundId].draft.document.assignments[0],target=f.state().memberships.find(m=>m.id===assigned.memberId),student=f.state().students.find(s=>s.id===target.userId),name=student.profile.firstName+' '+student.profile.lastName
  await editor.getByRole('button',{name:`Remove ${name}`,exact:true}).click();await editor.getByRole('button',{name:'Done',exact:true}).click()
  f.mutate(s=>s.bookingFlow.availability[`${f.scope.roundId}:${target.id}`]={confirmed:false,state:'unavailable'})
  await page.reload();await panel.getByText('Resolve staffing issues',{exact:true}).click();await page.getByRole('region',{name:'Staffing issues'}).getByRole('button').first().click()
  await editor.getByLabel('Add interviewer',{exact:true}).selectOption(target.id)
  const override=page.getByRole('dialog',{name:'Assign despite availability?',exact:true});await override.getByRole('button',{name:'Assign anyway',exact:true}).click();await override.waitFor({state:'hidden'})
  assert.ok(f.state().bookingFlow.overrides.some(o=>o.memberId===target.id&&!o.revokedAt));await editor.getByRole('button',{name:'Done',exact:true}).click()
  await panel.getByRole('button',{name:'Confirm interviewers',exact:true}).click();await dialog.getByRole('button',{name:'Approve interviewers',exact:true}).click()
  assert.deepEqual(f.state().roomBookings,reservation)
  await publication.getByText('More options',{exact:true}).click();await publication.getByRole('button',{name:'Pause booking',exact:true}).click();await dialog.getByRole('button',{name:'Pause booking',exact:true}).click();await publication.getByText('Paused',{exact:true}).waitFor()
  await applicant.reload();await applicant.getByText('Interview confirmed',{exact:true}).waitFor();await applicant.getByText(/paused new bookings/).waitFor();assert.deepEqual(f.state().roomBookings,reservation)
  const publishedBeforeAddingTimes=structuredClone(f.state().bookingFlow.panels[f.scope.roundId].published);await nav.getByRole('button',{name:/Set interview times/}).click();await page.getByRole('button',{name:'Add interview times',exact:true}).click();await dialog.getByLabel('Room name',{exact:true}).fill('Synthetic Hall B');await dialog.getByLabel('End time',{exact:true}).fill('10:20');await dialog.getByRole('button',{name:'Save times & continue',exact:true}).click();assert.deepEqual(f.state().roomBookings,reservation)
  await page.setViewportSize({width:390,height:844});await shot(page,'scheduling-publish-mobile');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  // Sheet visibility and Radix's unmount focus restoration settle separately.
  await nav.getByRole('button',{name:/Confirm interviewers/}).click();await panel.getByRole('button',{name:'Edit interviewers',exact:true}).click();await expandDates(panel);await page.waitForFunction(()=>document.querySelectorAll('.ir-schedule-row')[1]?.disabled===false);await panel.locator('.ir-schedule-row').nth(1).focus();await page.keyboard.press('Enter');await editor.getByLabel('Add interviewer',{exact:true}).waitFor();await shot(page,'scheduling-slot-mobile');await editor.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));const bounds=await editor.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{left:r.left,right:r.right,width:r.width,viewport:innerWidth,transform:s.transform,position:s.position,overflow:el.scrollWidth>el.clientWidth+1}});console.log('Mobile editor geometry:',bounds);assert.ok(bounds.left>=0&&bounds.right<=bounds.viewport+1,'slot editor must fit the phone viewport');assert.equal(bounds.overflow,false,'slot fields must fit inside the editor');await editor.getByRole('button',{name:'Done',exact:true}).click();await editor.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelectorAll('.ir-schedule-row')[1]===document.activeElement);assert.equal(await panel.locator('.ir-schedule-row').nth(1).evaluate(el=>el===document.activeElement),true)
  assert.deepEqual(f.state().bookingFlow.panels[f.scope.roundId].published,publishedBeforeAddingTimes);assert.equal(f.state().bookingFlow.panels[f.scope.roundId].draft.document.sessions.length,2);assert.deepEqual(f.state().roomBookings,reservation);assert.equal(f.liveCalls(),0);assert.deepEqual(errors,[])
 }finally{await browser?.close();await f.close()}
})

test('browser: an existing published round opens bookings directly; request failure is not an empty schedule',async()=>{
 const f=await fixture({fresh:true});let browser
 f.asLeader();await f.api.createInterviewRoom({...f.scope,name:'Existing synthetic hall',location:'Existing synthetic hall',kind:'IN_PERSON',timezone:'America/New_York',dates:['2099-12-01'],start:'10:00',end:'10:20',duration:20,buffer:0,capacity:1,interviewersNeeded:2,panelMemberIds:[]})
 let w=await f.api.getPanelProposalWorkspace(f.scope);w=await f.api.generatePanelProposal({...f.scope,revision:0,window:w.suggestedWindow,options:{maxConsecutiveMinutes:null,breakMinutes:15},mode:'REGENERATE'});const d=w.proposal,review=await f.api.reviewPanelPublication({...f.scope,proposalId:d.id,revision:d.revision});assert.equal(review.ok,true,review.error);assert.equal((await f.api.publishPanelSchedule({...f.scope,...review.value})).ok,true);await f.api.setInterviewBookingPublication({...f.scope,revision:0,action:'PUBLISH',cycleId:null,allowCancellation:true,allowRescheduling:true})
 try{browser=await launch();const page=await browser.newPage();page.on('pageerror',e=>console.error('Fixture browser error:',e.message));await page.goto(`${f.url}/?roundId=${f.scope.roundId}`);await page.getByRole('heading',{name:'Bookings',exact:true}).waitFor();assert.equal(await page.getByRole('navigation',{name:'Scheduling workflow'}).count(),0);await page.route('**/action',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic outage"}'}));await page.reload();await page.getByText('Could not load interview scheduling.',{exact:false}).waitFor();assert.equal(await page.getByText(/Create an interview round/).count(),0);assert.equal(f.liveCalls(),0)}finally{await browser?.close();await f.close()}
})

if(process.env.OUTCLASS_SCHEDULING_BASELINE)test('comparison: previous scheduling path requires seven button actions',async()=>{
 const f=await fixture({fresh:true,baseline:process.env.OUTCLASS_SCHEDULING_BASELINE});let browser
 try{browser=await launch();const page=await browser.newPage({viewport:{width:1440,height:1000}}),steps=[];page.setDefaultTimeout(15000);await page.goto(`${f.url}/?roundId=${f.scope.roundId}`);async function click(label,locator){await locator.click();steps.push(label)}
 await click('Continue to rooms',page.getByRole('button',{name:'Continue to Rooms',exact:true}));await click('Open times form',page.getByRole('button',{name:'Create interview room',exact:true}).first());const dialog=page.getByRole('dialog');await dialog.getByLabel('Room name',{exact:true}).fill('Previous synthetic hall');await dialog.getByLabel('Location',{exact:true}).fill('Previous synthetic hall');await dialog.getByLabel('End time',{exact:true}).fill('10:20');await click('Create room',dialog.getByRole('button',{name:/^Create room ·/}));await click('Auto-fill panels',page.getByRole('button',{name:'Auto-Fill Panels',exact:true}).filter({visible:true}).first());const panel=page.getByRole('region',{name:'Review Panel Assignments'});await panel.getByText('100% staffed',{exact:false}).waitFor();await shot(page,'scheduling-before-desktop');await click('Review panel approval',panel.getByRole('button',{name:'Review & Publish',exact:true}));await click('Explicit owner approval',dialog.getByRole('button',{name:'Confirm & Publish Panels',exact:true}));await click('Publish booking',page.getByRole('button',{name:'Publish interview booking',exact:true}));assert.equal(steps.length,7);console.log('Previous setup/publish button actions:',JSON.stringify(steps));assert.equal(f.liveCalls(),0)
 }finally{await browser?.close();await f.close()}
})
