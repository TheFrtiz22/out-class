// Actual shell, CSS, and vector artwork; fictional identity and records only.
const fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright')
const {startDockFixture}=require('../tests/helpers/expanding-dock-browser.cjs')
;(async()=>{
 const fixture=await startDockFixture();let browser
 try{
  browser=await chromium.launch({headless:true,...(!require('node:fs').existsSync(chromium.executablePath())?{channel:'chrome'}:{})})
  const destination=path.resolve('docs/header-brand/previews');await fs.mkdir(destination,{recursive:true})
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:'/tmp/outclass-header-brand',size:{width:1440,height:900}}})
  const page=await context.newPage();await page.route('**/api/platform/eligibility',route=>route.fulfill({json:{eligible:true}}))
  await page.goto(`${fixture.base}/?role=platform`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready)
  const settled=()=>page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))))
  const capture=name=>page.screenshot({path:path.join(destination,`${name}.png`),clip:{x:0,y:0,width:900,height:140}})
  await settled();await capture('personal-header');await page.waitForTimeout(800)
  await page.locator('.oc-dock-brand').hover();await settled();await capture('expanded-wordmark');await page.waitForTimeout(1500)
  await page.mouse.move(950,350);await page.locator('main').focus();await settled();await page.waitForTimeout(800)
  const workspace=page.locator('header').getByRole('navigation',{name:'Workspaces',exact:true})
  await workspace.getByRole('link',{name:'Club Leader',exact:true}).click();await settled();await capture('leader-header');await page.waitForTimeout(1200)
  await page.locator('.oc-dock-brand').focus();await settled();await page.waitForTimeout(1200)
  await page.keyboard.press('Tab');await page.mouse.move(950,350);await page.locator('main').focus();await settled()
  await workspace.getByRole('link',{name:'Personal',exact:true}).click();await settled();await page.waitForTimeout(1000)
  const video=page.video();await context.close();await video.saveAs(path.join(destination,'header-and-wordmark.webm'))
  console.log('Saved header screenshots and wordmark animation.')
 }finally{await browser?.close();await fixture.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
