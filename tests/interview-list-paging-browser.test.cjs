const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{fixture}=require('./helpers/applicant-review-browser.cjs');
// 2 named fixture rows + 118 synthetic rows = 120, so three server pages of 50, 50 and 20.
test('browser: Load more pages leadership lists by keyboard, moves focus to the first new item, announces the count and retries errors',{timeout:180000},async()=>{
 const f=await fixture();let browser;
 try{
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===f.base?r.continue():r.abort());
  for(const tool of ['reviews','resumes']){
   const action=tool==='reviews'?'Open review':'Review résumé',item=n=>page.getByRole('button',{name:new RegExp(`^Sample Applicant ${n} · Round [AB] · ${action}$`)});
   await page.goto(`${f.base}/club/club/workspace?section=recruitment&tool=${tool}&fixtureRows=118`);
   await page.getByText('Showing 50 of 120',{exact:true}).waitFor();
   assert.equal(await page.getByText(/limited to 100|latest 100/i).count(),0,'old 100-item limit text removed');
   const more=page.getByRole('button',{name:'Load more',exact:true});
   await more.focus();await page.keyboard.press('Enter');
   await page.getByText('Showing 100 of 120',{exact:true}).waitFor();
   // Row 51 is synthetic applicant 49 (two named rows come first).
   await page.waitForFunction(id=>document.activeElement===document.getElementById(id),tool==='reviews'?'submitted-review-review-49':'moderation-document-doc-app-49');
   assert.ok(await item(49).evaluate(el=>el===document.activeElement),'focus moves to the first new item');
   assert.equal(await page.getByRole('status').filter({hasText:'50 more loaded. Showing 100 of 120.'}).count(),1,'polite announcement');
   assert.equal(await page.locator('[aria-live="polite"]').filter({hasText:'50 more loaded'}).count(),1);
   // A failed page keeps loaded rows and offers Retry on the same control.
   await page.evaluate(()=>{window.fixture.failMore=true});
   await more.focus();await page.keyboard.press('Enter');
   await page.getByRole('alert').filter({hasText:`Couldn’t load more ${tool==='reviews'?'reviews':'documents'}.`}).waitFor();
   assert.equal(await page.getByText('Showing 100 of 120',{exact:true}).count(),1);
   const retry=page.getByRole('button',{name:'Retry',exact:true});assert.ok(await retry.evaluate(el=>el===document.activeElement),'focus stays on the Load more / Retry control');
   await page.keyboard.press('Enter');
   await page.getByText('Showing 120 of 120',{exact:true}).waitFor();
   assert.ok(await item(99).evaluate(el=>el===document.activeElement));
   assert.equal(await page.getByRole('button',{name:/Load more|Retry/}).count(),0,'no Load more after the last page');
   assert.equal(await page.getByRole('button',{name:new RegExp(action)}).count(),120);
   // Changing a filter resets paging and asks the server for the first page again.
   const before=await page.evaluate(()=>window.fixture.pages.length);
   await page.evaluate(()=>history.pushState(null,'',location.pathname+location.search+'&roundId=round-b'));
   await page.getByText('Showing 50 of 60',{exact:true}).waitFor();
   assert.equal(await page.evaluate(n=>window.fixture.pages.slice(n).every(c=>c===null),before),true,'filter change restarts from the first page');
   assert.equal(await page.evaluate(()=>window.fixture.requests.at(-1).roundId),'round-b','filter is applied by the server read');
  }
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll on mobile');
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(r=>f.server.close(r));}
});
