const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const {chromium,webkit}=require('playwright'),{expect}=require('playwright/test'),AxeBuilder=require('@axe-core/playwright').default
const {startDockFixture}=require('./helpers/expanding-dock-browser.cjs')
const engine=process.env.OUTCLASS_NAV_BROWSER==='webkit'?webkit:chromium
const screenshots=process.env.OUTCLASS_SWITCHER_SCREENSHOTS

test('workspace pill switches workspace only: same segments everywhere, eligibility, revocation, guards, keyboard, phone account menu and responsive accessibility',async()=>{
 const fixture=await startDockFixture();let browser
 try{
  browser=await engine.launch({headless:true,...(engine===chromium&&!fs.existsSync(chromium.executablePath())?{channel:'chrome'}:{})})
  const context=await browser.newContext({viewport:{width:1600,height:1000},...(process.env.OUTCLASS_SWITCHER_VIDEO?{recordVideo:{dir:process.env.OUTCLASS_SWITCHER_VIDEO,size:{width:1600,height:1000}}}:{})})
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message))
  let eligible=false,fail=false,release,delay=false,calls=0
  await page.route('**/api/platform/eligibility',async route=>{calls++;if(delay)await new Promise(resolve=>release=resolve);await route.fulfill({status:fail?500:200,contentType:'application/json',body:JSON.stringify({eligible})})})
  const go=(role,path='/')=>page.goto(`${fixture.base}${path}${path.includes('?')?'&':'?'}role=${role}`,{waitUntil:'networkidle'})
  const header=page.locator('header'),workspaces=header.getByRole('navigation',{name:'Workspaces',exact:true}),dock=page.locator('aside.oc-expanding-dock')
  const choice=name=>workspaces.getByRole('link',{name,exact:true}),leaderChoice=()=>workspaces.locator('[data-workspace-kind="leader"] a')
  const kinds=()=>workspaces.locator('.oc-workspace-segment').evaluateAll(items=>items.map(item=>item.dataset.workspaceKind))
  const selected=name=>expect(workspaces.locator('.oc-workspace-segment[data-selected="true"]')).toHaveAttribute('data-workspace-label',name)
  const shot=async name=>{if(screenshots){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})))});fs.mkdirSync(screenshots,{recursive:true});await page.screenshot({path:`${screenshots}/${name}.png`})}}
  async function noRestricted(){assert.equal(await page.locator('a[href^="/platform"]').count(),0);assert.equal(await page.locator('[data-workspace-kind="leader"]').count(),0)}
  for(const role of ['student','member']){
   await go(role);await expect(choice('Personal workspace')).toHaveAttribute('aria-current','page');await noRestricted();assert.deepEqual(await kinds(),['personal'],'a student sees the same pill with only Personal')
   assert.equal(await header.getByRole('navigation',{name:'Product modes'}).count(),0,'sections are not in the pill')
   await header.getByRole('button',{name:/^Search OutClass/}).click();const search=page.getByRole('dialog',{name:'Search OutClass',exact:true});await search.getByRole('combobox').fill('Admin');await expect(search.getByRole('option')).toHaveCount(0);await page.keyboard.press('Escape')
   await page.setViewportSize({width:390,height:844});const before=calls;await page.getByRole('button',{name:'More sections'}).click();await page.getByRole('dialog',{name:'Workspace navigation',exact:true}).waitFor();await noRestricted();assert.equal(calls,before,'opening mobile navigation never refetches eligibility');await page.keyboard.press('Escape');await page.setViewportSize({width:1600,height:1000})
  }
  await shot('personal')
  eligible=true;await go('student');assert.deepEqual(await kinds(),['personal','admin'],'Admin eligibility is independent of club leadership');eligible=false
  // The URL does not grant authority, even before the endpoint settles.
  delay=true;await page.goto(`${fixture.base}/platform?role=student`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('header'));await noRestricted();assert.equal(await dock.getByRole('link').count(),0);await expect(page.getByText('Workspace content',{exact:true})).toHaveCount(0)
  await expect.poll(()=>!!release).toBe(true);delay=false;release();await page.waitForURL('**/home');await noRestricted()
  await go('owner','/club/fixture-mii/workspace?section=recruitment');await selected('McIntire Investment Institute');assert.deepEqual(await kinds(),['personal','leader']);await expect(leaderChoice()).toHaveAccessibleName('McIntire Investment Institute club workspace');assert.equal(await dock.locator('.oc-workspace-switcher').count(),0);await shot('leader-desktop')
  const bar=await header.locator('.oc-evolving-bar').boundingBox()
  assert.equal(bar.height,54);assert.ok(bar.y<=22,'header sits close to the top')
  assert.equal(await header.locator('.oc-workspace-hint,.oc-workspace-captions').count(),0,'no section hints or captions in the pill')
  const segmentWidths=await workspaces.locator('.oc-workspace-segment').evaluateAll(items=>items.map(el=>el.getBoundingClientRect().width))
  assert.ok(segmentWidths[1]>segmentWidths[0]*1.5,'active workspace borrows space inside the fixed bar')
  assert.equal(await workspaces.locator('.oc-evolving-indicator').evaluate(el=>getComputedStyle(el,'::after').content),'none')
  assert.equal(await header.locator('.oc-evolving-toggle').count(),1);assert.equal(await header.locator('.oc-product-modes,.oc-floating-modes').count(),0,'no section modes anywhere in the header')
  await expect(dock.getByRole('navigation',{name:'Recruiting',exact:true})).toBeVisible();await expect(dock.getByRole('navigation',{name:'Club',exact:true})).toBeVisible()
  // Real shell remains mounted and performs no access or membership reads across club/mode/workspace navigation.
  await page.locator('main').evaluate(el=>el.dataset.mountProbe='retained');const requests=calls
  await header.getByRole('button',{name:/^Switch club:/}).click();await page.keyboard.press('Escape');await expect(header.getByRole('button',{name:/^Switch club:/})).toBeFocused()
  const club=header.getByRole('button',{name:/^Switch club:/});await club.click();assert.equal(await page.getByRole('menuitem',{name:/Campus Arts Society/}).count(),0);await page.getByRole('menuitem',{name:/Virginia Volunteers/}).click();await page.waitForURL('**/club/fixture-volunteers/workspace*');await expect(club).toHaveAccessibleName('Switch club: Virginia Volunteers');await selected('Virginia Volunteers')
  // Recruiting and Club are rail sections now; the rail's active item follows the URL.
  const modes=header.getByRole('navigation',{name:'Product modes',exact:true})
  await dock.getByRole('link',{name:'Club home',exact:true}).click();await page.waitForURL('**section=overview*');await expect(dock.getByRole('link',{name:'Club home',exact:true})).toHaveAttribute('aria-current','page')
  await dock.getByRole('navigation',{name:'Recruiting',exact:true}).getByRole('link',{name:'Overview',exact:true}).click();await page.waitForURL('**tool=overview*');await expect(dock.getByRole('navigation',{name:'Recruiting',exact:true}).getByRole('link',{name:'Overview',exact:true})).toHaveAttribute('aria-current','page');await expect(dock.getByRole('link',{name:'Club home',exact:true})).not.toHaveAttribute('aria-current','page')
  await page.evaluate(()=>{const el=document.createElement('div');el.id='guard';el.dataset.unsaved='true';document.body.append(el)})
  const guarded=page.url();page.once('dialog',dialog=>dialog.dismiss());await choice('Personal workspace').click();assert.equal(page.url(),guarded);await selected('Virginia Volunteers')
  page.once('dialog',dialog=>dialog.accept());await choice('Personal workspace').click();await page.waitForURL('**/home');await selected('Personal');assert.equal(await header.locator('.oc-header-club').count(),0);await expect(dock.getByRole('navigation',{name:'Explore',exact:true})).toBeVisible();await expect(dock.getByRole('link',{name:'Home',exact:true})).toHaveAttribute('aria-current','page')
  await page.evaluate(()=>document.getElementById('guard').remove());await page.goBack();await selected('Virginia Volunteers');await expect(club).toHaveAccessibleName('Switch club: Virginia Volunteers');await page.goForward();await selected('Personal');await leaderChoice().click();await page.waitForURL('**/club/fixture-mii/workspace*')
  assert.equal(await page.locator('main').getAttribute('data-mount-probe'),'retained');assert.equal(calls,requests);assert.equal(await page.evaluate(()=>window.fixtureIdentityRefreshes||0),0)
  // Settings-aware club switching chooses an available destination in the next club.
  await go('owner','/club/fixture-mii/workspace?section=settings&setting=notifications');await club.click();await page.getByRole('menuitem',{name:/Virginia Volunteers/}).click();await page.waitForURL('**/club/fixture-volunteers/workspace?section=settings&setting=notifications')
  // Revocation updates all surfaces from the refreshed account rather than a copied membership list.
  await page.evaluate(()=>window.dispatchEvent(new Event('fixture:revoke-leader')));await page.waitForURL('**/home');await selected('Personal');await noRestricted()
  eligible=true;await go('platform','/platform');await selected('Admin');assert.deepEqual(await kinds(),['personal','leader','admin']);await expect(choice('Admin workspace')).toHaveAttribute('aria-current','page');await expect(dock.getByRole('link',{name:'Audit Log',exact:true})).toBeVisible();assert.equal(await modes.count(),0);assert.equal(await header.locator('.oc-header-club').count(),0);await shot('admin-desktop');const adminAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze();assert.deepEqual(adminAxe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
  const fixedBar=await header.locator('.oc-evolving-bar').boundingBox();await choice('Personal workspace').focus();await page.keyboard.press('ArrowRight');await expect(leaderChoice()).toBeFocused();await page.keyboard.press('End');await expect(choice('Admin workspace')).toBeFocused();await page.keyboard.press('Home');await expect(choice('Personal workspace')).toBeFocused();await page.keyboard.press('Enter');await page.waitForURL('**/home');await selected('Personal');await shot('three-options-personal');assert.equal((await header.locator('.oc-evolving-bar').boundingBox()).height,fixedBar.height);assert.equal((await header.locator('.oc-evolving-bar').boundingBox()).width,fixedBar.width);await leaderChoice().click();await page.waitForURL('**/club/*/workspace');await shot('three-options-leader');assert.equal((await header.locator('.oc-evolving-bar').boundingBox()).height,fixedBar.height);assert.equal((await header.locator('.oc-evolving-bar').boundingBox()).width,fixedBar.width);await choice('Admin workspace').click();await page.waitForURL('**/platform')
  eligible=false;await page.evaluate(()=>window.dispatchEvent(new Event('outclass:workspace-access-changed')));await page.waitForURL('**/home');await expect(choice('Admin workspace')).toHaveCount(0);assert.equal(await page.locator('a[href^="/platform"]').count(),0)
  await go('owner','/club/fixture-mii/workspace?section=recruitment&oneClub=1');await selected('McIntire Investment Institute');assert.equal(await header.getByRole('button',{name:/Switch club:/}).count(),0);assert.equal(await header.locator('.oc-workspace-club-switch').count(),0,'single managed club has no club picker or empty picker space');
  eligible=true;fail=true;await go('owner');await expect(choice('Admin workspace')).toHaveCount(0);fail=false
  // Phones: the pill hides; the account menu switches workspace and the bottom bar is the only section nav.
  eligible=true;await go('platform','/club/fixture-mii/workspace?section=recruitment');await page.setViewportSize({width:390,height:844})
  await expect(header.locator('.oc-product-workspaces')).toBeHidden();await expect(dock).toBeHidden()
  await expect(page.getByRole('navigation',{name:'Sections',exact:true}).getByRole('link')).toHaveText(['Club home','Recruiting','Meetings','Members'])
  await header.getByRole('button',{name:/^Account menu for/}).click();const account=page.getByRole('menu')
  await expect(account.getByRole('menuitem',{name:'McIntire Investment Institute club workspace'})).toHaveAttribute('aria-current','page')
  await expect(account.getByRole('menuitem',{name:'Virginia Volunteers club workspace'})).toBeVisible();await expect(account.getByRole('menuitem',{name:'Admin workspace'})).toBeVisible()
  await account.getByRole('menuitem',{name:'Personal workspace'}).click();await page.waitForURL('**/home');await expect(page.getByRole('navigation',{name:'Sections',exact:true}).getByRole('link')).toHaveText(['Home','Explore','Applications','My Clubs'])
  await page.setViewportSize({width:1600,height:1000});await header.getByRole('button',{name:/^Account menu for/}).click();await expect(page.getByRole('menu').getByRole('menuitem',{name:'Personal workspace'})).toBeVisible();await page.keyboard.press('Escape')
  // Workspaces stay readable and reachable at narrow widths and 200% zoom.
  for(const role of ['student','owner','platform']){
   eligible=role==='platform';await go(role,role==='student'?'/':'/club/fixture-mii/workspace?section=recruitment')
   if(role==='owner')await header.locator('.oc-header-club-name').evaluate(el=>el.textContent='McIntire Investment Institute and Interdisciplinary Research Association')
   for(const width of [1920,1600,1440,1280,1024,900,720,540,430,390,360,320]){
    await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready)
    assert.equal(await header.evaluate(el=>{const rects=Array.from(el.querySelectorAll('a,button')).map(n=>n.getBoundingClientRect()).filter(r=>r.width>0);return rects.every(r=>r.left>=0&&r.right<=innerWidth+.5&&r.height>=44)&&rects.every((a,i)=>rects.slice(i+1).every(b=>a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5))}),true,`${role} controls do not overlap at ${width}`)
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth?null:Array.from(document.body.querySelectorAll('*')).map(el=>({tag:el.tagName,cls:el.className,x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right})).filter(item=>item.right>innerWidth+.5).slice(0,8));assert.equal(overflow,null,`${role}: no horizontal overflow at ${width}: ${JSON.stringify(overflow)}`)
    if(width===390){await shot(`${role}-mobile`);const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])}
   }
  }
  await page.setViewportSize({width:1600,height:1000});await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await workspaces.locator('.oc-evolving-indicator').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','best-practice']).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
  assert.deepEqual(errors,[]);await context.close()
 }finally{await browser?.close();await fixture.close()}
})
