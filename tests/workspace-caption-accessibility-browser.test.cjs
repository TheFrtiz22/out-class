const {test}=require('node:test'),assert=require('node:assert/strict')
const {chromium}=require('playwright'),{expect}=require('playwright/test'),AxeBuilder=require('@axe-core/playwright').default
const {startDockFixture}=require('./helpers/expanding-dock-browser.cjs')

test('workspace pill segments have names that include their visible labels, with valid ARIA',async()=>{
 const fixture=await startDockFixture();let browser
 try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext(),page=await context.newPage()
  await page.route('**/api/platform/eligibility',route=>route.fulfill({status:200,contentType:'application/json',body:'{"eligible":true}'}))
  await page.goto(fixture.base+'/platform?role=platform',{waitUntil:'networkidle'})
  const pill=page.getByRole('navigation',{name:'Workspaces',exact:true})
  await expect(pill.getByRole('link',{name:'Admin workspace',exact:true})).toHaveAttribute('aria-current','page')
  await expect(pill.getByRole('link')).toHaveText(['Personal','MII','Admin'])
  assert.deepEqual(await pill.getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('aria-label'))),['Personal workspace','MII, McIntire Investment Institute club workspace','Admin workspace'])
  for(const width of [1280,320]){
   await page.setViewportSize({width,height:900})
   const result=await new AxeBuilder({page}).withRules(['aria-prohibited-attr','label-content-name-mismatch']).analyze()
   assert.deepEqual(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[])
  }
 }finally{await browser?.close();await fixture.close()}
})
