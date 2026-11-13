// Real Chromium: Submitted reviews rows show the server-provided round score compactly, with
// its label for screen readers, and nothing when the server withheld it; no overflow on phones.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{fixture}=require('./helpers/applicant-review-browser.cjs');
test('browser: submitted review rows show the round score only when the server sent one',async()=>{
 const f=await fixture();let browser;
 try{
  browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})});const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===f.base?r.continue():r.abort());
  await page.goto(f.base+'/club/club/workspace?section=recruitment&tool=reviews');
  const beta=page.getByRole('button',{name:'Sample Beta · Round B · Average interview score 7.3 / 10 · 2 scored evaluations · Open review',exact:true});await beta.waitFor();
  assert.match(await beta.innerText(),/Round B · Open review\s*7\.3 \/ 10 · 2 scored evaluations/);
  // Withheld by the server (null): the row has no score, no "0" and no "Not scored".
  const alpha=page.getByRole('button',{name:'Sample Alpha · Round A · Open review',exact:true});await alpha.waitFor();
  assert.doesNotMatch(await alpha.innerText(),/\/ 10|Not scored|scored evaluation|\b0\b/);
  for(const width of [390,320]){await page.setViewportSize({width,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no horizontal scroll at ${width}px`);
   const [row,score]=await Promise.all([beta.boundingBox(),beta.locator('[data-review-score]').boundingBox()]);assert.ok(score&&score.x+score.width<=row.x+row.width+0.5,`score stays inside its row at ${width}px`);}
  await beta.focus();assert.equal(await page.evaluate(()=>document.activeElement?.id),'submitted-review-review-b');
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(r=>f.server.close(r));}
});
