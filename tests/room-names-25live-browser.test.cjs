const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {chromium}=require('playwright'),{fixture}=require('./helpers/scheduling-ui-fixture.cjs')
async function launch(){return chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})})}
async function shot(page,name){if(!process.env.OUTCLASS_SCHEDULING_SCREENSHOTS)return;fs.mkdirSync(process.env.OUTCLASS_SCHEDULING_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.OUTCLASS_SCHEDULING_SCREENSHOTS,name+'.png'),fullPage:true,animations:'disabled'})}

test('browser: 25Live notice, post-save reminder, inline rename (Enter/Escape/blank/blur) and Booked on 25Live tracking in isolated Demo',async()=>{
 const f=await fixture({fresh:true});let browser
 try{
  browser=await launch();const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/*',route=>route.request().url().startsWith(f.url)?route.continue():route.abort())
  await page.goto(`${f.url}/?roundId=${f.scope.roundId}&schedule=rooms`)
  const note=page.getByRole('note',{name:'Room reservations'});await note.waitFor()
  assert.match(await note.innerText(),/only saves it in OutClass\. It does not reserve the room with UVA/)
  const link=note.getByRole('link',{name:/Book on 25Live/})
  assert.equal(await link.getAttribute('href'),'https://25live.collegenet.com/pro/virginia#!/home/dash');assert.equal(await link.getAttribute('target'),'_blank')

  await page.getByRole('button',{name:'Add interview times',exact:true}).click()
  const dialog=page.getByRole('dialog');await dialog.getByRole('textbox',{name:'Room name',exact:true}).fill('Synthetic Hall A')
  await dialog.getByRole('button',{name:'Save times & continue',exact:true}).click()
  const reminder=page.getByRole('status').filter({hasText:'Saved in OutClass. Don’t forget to book this room on 25Live.'});await reminder.waitFor()
  assert.equal(await reminder.getByRole('link',{name:/Book on 25Live/}).getAttribute('href'),'https://25live.collegenet.com/pro/virginia#!/home/dash')
  // Saving lands on Confirm interviewers; the Heads up notice stays visible there too.
  assert.ok(await note.isVisible(),'notice persists on Confirm interviewers')

  const roomId=f.state().interviewRooms.find(r=>r.name==='Synthetic Hall A').id,room=()=>f.state().interviewRooms.find(r=>r.id===roomId)
  await page.getByRole('navigation',{name:'Scheduling workflow'}).getByRole('button',{name:/Set interview times/}).click()
  await page.getByText('Not booked on 25Live yet',{exact:true}).waitFor()
  await shot(page,'room-25live-notice-desktop')

  // Click the name, type, Enter saves (trimmed).
  await page.getByRole('button',{name:'Synthetic Hall A (rename)',exact:true}).click()
  const input=page.getByRole('textbox',{name:'Room name',exact:true});await input.fill('  Rice Hall 340  ');await input.press('Enter')
  await page.getByRole('button',{name:'Rice Hall 340 (rename)',exact:true}).waitFor()
  assert.equal(room().name,'Rice Hall 340')
  // Escape cancels.
  await page.getByRole('button',{name:'Edit name of Rice Hall 340',exact:true}).click();await input.fill('Discarded');await input.press('Escape')
  await page.getByRole('button',{name:'Rice Hall 340 (rename)',exact:true}).waitFor();assert.equal(room().name,'Rice Hall 340')
  // Blank reverts.
  await page.getByRole('button',{name:'Rice Hall 340 (rename)',exact:true}).click();await input.fill('   ');await input.press('Enter')
  await page.getByRole('button',{name:'Rice Hall 340 (rename)',exact:true}).waitFor();assert.equal(room().name,'Rice Hall 340')
  // Blur saves; length is capped.
  await page.getByRole('button',{name:'Rice Hall 340 (rename)',exact:true}).click();assert.equal(await input.getAttribute('maxlength'),'60')
  await input.fill('Clark Library Study Room B');await page.getByRole('heading',{name:'Interview times',exact:true}).click()
  await page.getByRole('button',{name:'Clark Library Study Room B (rename)',exact:true}).waitFor()
  assert.equal(room().name,'Clark Library Study Room B')
  assert.equal(room().location,'Synthetic Hall A','renaming never changes the location')

  // Duplicate names are allowed; a virtual room gets the same 25Live tracking.
  f.asLeader();const first=room().slots[0],day=new Date(first.startTime).toLocaleDateString('en-CA',{timeZone:'America/New_York'}),hm=v=>new Date(v).toLocaleTimeString('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit'})
  await f.api.createInterviewRoom({clubId:f.scope.clubId,roundId:f.scope.roundId,name:'Overflow room',location:'https://zoom.us/j/123456',kind:'VIRTUAL',timezone:'America/New_York',dates:[day],start:hm(first.startTime),end:hm(first.endTime),duration:room().duration,buffer:0,capacity:1,interviewersNeeded:1,panelMemberIds:[]})
  await page.reload();await page.getByRole('button',{name:'Overflow room (rename)',exact:true}).click()
  await input.fill('clark library study room b');await input.press('Enter')
  await page.getByRole('button',{name:'clark library study room b (rename)',exact:true}).waitFor()
  const overflowId=f.state().interviewRooms.find(r=>r.location==='https://zoom.us/j/123456').id
  assert.equal(f.state().interviewRooms.find(r=>r.id===overflowId).name,'clark library study room b')
  await page.locator('#room-25live-'+overflowId).waitFor()
  // The pencil is a pointer shortcut; keyboard users get one tab stop per name.
  assert.equal(await page.getByRole('button',{name:'Edit name of clark library study room b',exact:true}).getAttribute('tabindex'),'-1')
  // Rename from the Manage room sheet heading.
  await page.locator('article',{has:page.getByRole('button',{name:'clark library study room b (rename)',exact:true})}).getByRole('button',{name:'Manage room',exact:true}).click()
  const sheet=page.getByRole('dialog');await sheet.getByRole('button',{name:'clark library study room b (rename)',exact:true}).click()
  await sheet.getByRole('textbox',{name:'Room name',exact:true}).fill('Zoom backup');await sheet.getByRole('textbox',{name:'Room name',exact:true}).press('Enter')
  await sheet.getByRole('button',{name:'Zoom backup (rename)',exact:true}).waitFor();assert.equal(f.state().interviewRooms.find(r=>r.id===overflowId).name,'Zoom backup')
  await page.keyboard.press('Escape');await sheet.waitFor({state:'hidden'})
  await page.getByRole('button',{name:'Zoom backup (rename)',exact:true}).waitFor()
  // Optimistic: while the save is held, the box, check mark and amber tag already show the new state.
  const box=page.locator('#room-25live-'+roomId),tag=page.locator('article',{has:box}).getByText('Not booked on 25Live yet',{exact:true}),isToggle=route=>route.request().postDataJSON()?.name==='setInterviewRoomExternallyBooked'
  let release;const held=new Promise(r=>release=r)
  await page.route('**/action',async route=>{if(isToggle(route))await held;await route.continue()})
  await box.click()
  assert.equal(await box.isChecked(),true,'ticks before the save returns');assert.equal(await tag.count(),0,'amber tag clears immediately')
  assert.equal(await page.locator('label[for="room-25live-'+roomId+'"] svg').count(),1,'check mark shows immediately')
  assert.ok(await box.isDisabled(),'locked while saving, so a second click cannot undo it');assert.ok(!room().externallyBookedAt,'save still held')
  release();await page.waitForFunction(id=>!document.getElementById(id)?.disabled,'room-25live-'+roomId);await page.unroute('**/action')
  assert.ok(room().externallyBookedAt)
  assert.equal(await page.locator('label[for="room-25live-'+roomId+'"] svg').count(),1,'checked rooms show the check mark')
  // A failed save restores the previous state and says so.
  await page.route('**/action',route=>isToggle(route)?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Could not update 25Live status.'})}):route.continue())
  await box.click()
  await page.getByRole('alert').filter({hasText:'Could not update 25Live status.'}).waitFor()
  assert.equal(await box.isChecked(),true,'failed untick restores the tick');assert.equal(await tag.count(),0);assert.ok(room().externallyBookedAt)
  await page.unroute('**/action')
  await shot(page,'room-25live-booked-desktop')
  await page.setViewportSize({width:390,height:844});await shot(page,'room-25live-mobile')
  assert.deepEqual(errors,[]);assert.equal(f.liveCalls(),0)
 }finally{await browser?.close();await f.close()}
})
