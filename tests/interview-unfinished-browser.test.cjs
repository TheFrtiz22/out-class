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
  await page.getByRole('button',{name:/October 20, 2026/}).first().waitFor();
  assert.equal(await page.getByRole('heading',{name:/Unfinished interviews/}).count(),0);
  assert.ok(await page.getByText(/Scheduled for .+ · Starts in/).first().count(),'timing context before start');
  assert.ok(await page.getByRole('link',{name:/Enter interview|Resume interview/}).count()>=1,'entry offered before the scheduled start');
  // Days later: unfinished work is listed at the top with an entry action and "Scheduled time has ended".
  await page.clock.setFixedTime(new Date('2026-10-25T15:00:00Z'));await page.reload();
  const section=page.getByRole('region',{name:/Unfinished interviews/});await section.waitFor();
  const items=section.getByRole('listitem');assert.ok(await items.count()>=1);
  assert.ok(await section.getByText(/Scheduled time has ended/).first().count());
  const link=section.getByRole('link',{name:/Enter interview|Resume interview/}).first();await link.waitFor();
  assert.equal(await section.getByRole('link',{name:'View review'}).count(),0,'submitted reviews are not listed as unfinished');
  await link.click();await page.waitForURL(/interview=1/);const q=new URL(page.url()).searchParams;
  assert.ok(q.get('applicationId')&&q.get('roundId'),'opens the exact candidate after the scheduled date');
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();f.server.closeAllConnections?.();await new Promise(r=>f.server.close(r));}
});
