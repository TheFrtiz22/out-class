const {test,before,after}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {chromium}=require('playwright')
const {expect}=require('playwright/test')
const AxeBuilder=require('@axe-core/playwright').default
const {startFixture}=require('./helpers/application-writing-fixture.cjs')
let fixture,browser
const output=path.resolve('test-results/application-writing')
before(async()=>{fs.mkdirSync(output,{recursive:true});fixture=await startFixture();browser=await chromium.launch({headless:true})})
after(async()=>{await browser?.close();await fixture?.close()})
for(const width of [1440,1024,768,390]) test(`application writing: ${width}px, first field, reflow, accessible controls and shell`,async()=>{
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  try {
    await page.goto(fixture.url);const field=page.getByRole('textbox',{name:'Why would you like to join Campus Consulting Group?'})
    await field.waitFor();await expect(field).toHaveValue('I enjoy bringing curious people together.')
    await page.evaluate(()=>window.scrollTo(0,0))
    const box=await field.boundingBox()
    assert.ok(box.y<500,`First response starts at ${box.y}px`)
    assert.ok(box.height>=224,`Response height: ${box.height}px`)
    assert.ok(box.y+box.height<=900,'First full response field fits in the viewport')
    if(width===1440)assert.ok(box.width>850,'Desktop writing area uses available width')
    assert.ok(await page.locator('.oc-product-header').isVisible())
    assert.ok(await page.getByRole('navigation',{name:'Workspaces',exact:true}).count())
    assert.equal(await page.locator('.oc-writing-profile').getAttribute('open'),null)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    assert.equal(await page.locator('.oc-writing-actions').evaluate(el=>getComputedStyle(el).position),'static')
    const result=await new AxeBuilder({page}).include('#workspace-content').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()
    fs.writeFileSync(path.join(output,`axe-${width}.json`),JSON.stringify(result.violations,null,2))
    assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[])
    await page.screenshot({path:path.join(output,`after-${width}.png`),fullPage:true})
    assert.deepEqual(errors,[])
  } finally {await context.close()}
})
test('application writing: missing profile requirements stay actionable and closed intake still allows drafts',async()=>{
  for(const query of ['&missing=1','&missingScores=1','&closed=1']){
    const context=await browser.newContext(),page=await context.newPage()
    try{
      await page.goto(fixture.url+query);await page.locator('textarea').waitFor()
      if(query.includes('closed')){
        await expect(page.getByRole('button',{name:'Review & submit',exact:true})).toBeDisabled()
        await expect(page.getByRole('button',{name:'Save draft',exact:true})).toBeEnabled()
        await expect(page.locator('textarea')).toBeEnabled()
      }else{
        const warning=page.getByRole('note',{name:'Missing profile requirements'})
        await warning.waitFor();await warning.getByRole('button',{name:'Update profile'}).click()
        await page.waitForFunction(()=>window.profileOpened==='student-profile')
      }
    }finally{await context.close()}
  }
})
test('application writing: real autosave, manual save, navigation, validation, confirmation and read-only submission',async()=>{
  const context=await browser.newContext(),page=await context.newPage()
  try {
    await page.goto(fixture.url)
    const field=page.locator('#answer-essay');await field.fill('A thoughtful response in my own words.')
    await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor()
    assert.equal(fixture.answers().find(a=>a.questionId==='essay').response,'A thoughtful response in my own words.')
    assert.equal(fixture.writes.some(w=>w.path==='/submit'),false)
    await page.reload();await expect(field).toHaveValue('A thoughtful response in my own words.')
    await page.getByRole('button',{name:'Go to question 2',exact:true}).click();await expect(page.locator('#answer-team')).toBeFocused()
    await page.getByRole('button',{name:'Review & submit',exact:true}).click()
    await expect(page.locator('#answer-team')).toBeFocused();await expect(page.locator('#answer-team')).toHaveAttribute('aria-invalid','true')
    assert.equal(await page.getByRole('dialog').count(),0)
    await page.locator('#answer-team').selectOption('Community')
    await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Draft saved to your account.').waitFor()
    await page.locator('summary').filter({hasText:'Shared profile & requirements'}).click();await page.getByRole('button',{name:'Review your profile',exact:true}).waitFor()
    await page.getByRole('button',{name:'Review & submit',exact:true}).click();await page.getByRole('dialog').waitFor()
    assert.equal(fixture.writes.some(w=>w.path==='/submit'),false)
    await page.getByRole('button',{name:'Submit application',exact:true}).click();await page.getByRole('region',{name:'Submitted responses'}).waitFor()
    assert.equal(fixture.writes.filter(w=>w.path==='/submit').length,1)
    assert.equal(await page.locator('textarea').count(),0)
    assert.ok(await page.getByText('A thoughtful response in my own words.',{exact:true}).isVisible())
  } finally {await context.close()}
})
