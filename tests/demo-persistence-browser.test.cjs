const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright'),{fixture}=require('./helpers/demo-persistence-fixture.cjs')
test('production React Demo question opening, continuous input, reload and cross-tab persistence',async()=>{
 const f=await fixture(),browser=await chromium.launch({channel:'chrome',headless:true});let context
 const samples=[],out=process.env.OUTCLASS_DEMO_PERF_OUT
 try{
  for(const condition of ['fresh context','warm']){
   context=await browser.newContext();await context.addInitScript(()=>{window.snapshotWrites=0;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='outclass.presentation.v1')window.snapshotWrites++;return set.call(this,k,v)}})
   if(out&&condition==='warm')await context.tracing.start({screenshots:true,snapshots:true,sources:false})
   let page=await context.newPage();await page.route('**/*',r=>r.request().url().startsWith(f.url)?r.continue():r.abort())
   await page.goto(f.url+'/?interviewTiming=1');const bank=()=>page.getByRole('region',{name:'Available questions'}).getByRole('button');await bank().first().waitFor()
   for(let i=0;i<5;i++){
    if(condition==='fresh context'&&i){await context.close();context=await browser.newContext();page=await context.newPage();await page.goto(f.url+'/?interviewTiming=1');await bank().first().waitFor()}
    await bank().nth(i%3).click();const notes=page.getByRole('textbox',{name:'Your private notes',exact:true});await notes.waitFor();await page.waitForFunction(()=>document.querySelector('[data-question-open-ms]')?.dataset.questionEditorFocused==='true'&&document.activeElement?.tagName==='TEXTAREA')
    const ms=Number(await page.locator('[data-question-open-ms]').getAttribute('data-question-open-ms'));samples.push({condition,ms});assert.equal(await notes.evaluate(el=>el===document.activeElement),true)
    if(i<4)await page.getByRole('button',{name:'Back to question bank',exact:true}).click()
   }
   if(condition==='warm'){
    const suffix='Continuous synthetic typing: CAPS, punctuation! 123',original=await page.getByRole('textbox',{name:'Your private notes',exact:true}).inputValue();await page.getByRole('button',{name:'Back to question bank',exact:true}).click();await bank().nth(1).click();await page.keyboard.type(suffix,{delay:0});const text=await page.getByRole('textbox',{name:'Your private notes',exact:true}).inputValue();assert.equal(text.replace(suffix,''),original);assert.equal(text.split(suffix).length,2)
    await page.getByText('All changes saved',{exact:true}).waitFor();await page.reload();await page.getByRole('textbox',{name:'Your private notes',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Your private notes',exact:true}).inputValue(),text)
    if(!process.env.OUTCLASS_DEMO_BASELINE){
     const peer=await context.newPage();await peer.goto(f.url+'/?interviewTiming=1');await peer.getByRole('textbox',{name:'Your private notes',exact:true}).waitFor()
     await page.getByRole('button',{name:'Read unchanged room',exact:true}).click()
     await page.evaluate(()=>{window.snapshotWrites=0;document.documentElement.dataset.demoNotifications='0'})
     for(let i=0;i<3;i++)await page.getByRole('button',{name:'Read unchanged room',exact:true}).click()
     assert.equal(await page.evaluate(()=>window.snapshotWrites),0);assert.equal(await page.locator('html').getAttribute('data-demo-notifications'),'0')
     await page.getByRole('textbox',{name:'Your private notes',exact:true}).focus();await peer.getByRole('button',{name:'Back to question bank',exact:true}).click();await peer.getByRole('region',{name:'Available questions'}).getByRole('button').nth(2).click()
     await page.getByRole('button',{name:'Open question',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Your private notes',exact:true}).inputValue(),text)
     await page.getByRole('button',{name:'Read unchanged room',exact:true}).click();assert.equal(await page.evaluate(()=>window.snapshotWrites),0);assert.equal(await page.locator('html').getAttribute('data-demo-notifications'),'1')
     await peer.close()
    }
    if(out)await context.tracing.stop({path:out.replace(/\.json$/,'.trace.zip')})
   }
   await context.close();context=null
  }
  if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({browser:await browser.version(),nodeProbe:false,environment:'Loopback production React, actual Demo provider/adapters and question UI; no hosted Auth/backend or full Next shell; fresh-context is first editor, not OS-cold',samples},null,2))}
  console.log('Question focus samples:',JSON.stringify(samples))
 }finally{await context?.close();await browser.close();await f.close()}
})
