const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{fixture}=require('./helpers/interview-entry-browser.cjs');
test('browser: unfinished interviews stay discoverable after their date; timing is context, not a gate (controlled clock)',async()=>{
 const f=await fixture();let browser;
 try{
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===f.base?r.continue():r.abort());
  const url=f.base+'/club/'+f.clubId+'/workspace?section=recruitment&tool=interviews';
  // Before the scheduled day: no unfinished section; entries say when they start and can still be entered.
  await page.clock.setFixedTime(new Date('2026-10-20T12:00:00Z'));await page.goto(url);
  await page.getByRole('region',{name:/October 20, 2026/}).first().waitFor();
  assert.equal(await page.getByRole('heading',{name:/Needs notes/}).count(),0);
  assert.ok(await page.getByText(/\d{1,2}:\d{2} [AP]M · In \d+ (minute|hour|day)/).first().count(),'timing context before start');
  assert.ok(await page.getByRole('link',{name:/Enter interview|Resume interview/}).count()>=1,'entry offered before the scheduled start');
  // Days later: unfinished work is listed once, under Needs notes, with a Finish notes action and "Ended".
  await page.clock.setFixedTime(new Date('2026-10-25T15:00:00Z'));await page.reload();
  const section=page.getByRole('region',{name:/Needs notes/});await section.waitFor();
  const items=section.getByRole('listitem');assert.ok(await items.count()>=1);
  assert.ok(await section.getByText(/· Ended/).first().count());
  const link=section.getByRole('link',{name:/^Finish notes/}).first();await link.waitFor();
  assert.equal(await page.getByRole('link',{name:/^Finish notes/}).count(),await section.getByRole('link',{name:/^Finish notes/}).count(),'an unfinished interview is not repeated under its day');
  assert.equal(await section.getByRole('link',{name:'View review'}).count(),0,'submitted reviews are not listed as unfinished');
  await link.click();await page.waitForURL(/\/interview\?/,{waitUntil:'commit'});const q=new URL(page.url()).searchParams;
  assert.ok(q.get('applicationId')&&q.get('roundId'),'opens the exact candidate after the scheduled date');
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();f.server.closeAllConnections?.();await new Promise(r=>f.server.close(r));}
});
