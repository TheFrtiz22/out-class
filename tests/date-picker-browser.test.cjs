const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const {chromium}=require('playwright'),{fixture}=require('./helpers/interview-entry-browser.cjs')
test('browser: date picker keyboard flow, focus return, reduced motion and 390px layout',async()=>{
  const f=await fixture();let browser
  try{
    browser=await chromium.launch({headless:true,...(fs.existsSync(chromium.executablePath())?{}:{channel:'chrome'})})
    const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.route('**/*',r=>new URL(r.request().url()).origin===f.base?r.continue():r.abort())
    await page.clock.setFixedTime(new Date('2026-10-20T12:00:00Z'));await page.goto(f.base+'/club/'+f.clubId+'/workspace?section=recruitment&tool=interviews')
    const trigger=page.getByRole('button',{name:'Filter assigned interview date',exact:true});await trigger.waitFor()
    const active=()=>page.evaluate(()=>document.activeElement?.getAttribute('data-day')||document.activeElement?.getAttribute('aria-label'))
    const grid=page.getByRole('grid'),month=()=>page.locator('[role=dialog] [aria-live=polite]').textContent()

    await trigger.focus();await page.keyboard.press('Enter');await grid.waitFor()
    assert.equal(await active(),'2026-10-20','opens on today when empty');assert.equal(await page.locator('[data-day="2026-10-20"]').getAttribute('aria-current'),'date')
    for(const [key,day]of [['ArrowRight','2026-10-21'],['ArrowDown','2026-10-28'],['Home','2026-10-25'],['End','2026-10-31'],['ArrowLeft','2026-10-30'],['ArrowUp','2026-10-23'],['PageDown','2026-11-23'],['PageUp','2026-10-23']]){await page.keyboard.press(key);assert.equal(await active(),day,key)}
    await page.keyboard.press('PageDown');assert.equal(await month(),'November 2026');await page.keyboard.press('PageUp');assert.equal(await month(),'October 2026')
    await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter')
    await grid.waitFor({state:'detached'});assert.equal(await trigger.getAttribute('data-value'),'2026-10-21');assert.equal(await active(),'Filter assigned interview date','focus returns to the trigger')
    assert.equal(await page.getByRole('button',{name:/^Wednesday, October 21, 2026/}).count(),1);assert.equal(await page.getByRole('button',{name:/^Tuesday, October 20, 2026/}).count(),0)

    await page.keyboard.press('Space');await grid.waitFor();assert.equal(await active(),'2026-10-21','reopens on the selected date');assert.equal(await page.locator('[data-day="2026-10-21"]').getAttribute('aria-selected'),'true')
    const box=await page.locator('[role=dialog]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390,'popover fits at 390px');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    assert.ok(await page.locator('[role=dialog]').evaluate(el=>parseFloat(getComputedStyle(el).animationDuration)<=0.001),'reduced motion collapses the popover animation')
    await page.getByRole('button',{name:'Next month',exact:true}).click();assert.equal(await month(),'November 2026');await page.getByRole('button',{name:'Previous month',exact:true}).click();assert.equal(await month(),'October 2026')
    await page.locator('[data-day="2026-10-21"]').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');await grid.waitFor({state:'detached'})
    assert.equal(await active(),'Filter assigned interview date');assert.equal(await trigger.getAttribute('data-value'),'2026-10-21','Escape keeps the value')
    assert.deepEqual(errors,[]);await context.close()
  }finally{await browser?.close();await new Promise(r=>f.server.close(r))}
})
