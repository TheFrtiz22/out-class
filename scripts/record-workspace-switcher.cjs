// Review artifact only: actual shell/CSS with fictional local auth and records.
const fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright')
const {startDockFixture}=require('../tests/helpers/expanding-dock-browser.cjs')
;(async()=>{
 const fixture=await startDockFixture();let browser
 try{
  browser=await chromium.launch({headless:true,...(!require('node:fs').existsSync(chromium.executablePath())?{channel:'chrome'}:{})})
  const destination=path.resolve('docs/workspace-switcher/previews');await fs.mkdir(destination,{recursive:true})
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:'/tmp/outclass-workspace-demo',size:{width:1440,height:900}}})
  const page=await context.newPage();await page.route('**/api/platform/eligibility',route=>route.fulfill({json:{eligible:true}}))
  await page.goto(`${fixture.base}/?role=platform`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready)
  const workspace=page.locator('header').getByRole('navigation',{name:'Workspaces',exact:true})
  const pause=()=>page.waitForTimeout(1500)
  await pause();await workspace.getByRole('link',{name:'Club Leader',exact:true}).click();await pause()
  await page.locator('header').getByRole('button',{name:/Switch club:/}).click();await pause()
  await page.getByRole('menuitem',{name:/Virginia Volunteers/}).click();await pause()
  const modes=page.locator('header').getByRole('navigation',{name:'Product modes',exact:true})
  await modes.getByRole('link',{name:'Recruiting',exact:true}).click();await pause()
  await page.locator('aside').getByRole('button',{name:'Applicants',exact:true}).hover();await pause()
  await page.mouse.move(1100,600);await page.locator('main').focus();await pause()
  await workspace.getByRole('link',{name:'Admin',exact:true}).click();await pause()
  await workspace.getByRole('link',{name:'Personal',exact:true}).click();await pause()
  const video=page.video();await context.close();await video.saveAs(path.join(destination,'workspace-transitions.webm'));console.log('Saved fictional workspace transition demonstration.')
 }finally{await browser?.close();await fixture.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
