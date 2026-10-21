const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {expect} = require('playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const {startFixture} = require('./fixture.cjs');
const output = path.resolve('test-results/accessibility');
let browser, fixture;
before(async()=>{fs.mkdirSync(output,{recursive:true});fixture=await startFixture();browser=await chromium.launch();});
after(async()=>{await browser?.close();await fixture?.close();});
async function pageFor(url,width=1280,motion='reduce') {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:motion});
  const page=await context.newPage();
  page.setDefaultTimeout(12000);
  // Fixtures have no network dependencies. Public checks are local and cannot
  // send auth/mail/database writes: the runner supplies only localhost services.
  await page.goto(url,{waitUntil:'networkidle',timeout:120000});
  await page.evaluate(()=>document.fonts.ready);
  return {page,close:()=>context.close()};
}
async function scan(page,name){
  // Scan the completed interaction state, after finite CSS transitions settle.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{}))));
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  fs.writeFileSync(path.join(output,`${name}.json`),JSON.stringify({evaluatedAt:new Date().toISOString(),browser:browser.version(),url:page.url(),violations:result.violations,incomplete:result.incomplete,passes:result.passes.map(p=>p.id)},null,2));
  assert.deepEqual(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),[],`axe violations in ${name}`);
}
async function reflow(page){await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1,{},{timeout:3000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'page must reflow without horizontal overflow');}
async function isFocused(locator){await expect(locator).toBeFocused();}

