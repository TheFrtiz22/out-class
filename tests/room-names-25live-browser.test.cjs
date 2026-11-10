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

  const roomId=f.state().interviewRooms.find(r=>r.name==='Synthetic Hall A').id,room=()=>f.state().interviewRooms.find(r=>r.id===roomId)
  await page.getByRole('navigation',{name:'Scheduling workflow'}).getByRole('button',{name:/Set interview times/}).click()
  await page.getByText('Not booked on 25Live yet',{exact:true}).waitFor()
  await shot(page,'room-25live-notice-desktop')

  // Click the name, type, Enter saves (trimmed).
  await page.getByRole('button',{name:'Rename room Synthetic Hall A',exact:true}).click()
  const input=page.getByRole('textbox',{name:'Room name',exact:true});await input.fill('  Rice Hall 340  ');await input.press('Enter')
  await page.getByRole('button',{name:'Rename room Rice Hall 340',exact:true}).waitFor()
  assert.equal(room().name,'Rice Hall 340')
  // Escape cancels.
  await page.getByRole('button',{name:'Edit name of Rice Hall 340',exact:true}).click();await input.fill('Discarded');await input.press('Escape')
  await page.getByRole('button',{name:'Rename room Rice Hall 340',exact:true}).waitFor();assert.equal(room().name,'Rice Hall 340')
  // Blank reverts.
  await page.getByRole('button',{name:'Rename room Rice Hall 340',exact:true}).click();await input.fill('   ');await input.press('Enter')
  await page.getByRole('button',{name:'Rename room Rice Hall 340',exact:true}).waitFor();assert.equal(room().name,'Rice Hall 340')
  // Blur saves; length is capped.
  await page.getByRole('button',{name:'Rename room Rice Hall 340',exact:true}).click();assert.equal(await input.getAttribute('maxlength'),'60')
  await input.fill('Clark Library Study Room B');await page.getByRole('heading',{name:'Interview times',exact:true}).click()
  await page.getByRole('button',{name:'Rename room Clark Library Study Room B',exact:true}).waitFor()
  assert.equal(room().name,'Clark Library Study Room B')
  assert.equal(room().location,'Synthetic Hall A','renaming never changes the location')

  await page.getByRole('checkbox',{name:'Booked on 25Live'}).click()
  await page.getByText('Not booked on 25Live yet',{exact:true}).waitFor({state:'detached'})
  assert.ok(room().externallyBookedAt)
  await shot(page,'room-25live-booked-desktop')
  await page.setViewportSize({width:390,height:844});await shot(page,'room-25live-mobile')
  assert.deepEqual(errors,[]);assert.equal(f.liveCalls(),0)
 }finally{await browser?.close();await f.close()}
})
