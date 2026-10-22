const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const {chromium,webkit}=require('playwright'),{expect}=require('playwright/test'),AxeBuilder=require('@axe-core/playwright').default
const {startDockFixture}=require('./helpers/expanding-dock-browser.cjs')
const engine=process.env.OUTCLASS_NAV_BROWSER==='webkit'?webkit:chromium
const screenshots=process.env.OUTCLASS_SWITCHER_SCREENSHOTS

test('central workspace selector: verified eligibility, revocation, route hierarchy, guards, keyboard and responsive accessibility',async()=>{
 const fixture=await startDockFixture();let browser
 try{
  browser=await engine.launch({headless:true,...(engine===chromium&&!fs.existsSync(chromium.executablePath())?{channel:'chrome'}:{})})
  const context=await browser.newContext({viewport:{width:1600,height:1000},...(process.env.OUTCLASS_SWITCHER_VIDEO?{recordVideo:{dir:process.env.OUTCLASS_SWITCHER_VIDEO,size:{width:1600,height:1000}}}:{})})
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message))
  let eligible=false,fail=false,release,delay=false,calls=0
  await page.route('**/api/platform/eligibility',async route=>{calls++;if(delay)await new Promise(resolve=>release=resolve);await route.fulfill({status:fail?500:200,contentType:'application/json',body:JSON.stringify({eligible})})})
  const go=(role,path='/')=>page.goto(`${fixture.base}${path}${path.includes('?')?'&':'?'}role=${role}`,{waitUntil:'networkidle'})
  const header=page.locator('header'),workspaces=header.getByRole('navigation',{name:'Workspaces',exact:true}),dock=page.locator('aside.oc-expanding-dock')
  const choice=name=>workspaces.getByRole('link',{name,exact:true})
  const shot=async name=>{if(screenshots){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})))});fs.mkdirSync(screenshots,{recursive:true});await page.screenshot({path:`${screenshots}/${name}.png`})}}
  async function noRestricted(){assert.equal(await page.locator('a[href^="/platform"]').count(),0);assert.equal(await page.getByRole('link',{name:'Club Leader',exact:true}).count(),0)}
  for(const role of ['student','member']){
   await go(role);await expect(header.getByLabel('Current workspace: Personal',{exact:true})).toBeVisible();await noRestricted();assert.equal(await workspaces.locator('[data-workspace-option]').count(),0)
   await header.getByRole('button',{name:/^Search OutClass/}).click();const search=page.getByRole('dialog',{name:'Search OutClass',exact:true});await search.getByRole('combobox').fill('Admin');await expect(search.getByRole('option')).toHaveCount(0);await page.keyboard.press('Escape')
   await page.setViewportSize({width:390,height:844});const before=calls;await page.getByRole('button',{name:'More navigation and workspaces'}).click();await page.getByRole('dialog',{name:'Workspace navigation',exact:true}).waitFor();await noRestricted();assert.equal(calls,before,'opening mobile navigation never refetches eligibility');await page.keyboard.press('Escape');await page.setViewportSize({width:1600,height:1000})
  }
  await shot('personal')
  eligible=true;await go('student');assert.deepEqual(await workspaces.locator('[data-workspace-option] > span').allTextContents(),['Personal','Admin'],'Admin eligibility is independent of club leadership');eligible=false
  // The URL does not grant authority, even before the endpoint settles.
  delay=true;await page.goto(`${fixture.base}/platform?role=student`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('header'));await noRestricted();assert.equal(await dock.getByRole('link').count(),0);await expect(page.getByText('Workspace content',{exact:true})).toHaveCount(0)
  await expect.poll(()=>!!release).toBe(true);delay=false;release();await page.waitForURL('**/?workspace=student');await noRestricted()
  await go('owner','/club/fixture-mii/workspace?section=recruitment');await expect(choice('Club Leader')).toHaveAttribute('aria-current','page');assert.deepEqual(await workspaces.locator('[data-workspace-option] > span').allTextContents(),['Personal','Club Leader']);assert.equal(await dock.locator('.oc-workspace-switcher').count(),0);await shot('leader-desktop')
  assert.equal(await header.locator('.oc-evolving-toggle').count(),1);assert.equal(await header.locator('.oc-evolving-toggle .oc-product-context .oc-product-modes').count(),1,'modes evolve inside the selected workspace segment');assert.equal(await header.locator('.oc-product-header-row > .oc-product-context').count(),0);assert.equal(await header.locator('.oc-evolving-toggle .oc-floating-modes').evaluate(el=>getComputedStyle(el).boxShadow),'none')
  // Real shell remains mounted and performs no access or membership reads across club/mode/workspace navigation.
  await page.locator('main').evaluate(el=>el.dataset.mountProbe='retained');const requests=calls
  await header.getByRole('button',{name:/^Switch club:/}).click();await page.keyboard.press('Escape');await expect(header.getByRole('button',{name:/^Switch club:/})).toBeFocused()
  const club=header.getByRole('button',{name:/^Switch club:/});await club.click();assert.equal(await page.getByRole('menuitem',{name:/Campus Arts Society/}).count(),0);await page.getByRole('menuitem',{name:/Virginia Volunteers/}).click();await page.waitForURL('**/club/fixture-volunteers/workspace*');await expect(club).toHaveAccessibleName('Switch club: Virginia Volunteers')
  const modes=header.getByRole('navigation',{name:'Product modes',exact:true});await modes.getByRole('link',{name:'Recruiting',exact:true}).click();await expect(modes.getByRole('link',{name:'Recruiting',exact:true})).toHaveAttribute('aria-current','page');await modes.getByRole('link',{name:'Club',exact:true}).click();await expect(modes.getByRole('link',{name:'Club',exact:true})).toHaveAttribute('aria-current','page')
  await page.evaluate(()=>{const el=document.createElement('div');el.id='guard';el.dataset.unsaved='true';document.body.append(el)})
  const guarded=page.url();page.once('dialog',dialog=>dialog.dismiss());await choice('Personal').click();assert.equal(page.url(),guarded);await expect(choice('Club Leader')).toHaveAttribute('aria-current','page')
  page.once('dialog',dialog=>dialog.accept());await choice('Personal').click();await page.waitForURL('**/?workspace=student');await expect(choice('Personal')).toHaveAttribute('aria-current','page');assert.equal(await header.locator('.oc-header-club').count(),0);await expect(dock.getByRole('navigation',{name:'Context navigation'})).toBeVisible()
  await page.evaluate(()=>document.getElementById('guard').remove());await page.goBack();await expect(choice('Club Leader')).toHaveAttribute('aria-current','page');await expect(club).toHaveAccessibleName('Switch club: Virginia Volunteers');await page.goForward();await expect(choice('Personal')).toHaveAttribute('aria-current','page');await choice('Club Leader').click();await page.waitForURL('**/club/fixture-mii/workspace*')
  assert.equal(await page.locator('main').getAttribute('data-mount-probe'),'retained');assert.equal(calls,requests);assert.equal(await page.evaluate(()=>window.fixtureIdentityRefreshes||0),0)
  // Settings-aware club switching chooses an available destination in the next club.
  await go('owner','/club/fixture-mii/workspace?section=settings&setting=notifications');await club.click();await page.getByRole('menuitem',{name:/Virginia Volunteers/}).click();await page.waitForURL('**/club/fixture-volunteers/workspace?section=settings&setting=notifications')
  // Revocation updates all surfaces from the refreshed account rather than a copied membership list.
  await page.evaluate(()=>window.dispatchEvent(new Event('fixture:revoke-leader')));await page.waitForURL('**/?workspace=student');await expect(header.getByLabel('Current workspace: Personal',{exact:true})).toBeVisible();await noRestricted()
  eligible=true;await go('platform','/platform');await expect(choice('Admin')).toHaveAttribute('aria-current','page');assert.deepEqual(await workspaces.locator('[data-workspace-option] > span').allTextContents(),['Personal','Club Leader','Admin']);await expect(dock.getByRole('link',{name:'Audit Log',exact:true})).toBeVisible();assert.equal(await modes.count(),0);assert.equal(await header.locator('.oc-header-club').count(),0);await shot('admin-desktop')
  await choice('Personal').focus();await page.keyboard.press('ArrowRight');await expect(choice('Club Leader')).toBeFocused();await page.keyboard.press('End');await expect(choice('Admin')).toBeFocused();await page.keyboard.press('Home');await expect(choice('Personal')).toBeFocused();await page.keyboard.press('Enter');await page.waitForURL('**/?workspace=student');await expect(choice('Personal')).toHaveAttribute('aria-current','page');await shot('three-options-personal');await choice('Club Leader').click();await page.waitForURL('**/club/*/workspace');await shot('three-options-leader');await choice('Admin').click();await page.waitForURL('**/platform')
  eligible=false;await page.evaluate(()=>window.dispatchEvent(new Event('outclass:workspace-access-changed')));await page.waitForURL('**/?workspace=student');await expect(choice('Admin')).toHaveCount(0);assert.equal(await page.locator('a[href^="/platform"]').count(),0)
  eligible=true;fail=true;await go('owner');await expect(choice('Admin')).toHaveCount(0);fail=false
  // Both workspaces and modes stay readable and reachable at narrow widths and 200% zoom.
  for(const role of ['student','owner','platform']){
   eligible=role==='platform';await go(role,role==='student'?'/':'/club/fixture-mii/workspace?section=recruitment')
   if(role==='owner')await header.locator('.oc-header-club-name').evaluate(el=>el.textContent='McIntire Investment Institute and Interdisciplinary Research Association')
   for(const width of [1920,1600,1440,1280,1024,900,720,540,430,390,360,320]){
    await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready)
    assert.equal(await header.evaluate(el=>{const rects=Array.from(el.querySelectorAll('a,button')).map(n=>n.getBoundingClientRect()).filter(r=>r.width>0);return rects.every(r=>r.left>=0&&r.right<=innerWidth+.5&&r.height>=44)&&rects.every((a,i)=>rects.slice(i+1).every(b=>a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5))}),true,`${role} controls do not overlap at ${width}`)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    if(width===390){await shot(`${role}-mobile`);const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])}
   }
  }
  await page.setViewportSize({width:1600,height:1000});await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await workspaces.locator('.oc-evolving-indicator').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
  assert.deepEqual(errors,[]);await context.close()
 }finally{await browser?.close();await fixture.close()}
})