for(const key of ['availability','booking','application','primitives','events','leader','admin','voting']){
  test(`axe: actual ${key} UI with isolated data, desktop and 320px`,async()=>{
    const f=await pageFor(`${fixture.url}/?case=${key}`);try{
      await scan(f.page,`${key}-desktop`);await f.page.setViewportSize({width:320,height:800});await reflow(f.page);await scan(f.page,`${key}-320`);
    }finally{await f.close();}
  });
}
test('availability: row/column structure, roving focus, toggle, range, touch and drag cancellation',async()=>{
  const f=await pageFor(fixture.url);const p=f.page;try{
    const grid=p.getByRole('grid');await expect(grid).toHaveAttribute('aria-colcount','8');
    assert.equal(await grid.getByRole('row').count(),53);assert.equal(await grid.getByRole('columnheader').count(),8);
    const first=p.locator('[data-av-cell="0:32"]');await first.focus();await p.keyboard.press('Space');await expect(first).toHaveAttribute('aria-selected','true');
    await p.keyboard.press('Shift+ArrowDown');const next=p.locator('[data-av-cell="0:33"]');await isFocused(next);await expect(next).toHaveAttribute('aria-selected','true');
    await p.keyboard.press('End');await isFocused(p.locator('[data-av-cell="0:83"]'));await p.keyboard.press('Home');await isFocused(first);
    await p.keyboard.press('ArrowRight');await p.setViewportSize({width:320,height:800});await isFocused(p.locator('[data-av-cell="1:32"]'));
    await expect(grid).toHaveAttribute('aria-colcount','2');assert.equal(await grid.getByRole('columnheader').count(),2);
    await p.keyboard.press('ArrowRight');await isFocused(p.locator('[data-av-cell="2:32"]'));
    await p.keyboard.press('Enter');await expect(p.locator('[data-av-cell="2:32"]')).toHaveAttribute('aria-selected','true');
    await p.locator('[data-av-cell="2:33"]').click();await expect(p.locator('[data-av-cell="2:33"]')).toHaveAttribute('aria-selected','true');
    const cell=p.locator('[data-av-cell="2:34"]');const box=await cell.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.keyboard.press('Escape');await p.mouse.up();await expect(cell).toHaveAttribute('aria-selected','false');
    await scan(p,'availability-selected-mobile');
  }finally{await f.close();}
});
test('dialogs and select: keyboard entry, containment, Escape, focus restoration and state',async()=>{
  const f=await pageFor(`${fixture.url}/?case=primitives`);const p=f.page;try{
    const trigger=p.getByRole('button',{name:'Open test dialog'});await trigger.focus();await p.keyboard.press('Enter');
    const dialog=p.getByRole('dialog',{name:'Review your work'});await dialog.waitFor();assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);
    for(let i=0;i<8;i++){await p.keyboard.press('Tab');assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);}
    await p.keyboard.press('Shift+Tab');assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);await scan(p,'dialog-open');
    await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await isFocused(trigger);
    const select=p.getByRole('combobox',{name:'Club category'});await select.focus();await p.keyboard.press('ArrowDown');await p.getByRole('option',{name:'Service'}).waitFor();await p.keyboard.press('End');await p.waitForFunction(()=>document.activeElement?.textContent==='Service');await p.keyboard.press('Enter');await select.getByText('Service',{exact:true}).waitFor();assert.match(await select.innerText(),/Service/);await isFocused(select);
  }finally{await f.close();}
});
test('application: associated errors, first invalid field, confirmation and upload feedback',async()=>{
  const f=await pageFor(`${fixture.url}/?case=application`);const p=f.page;try{
    await p.getByRole('button',{name:'Review & submit'}).click();const essay=p.getByLabel('Why would you like to join?',{exact:true});await isFocused(essay);await expect(essay).toHaveAttribute('aria-invalid','true');
    assert.match(await p.getByRole('alert').innerText(),/Why would you like to join/);await scan(p,'application-errors');
    await essay.fill('I would like to help my community.');await p.getByLabel('Which team interests you?',{exact:true}).selectOption('Arts');
    await p.getByRole('button',{name:'Review & submit'}).click();await p.getByRole('dialog').waitFor();await scan(p,'application-confirmation');await p.keyboard.press('Escape');
    await p.locator('input[type=file]').setInputFiles({name:'resume.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 fixture')});await p.getByRole('status').filter({hasText:'Document uploaded'}).waitFor();
  }finally{await f.close();}
});
test('booking: reserve, reschedule, cancel, selected date/time and focus after action removal',async()=>{
  const f=await pageFor(`${fixture.url}/?case=booking`);const p=f.page;try{
    const time=p.getByRole('button').filter({hasText:'10:00 AM'});await time.click();await expect(time).toHaveAttribute('aria-pressed','true');await scan(p,'booking-choice');
    await p.getByRole('button',{name:'Confirm interview',exact:true}).click();const notice=p.getByRole('status').filter({hasText:'Interview confirmed for'});await notice.waitFor();await isFocused(notice);
    await p.getByRole('button').filter({hasText:'11:00 AM'}).click();await p.getByRole('button',{name:'Confirm new time'}).click();await p.getByRole('status').filter({hasText:'Interview rescheduled for'}).waitFor();
    await p.getByRole('button',{name:'Cancel booking',exact:true}).click();await p.getByRole('button',{name:'Yes, cancel'}).click();const cancelled=p.getByRole('status').filter({hasText:'Booking cancelled.'});await cancelled.waitFor();await isFocused(cancelled);await scan(p,'booking-cancelled');
  }finally{await f.close();}
});
test('events: corkboard/list, filter, empty state and dialog focus restoration',async()=>{
  const f=await pageFor(`${fixture.url}/?case=events`);const p=f.page;try{
    const flyer=p.getByRole('button',{name:/^View event: .*Community night/});await flyer.click();await p.getByRole('dialog',{name:'Community night'}).waitFor();await scan(p,'event-detail');await p.keyboard.press('Escape');await isFocused(flyer);
    await p.getByRole('button',{name:'List View',exact:true}).click();await scan(p,'events-list');await p.getByRole('textbox',{name:'Search events'}).fill('no match');await p.getByRole('heading',{name:'No search results.'}).waitFor();await scan(p,'events-empty');
  }finally{await f.close();}
});
test('leader: event creation, labelled date controls and equivalent flyer information',async()=>{
  const f=await pageFor(`${fixture.url}/?case=leader`);const p=f.page;try{
    await p.getByRole('button',{name:'+ Create Corkboard Event',exact:true}).click();await p.getByLabel('Event name',{exact:true}).fill('Community night');
    assert.equal(await p.getByLabel('Description',{exact:true}).getAttribute('aria-describedby'),'event-description-help');await scan(p,'leader-event-editor');await p.setViewportSize({width:320,height:800});await reflow(p);await scan(p,'leader-event-editor-320');
  }finally{await f.close();}
});
test('admin: named table, inspection dialog and keyboard dismissal using fictional records',async()=>{
  const f=await pageFor(`${fixture.url}/?case=admin`);const p=f.page;try{
    await p.getByLabel('Investigation / support reason').fill('Accessibility fixture inspection');await p.getByRole('button',{name:'Inspect',exact:true}).click();await p.getByRole('dialog').waitFor();await scan(p,'admin-inspection');await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'hidden'});
  }finally{await f.close();}
});
test('voting: joining, persistent candidate announcement and ballot result',async()=>{
  const f=await pageFor(`${fixture.url}/?case=voting`);const p=f.page;try{
    await p.getByRole('button',{name:'Join session',exact:true}).click();await p.getByRole('button',{name:'Pass',exact:true}).waitFor();assert.match(await p.getByRole('status').first().innerText(),/Candidate 1 of 1/);await scan(p,'voting-open');
    await p.getByRole('button',{name:'Pass',exact:true}).click();await p.getByRole('status').filter({hasText:'Your ballot: Pass'}).waitFor();await scan(p,'voting-recorded');
  }finally{await f.close();}
});
const publicRoutes=['/','/?audience=leader','/about','/uva','/request-school','/login','/signup','/forgot-password','/reset-password','/platform/login'];
for(const [index,route] of publicRoutes.entries()){
  test(`public route: ${route}, semantics, axe, 320px and text spacing`,async()=>{
    assert.ok(process.env.OUTCLASS_A11Y_URL,'Use pnpm test:a11y to start the isolated local app');
    const f=await pageFor(process.env.OUTCLASS_A11Y_URL+route);const p=f.page;try{
      assert.equal(await p.locator('main').count(),1);assert.ok(await p.title());await expect(p.locator('html')).toHaveAttribute('lang','en');await scan(p,`public-${index}-desktop`);
      if(index===0){await p.screenshot({path:path.join(output,'home-after.png'),fullPage:true});assert.equal(await p.locator('.oc-demo-observation button').count(),0);await p.getByRole('button',{name:'Next feature'}).click();await scan(p,'carousel-manual');}
      if(route==='/uva'){await p.locator('#faq summary, #faq button').first().click();await scan(p,'faq-expanded');}
      await p.setViewportSize({width:320,height:800});await reflow(p);await scan(p,`public-${index}-320`);
      await p.addStyleTag({content:'*{letter-spacing:.12em!important;word-spacing:.16em!important;line-height:1.5!important}p{margin-bottom:2em!important}'});await reflow(p);
    }finally{await f.close();}
  });
}
test('homepage: keyboard skip link, mobile navigation Escape and reduced motion',async()=>{
  const f=await pageFor(process.env.OUTCLASS_A11Y_URL,390);const p=f.page;try{
    await p.keyboard.press('Tab');const skip=p.getByRole('link',{name:'Skip to product overview',exact:true});await isFocused(skip);await p.keyboard.press('Enter');await p.waitForFunction(()=>document.activeElement.id==='about');assert.equal(await p.evaluate(()=>document.activeElement.id),'about');
    const menu=p.getByRole('button',{name:/navigation menu/});await menu.focus();await p.keyboard.press('Enter');await expect(menu).toHaveAttribute('aria-expanded','true');await p.keyboard.press('Escape');await expect(menu).toHaveAttribute('aria-expanded','false');await isFocused(menu);
    assert.equal(await p.locator('[data-demo-playing="true"]').count(),0);assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running' && a.effect.getTiming().duration>1).length),0);
  }finally{await f.close();}
});
