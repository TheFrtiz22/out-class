// Real ProductShell, Radix, routes and CSS in the isolated shell fixture. Only auth/data boundaries are fictional.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const {chromium,webkit}=require('playwright'),{expect}=require('playwright/test'),AxeBuilder=require('@axe-core/playwright').default
const {startDockFixture}=require('./helpers/expanding-dock-browser.cjs')
const engine=process.env.OUTCLASS_NAV_BROWSER==='webkit'?webkit:chromium
const screenshotDir=process.env.OUTCLASS_DOCK_SCREENSHOTS

test('browser: labelled rail without overlay, tooltips when compact, URL-driven active state, flat items in order, pinned Settings, permissions, guards and phone bars',async()=>{
 const fixture=await startDockFixture();let browser
 try{
  browser=await engine.launch({headless:true,...(engine===chromium&&!fs.existsSync(chromium.executablePath())?{channel:'chrome'}:{})})
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[]
  page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message))
  const route=(role='president',section='recruitment')=>`${fixture.base}/club/fixture-mii/workspace?section=${section}&role=${role}`
  const rail=page.locator('aside.oc-expanding-dock'),applicants=rail.getByRole('link',{name:'Applicants',exact:true}),decide=rail.getByRole('link',{name:'Decide',exact:true})
  const width=()=>rail.evaluate(el=>el.getBoundingClientRect().width)
  const mainBounds=()=>page.locator('main').evaluate(el=>{const r=el.getBoundingClientRect();return[r.x,r.width]})
  const label=name=>rail.getByRole('link',{name,exact:true}).locator('.oc-dock-item-label')
  async function capture(name){if(screenshotDir){fs.mkdirSync(screenshotDir,{recursive:true});await page.screenshot({path:`${screenshotDir}/${name}.png`})}}
  // Every rail control has an accessible name, whether its label is visible or clipped.
  const unnamed=()=>rail.locator('a,button').evaluateAll(items=>items.filter(item=>!(item.getAttribute('aria-label')||item.textContent).trim()).length)

  // ≥1280px: icon + label, permanently. The rail reserves its width; nothing overlays content.
  await page.goto(route(),{waitUntil:'networkidle'})
  assert.equal(await width(),236);assert.equal(await rail.getAttribute('data-dock-expanded'),null)
  await expect(rail.getByRole('navigation',{name:'Recruiting',exact:true})).toBeVisible();await expect(rail.getByRole('navigation',{name:'Club',exact:true})).toBeVisible()
  await expect(label('Home')).toBeVisible();await expect(rail.locator('.oc-dock-section-heading',{hasText:'Recruiting'})).toBeVisible()
  const brand=rail.getByRole('button',{name:'OutClass home',exact:true})
  assert.equal(await brand.locator('.oc-dock-letter-out').evaluate(el=>getComputedStyle(el).opacity),'1','the full wordmark shows with labels')
  assert.equal(await brand.locator('.oc-dock-letter-c').evaluate(el=>getComputedStyle(el).fill),'rgb(242, 101, 34)')
  assert.equal(await unnamed(),0)
  assert.ok((await page.locator('main').boundingBox()).x>=(await rail.boundingBox()).x+236,'content starts beside the rail')
  const stable=await mainBounds();await rail.hover();await page.mouse.move(120,500);await page.waitForTimeout(300)
  assert.equal(await width(),236,'hover never widens the rail');assert.deepEqual(await mainBounds(),stable)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  // No duplicate search or notifications in the rail; the header keeps both.
  assert.equal(await rail.getByRole('link',{name:/Notifications|Inbox/}).count(),0);assert.equal(await rail.getByRole('button',{name:/Search/}).count(),0)
  await expect(page.locator('header').getByRole('button',{name:/^Search OutClass/})).toBeVisible();await expect(page.locator('header').getByRole('button',{name:/^Notifications/})).toBeVisible()
  await capture('rail-labelled')

  // The club rail: eight destinations in order, every one a plain link (no flyout), Settings pinned at the bottom.
  assert.deepEqual(await rail.getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('aria-label'))),['Recruiting overview','Applicants','Interviews','Decide','Home','Calendar','Tasks','Members','Settings'])
  assert.equal(await rail.locator('button[aria-controls],[aria-haspopup]').count(),0,'no rail item opens a menu')
  const settingsBox=await rail.getByRole('link',{name:'Settings',exact:true}).boundingBox(),railBox=await rail.locator('.oc-dock-rail').boundingBox()
  assert.ok(railBox.y+railBox.height-(settingsBox.y+settingsBox.height)<40,'Settings sits at the bottom of the rail')
  const membersBox=await rail.getByRole('link',{name:'Members',exact:true}).boundingBox()
  assert.ok(settingsBox.y-(membersBox.y+membersBox.height)>40,'Settings is separated from the Club items')
  // Active item follows the URL: Applicants is the default recruitment tool and lights for its record pages.
  await expect(applicants).toHaveAttribute('aria-current','page')
  // Destinations respect pending saves and unsaved changes.
  await page.evaluate(()=>{const guard=document.createElement('div');guard.id='guard';guard.dataset.saving='true';document.body.append(guard)})
  const beforeGuard=page.url(),interviewsLink=rail.getByRole('link',{name:'Interviews',exact:true})
  await interviewsLink.click();assert.equal(page.url(),beforeGuard)
  await page.evaluate(()=>{const guard=document.getElementById('guard');delete guard.dataset.saving;guard.dataset.unsaved='true'})
  page.once('dialog',dialog=>dialog.dismiss());await interviewsLink.click();assert.equal(page.url(),beforeGuard)
  page.once('dialog',dialog=>dialog.accept());await interviewsLink.click();await page.waitForURL('**tool=interviews*')
  await expect(page.locator('main')).toBeFocused();await page.evaluate(()=>document.getElementById('guard').remove())
  await page.goBack();await page.waitForURL('**role=president');await page.goForward();await page.waitForURL('**tool=interviews*')
  await page.goto(`${route()}&tool=resumes`,{waitUntil:'networkidle'});await expect(applicants).toHaveAttribute('aria-current','page')
  await page.goto(`${route()}&tool=scheduled-decisions`,{waitUntil:'networkidle'});await expect(decide).toHaveAttribute('aria-current','page')
  await rail.getByRole('link',{name:'Home',exact:true}).click();await page.waitForURL('**section=overview*')
  await expect(rail.getByRole('link',{name:'Home',exact:true})).toHaveAttribute('aria-current','page');await expect(applicants).not.toHaveAttribute('aria-current','page')

  // Keyboard: Tab walks the rail in order; activating a link lands focus in the page.
  await page.goto(route(),{waitUntil:'networkidle'})
  await applicants.focus();await page.keyboard.press('Tab');await expect(rail.getByRole('link',{name:'Interviews',exact:true})).toBeFocused()
  await page.keyboard.press('Tab');await expect(decide).toBeFocused();await page.keyboard.press('Enter');await page.waitForURL('**tool=decisions*');await expect(page.locator('main')).toBeFocused()
  // Crossing 1280px never remounts or unfocuses a rail item.
  const interviews=rail.getByRole('link',{name:'Interviews',exact:true});await interviews.focus();await interviews.evaluate(el=>{el.dataset.mountProbe='kept'})
  await page.setViewportSize({width:1100,height:900});await expect.poll(width).toBe(80);await expect(interviews).toBeFocused();assert.equal(await interviews.getAttribute('data-mount-probe'),'kept')
  await page.setViewportSize({width:1440,height:900});await expect.poll(width).toBe(236);await expect(interviews).toBeFocused();await expect(page.getByRole('tooltip')).toHaveCount(0)
  // Permissions come from the same registry.
  await page.goto(route('reviewer'),{waitUntil:'networkidle'});await expect(applicants).toBeVisible();assert.equal(await decide.count(),0,'review alone does not open Decide')
  await page.goto(route('settings','overview'),{waitUntil:'networkidle'});assert.equal(await applicants.count(),0);assert.equal(await decide.count(),0)
  assert.equal(await rail.getByRole('navigation',{name:'Recruiting',exact:true}).count(),0,'no Recruiting section without recruiting tools')

  // Personal rail: every section, one name each, active item from the path.
  await page.goto(`${fixture.base}/home?role=student`,{waitUntil:'networkidle'})
  assert.deepEqual(await rail.getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('aria-label'))),['Home','Explore','Events','Applications','My Clubs','Calendar','Profile'])
  await expect(rail.getByRole('link',{name:'Home',exact:true})).toHaveAttribute('aria-current','page')
  // Visible text (the avatar's initials included) must be part of each control's name.
  const names=await new AxeBuilder({page}).withRules(['label-content-name-mismatch']).analyze()
  assert.deepEqual(names.violations.map(v=>v.nodes.map(n=>n.target)),[])
  await rail.getByRole('link',{name:'Explore',exact:true}).click();await page.waitForURL('**/explore')
  await expect(rail.getByRole('link',{name:'Explore',exact:true})).toHaveAttribute('aria-current','page');await expect(rail.getByRole('link',{name:'Home',exact:true})).not.toHaveAttribute('aria-current','page')
  await page.goto(`${fixture.base}/explore/categories?role=student`,{waitUntil:'networkidle'});await expect(rail.getByRole('link',{name:'Explore',exact:true})).toHaveAttribute('aria-current','page')
  await page.goto(`${fixture.base}/applications?role=student`,{waitUntil:'networkidle'});await expect(rail.getByRole('link',{name:'Applications',exact:true})).toHaveAttribute('aria-current','page')

  // Admin sections.
  await page.route('**/api/platform/eligibility',route=>route.fulfill({json:{eligible:true}}));await page.goto(`${fixture.base}/platform/audit?role=platform`,{waitUntil:'networkidle'})
  for(const name of ['Home','Platform','Operations','System'])await rail.getByRole('navigation',{name,exact:true}).waitFor()
  await expect(rail.getByRole('link',{name:'Audit Log',exact:true})).toHaveAttribute('aria-current','page');await page.unroute('**/api/platform/eligibility')

  // 1024–1279px: icons only, named, with a tooltip on hover or focus. Still no overlay.
  await page.goto(route(),{waitUntil:'networkidle'})
  for(const size of [1024,1100,1279]){
   await page.setViewportSize({width:size,height:900});await expect.poll(width).toBe(80)
   assert.equal(await label('Interviews').evaluate(el=>el.getBoundingClientRect().width<=1),true,`${size}: label is clipped`)
   assert.equal(await unnamed(),0);await expect(rail.getByRole('link',{name:'Interviews',exact:true})).toBeVisible()
   const before=await mainBounds();await rail.getByRole('link',{name:'Interviews',exact:true}).hover()
   await expect(page.getByRole('tooltip',{name:'Interviews'})).toBeVisible();assert.equal(await width(),80);assert.deepEqual(await mainBounds(),before,`${size}: content does not shift`)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${size}: no overflow`)
   await page.mouse.move(size-40,600)
  }
  await page.setViewportSize({width:1100,height:900})
  await rail.getByRole('link',{name:'Home',exact:true}).focus();await expect(page.getByRole('tooltip',{name:'Home'})).toBeVisible()
  await decide.focus();await expect(page.getByRole('tooltip',{name:'Decide'})).toBeVisible()
  // Audit the page at rest: focus on the content, no tooltip or menu open.
  await page.locator('main').focus();await expect(page.getByRole('tooltip')).toHaveCount(0)
  let axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze()
  assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
  await capture('rail-compact')
  await page.setViewportSize({width:1024,height:420});await rail.getByRole('link',{name:'Settings',exact:true}).scrollIntoViewIfNeeded();await expect(rail.getByRole('link',{name:'Settings',exact:true})).toBeInViewport()

  // Motion, contrast and forced colors at the labelled width.
  await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'})
  await page.emulateMedia({contrast:'more'})
  assert.equal(await rail.locator('.oc-dock-rail').evaluate(el=>getComputedStyle(el).backdropFilter),'none')
  assert.equal(await rail.locator('.oc-dock-rail').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(35, 45, 75)')
  await page.emulateMedia({contrast:'no-preference'})
  axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze()
  assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
  await page.emulateMedia({forcedColors:'active'});await expect(applicants).toBeVisible();await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference'})

  // Phones and 200% zoom: the bottom bar is the only section nav; More opens every section, with no workspace pill.
  for(const size of [720,390,320]){
   await page.setViewportSize({width:size,height:844});await expect(rail).toBeHidden()
   const bar=page.getByRole('navigation',{name:'Sections',exact:true});await expect(bar.getByRole('link')).toHaveText(['Home','Recruiting','Calendar','Members'])
   await bar.getByRole('button',{name:'More sections'}).click()
   const drawer=page.getByRole('dialog',{name:'Workspace navigation',exact:true});await drawer.waitFor()
   assert.equal(await drawer.getByRole('navigation',{name:'Workspaces'}).count(),0)
   // More lists the rail items the bar doesn't show directly, in rail order and with rail labels.
   assert.deepEqual(await drawer.getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('aria-label'))),['Recruiting overview','Applicants','Interviews','Decide','Tasks','Settings'])
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
   if(size===390){await page.waitForTimeout(220);await capture('rail-mobile');axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])}
   await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'})
  }

  // The solid default when the blur enhancement is unsupported.
  const fallbackContext=await browser.newContext({viewport:{width:1440,height:900}})
  await fallbackContext.route('**/styles.css',async route=>{
   const response=await route.fetch(),css=await response.text()
   const guard='@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))'
   assert.ok(css.includes(guard))
   await route.fulfill({response,body:css.replace(guard,'@supports (outclass-glass: unsupported)')})
  })
  const fallback=await fallbackContext.newPage();await fallback.goto(route(),{waitUntil:'networkidle'})
  assert.equal(await fallback.locator('.oc-dock-rail').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(35, 45, 75)')
  await fallback.getByRole('link',{name:'Applicants',exact:true}).focus();await expect(fallback.getByRole('link',{name:'Applicants',exact:true})).toBeFocused()
  await fallbackContext.close()
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await fixture.close()}
})
