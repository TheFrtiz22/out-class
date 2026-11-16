const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{fixture}=require('./helpers/interview-entry-browser.cjs');
test('browser: My interviews groups Up next by day; the day buttons filter, survive refresh, background reads and exact-room return; mobile works',async()=>{
 const f=await fixture();let browser;
 try{
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===f.base?r.continue():r.abort());
  await page.clock.setFixedTime(new Date('2026-10-20T12:00:00Z'));const url=f.base+'/club/'+f.clubId+'/workspace?section=recruitment&tool=interviews';await page.goto(url);
  const first=page.getByRole('region',{name:'Tuesday, October 20, 2026',exact:true}),second=page.getByRole('region',{name:'Wednesday, October 21, 2026',exact:true}),days=page.getByRole('group',{name:'Show one day',exact:true}),entry=page.getByRole('link',{name:/Enter interview|Resume interview/});
  const today=days.getByRole('button',{name:'Today',exact:true}),all=days.getByRole('button',{name:'All days',exact:true});
  // Both days are listed without opening anything; each says its span and how many interviews, with no time zone repeated per row.
  await first.waitFor();await second.waitFor();assert.match(await first.getByRole('heading').textContent(),/^Today\d{1,2}:\d{2}( [AP]M)?–\d{1,2}:\d{2} [AP]M · 1 interview$/);assert.match(await second.getByRole('heading').textContent(),/^Wednesday, October 21, 2026.+ · 1 interview$/);
  assert.equal(await entry.count(),2);assert.equal(await page.getByText(/E[DS]T/).count(),0);assert.equal(await page.getByText('Times are in Eastern Time.',{exact:true}).count(),1);assert.equal(new URL(page.url()).searchParams.has('interview'),false);
  // One day: the other day leaves the list, and the choice is in the URL.
  await today.click();assert.equal(await today.getAttribute('aria-pressed'),'true');assert.equal(await second.count(),0);assert.equal(await entry.count(),1);assert.equal(new URL(page.url()).searchParams.get('interviewDate'),'2026-10-20');
  const reads=await page.evaluate(()=>window.fixtureReads||0);await page.evaluate(()=>dispatchEvent(new Event('outclass:demo-change')));await page.waitForFunction(before=>window.fixtureReads>before,reads);assert.equal(await second.count(),0);assert.equal(await today.getAttribute('aria-pressed'),'true');
  await page.reload();await first.waitFor();assert.equal(await second.count(),0);assert.equal(await today.getAttribute('aria-pressed'),'true');
  await entry.click();await page.getByRole('region',{name:'Exact room fixture'}).waitFor();await page.getByRole('button',{name:'Interviews',exact:true}).click();await first.waitFor();assert.equal(await second.count(),0,'the day filter survives a trip into the room');
  // Keyboard: the day buttons are one group; All days brings everything back.
  await all.focus();await page.keyboard.press('Enter');await second.waitFor();assert.equal(await all.getAttribute('aria-pressed'),'true');assert.equal(new URL(page.url()).searchParams.has('interviewDate'),false);assert.equal(await entry.count(),2);
  for(const [name,size]of [['desktop',{width:1440,height:950}],['mobile',{width:390,height:844}]]){await page.setViewportSize(size);await first.waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(process.env.OUTCLASS_DATE_SCREENSHOTS){fs.mkdirSync(process.env.OUTCLASS_DATE_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.OUTCLASS_DATE_SCREENSHOTS,'dates-'+name+'.png'),fullPage:true});}}
  // The day before, nothing is "Today" and both days are still listed.
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));await page.goto(url);await first.waitFor();await second.waitFor();assert.equal(await today.count(),0);assert.match(await first.getByRole('heading').textContent(),/^Tuesday, October 20, 2026/);assert.deepEqual(errors,[]);await context.close();
 }finally{await browser?.close();await new Promise(r=>f.server.close(r));}
});
