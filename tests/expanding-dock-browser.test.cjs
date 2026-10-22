const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const {chromium,webkit}=require('playwright'),{expect}=require('playwright/test'),AxeBuilder=require('@axe-core/playwright').default
const {startDockFixture}=require('./helpers/expanding-dock-browser.cjs')
const engine=process.env.OUTCLASS_NAV_BROWSER==='webkit'?webkit:chromium
const screenshotDir=process.env.OUTCLASS_DOCK_SCREENSHOTS

test('browser: expanding dock, shared motion, safe flyouts, permissions, keyboard, workspace guards and responsive accessibility',async()=>{
 const fixture=await startDockFixture();let browser
 try{
  browser=await engine.launch({headless:true,...(engine===chromium&&!fs.existsSync(chromium.executablePath())?{channel:'chrome'}:{})})
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],requests=[]
  page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()))
  const route=(role='president',section='recruitment')=>`${fixture.base}/club/fixture-mii/workspace?section=${section}&role=${role}`
  const dock=page.locator('aside.oc-expanding-dock'),applicants=dock.getByRole('button',{name:'Applicants',exact:true}),decisions=dock.getByRole('button',{name:'Decisions',exact:true})
  const flyout=()=>page.getByRole('dialog',{name:'Applicants navigation',exact:true})
  const mainBounds=()=>page.locator('main').evaluate(el=>{const r=el.getBoundingClientRect();return[r.x,r.width]})
  const expanded=value=>expect(dock).toHaveAttribute('data-dock-expanded',String(value))
  async function outside(){await page.mouse.move(900,650);await page.locator('main').focus();await expanded(false);await page.waitForTimeout(320)}
  async function capture(name){if(screenshotDir){fs.mkdirSync(screenshotDir,{recursive:true});await page.screenshot({path:`${screenshotDir}/${name}.png`})}}
  await page.goto(route(),{waitUntil:'networkidle'});await expanded(false)
  assert.equal(await dock.evaluate(el=>el.getBoundingClientRect().width),80)
  const brand=dock.getByRole('button',{name:'OutClass home',exact:true})
  assert.equal(await brand.locator('img,rect,text').count(),0,'transparent vector letters replace the boxed icon and duplicate text')
  assert.equal(await brand.locator('svg').count(),1)
  assert.equal(await brand.locator('.oc-dock-letter-out').evaluate(el=>getComputedStyle(el).opacity),'0')
  const interlocked=await brand.locator('.oc-dock-letter-c').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).e)
  assert.equal(interlocked,-153)
  const stableBounds=await mainBounds(),initialRequests=requests.length
  await page.locator('main').evaluate(el=>el.dataset.mountProbe='retained')
  await capture('after-collapsed')
  await applicants.hover();await expanded(true);await flyout().waitFor();await page.waitForTimeout(380)
  assert.equal(await dock.evaluate(el=>el.getBoundingClientRect().width),272)
  assert.equal(await brand.locator('.oc-dock-letter-out').evaluate(el=>getComputedStyle(el).opacity),'1')
  assert.equal(await brand.locator('.oc-dock-letter-c').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).e),0,'the same C unlinks into its wordmark position')
  assert.deepEqual(await mainBounds(),stableBounds)
  assert.equal(await page.locator('main').getAttribute('data-mount-probe'),'retained')
  assert.equal(requests.length,initialRequests,'expansion and hover make zero additional network requests')
  assert.equal(await applicants.locator('.oc-dock-item-label').evaluate(el=>getComputedStyle(el).opacity),'1')
  const scales=await dock.locator('[data-dock-item]').evaluateAll(items=>items.slice(0,3).map(item=>new DOMMatrix(getComputedStyle(item.querySelector('.oc-dock-icon')).transform).a))
  assert.ok(scales[1]>1.12&&scales[1]<=1.2);assert.ok(scales[0]>1&&scales[0]<scales[1]);assert.ok(scales[2]>1&&scales[2]<scales[1])
  assert.equal(await dock.locator('.oc-dock-hover-highlight').count(),1)
  const beforeHighlight=await dock.locator('.oc-dock-hover-highlight').boundingBox()
  assert.equal(await flyout().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(20, 45, 69)')
  assert.equal(await flyout().getByRole('link').count(),4)
  await capture('after-expanded-flyout')
  // A slow traverse through the physical gap exercises the actual hover bridge.
  const parent=await applicants.boundingBox(),menu=await flyout().boundingBox()
  assert.ok(menu.x-(await dock.boundingBox()).x-272>=8)
  await page.mouse.move(parent.x+parent.width-2,parent.y+parent.height/2)
  await page.mouse.move(menu.x-8,menu.y+35,{steps:4});await page.waitForTimeout(280)
  await expect(applicants).toHaveAttribute('aria-expanded','true')
  await page.mouse.move(menu.x+80,menu.y+75,{steps:4});await page.waitForTimeout(250);await expanded(true)
  // Diagonal travel toward a lower child must not select the rows it crosses.
  await applicants.hover();const start=await applicants.boundingBox(),lower=await flyout().getByRole('link').last().boundingBox()
  const from={x:start.x+140,y:start.y+24},to={x:lower.x+110,y:lower.y+22}
  await page.mouse.move(from.x,from.y)
  for(let step=1;step<=20;step++){await page.mouse.move(from.x+(to.x-from.x)*step/20,from.y+(to.y-from.y)*step/20);await page.waitForTimeout(10)}
  await page.waitForTimeout(250);await expect(applicants).toHaveAttribute('aria-expanded','true');await expect(flyout().getByRole('link').last()).toBeVisible()
  await decisions.hover();await page.getByRole('dialog',{name:'Decisions navigation'}).waitFor();await expect(flyout()).toHaveCount(0)
  await page.waitForTimeout(350)
  const afterHighlight=await dock.locator('.oc-dock-hover-highlight').boundingBox()
  assert.ok(afterHighlight.y>beforeHighlight.y);assert.equal(afterHighlight.height,48)
  assert.equal(await page.locator('[data-dock-flyout]').count(),1)
  for(let i=0;i<5;i++){await applicants.hover();await decisions.hover()}
  await expanded(true);assert.equal(await page.locator('[data-dock-flyout]').count(),1)
  // Delay is observable: no immediate collapse, and reentry cancels it.
  await page.mouse.move(900,650);await page.waitForTimeout(80);await expanded(true)
  await applicants.hover();await page.waitForTimeout(220);await expanded(true)
  await outside();await expect(page.locator('[data-dock-flyout]')).toHaveCount(0)
  // Group disclosure is navigation-only, so pending forms do not block it; destinations do.
  await page.evaluate(()=>{const guard=document.createElement('div');guard.id='guard';guard.dataset.saving='true';document.body.append(guard)})
  await applicants.hover();await flyout().waitFor();const beforeGuard=page.url()
  await flyout().getByRole('link',{name:'Rejected Applicants',exact:true}).click();assert.equal(page.url(),beforeGuard)
  await page.evaluate(()=>{const guard=document.getElementById('guard');delete guard.dataset.saving;guard.dataset.unsaved='true'})
  page.once('dialog',dialog=>dialog.dismiss())
  await flyout().getByRole('link',{name:'Rejected Applicants',exact:true}).click();assert.equal(page.url(),beforeGuard)
  page.once('dialog',dialog=>dialog.accept())
  await flyout().getByRole('link',{name:'Rejected Applicants',exact:true}).click();await page.waitForURL('**tool=rejected')
  await expect(page.locator('main')).toBeFocused();await page.evaluate(()=>document.getElementById('guard').remove())
  await page.goBack();await page.waitForURL('**role=president');await page.goForward();await page.waitForURL('**tool=rejected')
  await applicants.hover();await expect(flyout().getByRole('link',{name:'Rejected Applicants',exact:true})).toHaveAttribute('aria-current','page');await expect(applicants).toHaveAttribute('data-active','true')
  await outside()
  // Keyboard expansion, native Tab destinations, directional shortcuts and two-stage Escape.
  await applicants.focus();await expanded(true);await page.keyboard.press('ArrowRight');await flyout().waitFor()
  await expect(flyout().getByRole('link',{name:'All Applicants',exact:true})).toBeFocused()
  await page.keyboard.press('ArrowDown');await expect(flyout().getByRole('link',{name:'Rejected Applicants',exact:true})).toBeFocused()
  await page.keyboard.press('End');await expect(flyout().getByRole('link',{name:'Submitted reviews',exact:true})).toBeFocused()
  await page.keyboard.press('Home');await expect(flyout().getByRole('link',{name:'All Applicants',exact:true})).toBeFocused()
  await page.keyboard.press('Tab');await expect(flyout().getByRole('link',{name:'Rejected Applicants',exact:true})).toBeFocused()
  await page.mouse.move(900,650);await page.waitForTimeout(350);await expanded(true)
  await page.keyboard.press('Escape');await expect(flyout()).toHaveCount(0);await expect(applicants).toBeFocused();await expanded(true)
  await page.keyboard.press('Escape');await expect(page.locator('main')).toBeFocused();await expanded(false)
  await applicants.focus();await page.keyboard.press('Enter');await expect(flyout().getByRole('link').first()).toBeFocused();await page.keyboard.press('ArrowLeft');await expect(applicants).toBeFocused();await page.keyboard.press('Enter');await expect(flyout().getByRole('link').first()).toBeFocused();await page.keyboard.press('Enter');await page.waitForURL('**tool=applicants');await expect(page.locator('main')).toBeFocused()
  await applicants.focus();await page.keyboard.press('ArrowRight');await flyout().waitFor();await page.keyboard.press('Control+k');const search=page.getByRole('dialog',{name:'Search OutClass',exact:true});await search.waitFor();await expect(search.getByRole('combobox')).toBeFocused();await page.keyboard.press('Escape');
  // Club selection is centralized in the header and independent of dock hover.
  await outside();assert.equal(await dock.locator('.oc-workspace-switcher').count(),0);const workspace=page.locator('header').getByRole('button',{name:/Switch club:/})
  await workspace.click();await page.getByRole('menuitem',{name:/Virginia Volunteers/}).waitFor()
  await page.mouse.move(900,650);await page.waitForTimeout(350);await expanded(false)
  await page.getByRole('menuitem',{name:/Virginia Volunteers/}).click();await page.waitForURL('**/club/fixture-volunteers/workspace*')
  await page.goto(route('owner'),{waitUntil:'networkidle'});await applicants.hover();await flyout().waitFor()
  assert.deepEqual(await flyout().getByRole('link').allTextContents(),['All Applicants','Rejected Applicants'],'owner does not imply sensitive interview offices')
  await page.goto(route('reviewer'),{waitUntil:'networkidle'});await applicants.hover();await flyout().waitFor()
  assert.deepEqual(await flyout().getByRole('link').allTextContents(),['All Applicants','Rejected Applicants'])
  await page.goto(route('settings','overview'),{waitUntil:'networkidle'});assert.equal(await applicants.count(),0);assert.equal(await decisions.count(),0)
  // Student modes and platform sections use their actual metadata, including long, scrollable rails.
  for(const [mode,names]of [['explore',['Discover','Corkboard']],['apply',['Applications','Status']],['clubs',['Clubs','Meetings','Tasks']]]){
   await page.goto(`${route('student','overview')}&mode=${mode}`,{waitUntil:'networkidle'});await dock.hover();await expanded(true)
   assert.deepEqual(await dock.getByRole('navigation',{name:'Context navigation'}).locator('[data-dock-item]').allTextContents(),names)
   assert.equal(await dock.getByRole('button',{name:'Home',exact:true}).count(),1)
   await dock.getByRole('button',{name:names[0],exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('mode'),mode);await expect(dock.getByRole('button',{name:names[0],exact:true})).toHaveAttribute('aria-current','page')
  }
  await page.route('**/api/platform/eligibility',route=>route.fulfill({json:{eligible:true}}));await page.goto(`${fixture.base}/platform?role=platform`,{waitUntil:'networkidle'});await dock.hover();await expanded(true)
  for(const name of ['Home','Platform','Operations','System'])await dock.getByRole('navigation',{name,exact:true}).waitFor()
  await page.mouse.move(900,650);await dock.getByRole('link',{name:'Audit Log',exact:true}).focus();await expect(dock.getByRole('link',{name:'Audit Log',exact:true})).toBeFocused()
  await page.waitForTimeout(350);assert.ok(Math.abs((await dock.locator('.oc-dock-hover-highlight').boundingBox()).y-(await dock.getByRole('link',{name:'Audit Log',exact:true}).boundingBox()).y)<1,'shared highlight accounts for internal scroll');
  await dock.getByRole('link',{name:'Audit Log',exact:true}).click();await page.waitForURL('**/platform/audit')
  await page.unroute('**/api/platform/eligibility')
  // Desktop geometry at every requested width, plus a short viewport requiring internal scroll.
  await page.goto(route(),{waitUntil:'networkidle'})
  for(const width of [1024,1280,1440,1920]){
   await page.setViewportSize({width,height:900});await outside();const before=await mainBounds()
   await applicants.hover();await flyout().waitFor();await page.waitForTimeout(350)
   assert.deepEqual(await mainBounds(),before,`${width}: content does not shift`)
   assert.equal(await page.locator('.oc-product-modes').evaluate(el=>el.getBoundingClientRect().left>=document.querySelector('aside').getBoundingClientRect().right),true,`${width}: expanded dock leaves mode controls accessible`)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}: no overflow`)
   assert.equal(await flyout().evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}),true)
   assert.equal(await applicants.evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.width>=44}),true)
  }
  await page.setViewportSize({width:1024,height:420});await dock.getByRole('link',{name:'Settings',exact:true}).focus();await expanded(true)
  await decisions.focus();await page.keyboard.press('ArrowRight');await page.getByRole('dialog',{name:'Decisions navigation'}).waitFor()
  assert.equal(await page.getByRole('dialog',{name:'Decisions navigation'}).evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),true)
  await page.keyboard.press('Escape');await page.keyboard.press('Escape')
  await page.setViewportSize({width:1280,height:900});await page.goto(route(),{waitUntil:'networkidle'})
  await page.emulateMedia({reducedMotion:'reduce'});await applicants.hover();await flyout().waitFor()
  assert.equal(await brand.locator('.oc-dock-letter-c').evaluate(el=>getComputedStyle(el).transitionDuration),'0s','wordmark movement respects reduced motion')
  assert.equal(await dock.evaluate(el=>getComputedStyle(el).transitionDuration),'0s')
  assert.equal(await applicants.locator('.oc-dock-icon').evaluate(el=>getComputedStyle(el).transform),'none')
  assert.equal(await flyout().evaluate(el=>getComputedStyle(el).animationName),'none')
  let axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze()
  assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
  await page.emulateMedia({forcedColors:'active'});await expect(applicants).toBeVisible();assert.notEqual(await dock.getByRole('link',{name:'Overview',exact:true}).evaluate(el=>getComputedStyle(el, '::before').backgroundColor),'rgba(0, 0, 0, 0)')
  await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'})
  // At 200% zoom a 1440px display has a 720px CSS viewport: use the labeled mobile UI.
  await applicants.focus()
  for(const width of [720,390,320]){
   await page.setViewportSize({width,height:844});await expect(dock).toBeHidden();await expect(page.locator('[data-dock-flyout]')).toHaveCount(0)
   if(width===720)await expect(page.locator('main')).toBeFocused()
   const mobile=page.getByRole('navigation',{name:'Primary mobile navigation'});await mobile.waitFor();await mobile.getByRole('button',{name:'More navigation and workspaces'}).click()
   const drawer=page.getByRole('dialog',{name:'Workspace navigation',exact:true});await drawer.waitFor();await expect(drawer.getByRole('button',{name:'Applicants',exact:true})).toHaveAttribute('aria-expanded','false')
   await drawer.getByRole('button',{name:'Applicants',exact:true}).click();await drawer.getByRole('link',{name:'All Applicants',exact:true}).waitFor()
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
   if(width===390){await page.waitForTimeout(220);await capture('after-mobile');axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),[])}
   await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'})
  }
  const touchContext=await browser.newContext({hasTouch:true,viewport:{width:1280,height:900}}),touch=await touchContext.newPage();await touch.goto(route(),{waitUntil:'networkidle'});await touch.getByRole('button',{name:'Applicants',exact:true}).tap();await expect(touch.locator('aside.oc-expanding-dock')).toHaveAttribute('data-dock-expanded','true');await touch.getByRole('dialog',{name:'Applicants navigation'}).getByRole('link',{name:'Rejected Applicants',exact:true}).tap();await touch.waitForURL('**tool=rejected');await touchContext.close();
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await fixture.close()}
})
