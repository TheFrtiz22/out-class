// Actual app, reserved local synthetic accounts. No production credentials or writes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict')
const {chromium}=require('playwright'),{PrismaClient}=require('@prisma/client')
const {Actor,readConfig}=require('../tests/helpers/onboarding-e2e.cjs')
const c=readConfig(path.join(os.tmpdir(),'outclass-dashboards-e2e/config.json'))
const f=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'outclass-dashboards-e2e/visual-fixture.json')))
const base='http://127.0.0.1:3116',out=path.resolve('docs/header-refinements/evidence')
fs.mkdirSync(out,{recursive:true})
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))})}
async function run(){
 const browser=await chromium.launch(),db=new PrismaClient({datasourceUrl:c.status.DB_URL}),contexts={},results=[]
 try{
  const draft=await db.application.findFirst({where:{studentId:f.actors.student.id,status:'DRAFTING'},select:{id:true}})
  assert.ok(draft,'Use the synthetic student draft fixture')
  for(const role of ['owner','student']){const actor=new Actor(c);await actor.signIn(f.actors[role].credentials.email,f.actors[role].credentials.password);contexts[role]=await browser.newContext({reducedMotion:'reduce'});await contexts[role].addCookies([...actor.cookies].map(([name,value])=>({name,value,url:base})))}
  contexts.public=await browser.newContext({reducedMotion:'reduce'})
  for(const width of [1440,1280,768,390]){
   const publicPage=await contexts.public.newPage();await publicPage.setViewportSize({width,height:900})
   for(const audience of ['student','leader']){
    const record={name:'landing-'+audience,width,errors:[],slides:[]};publicPage.on('pageerror',e=>record.errors.push(e.message))
    try{
     await publicPage.goto(base+'/?audience='+audience,{waitUntil:'networkidle',timeout:90000});await settle(publicPage)
     for(let index=0;index<6;index++){
      await publicPage.waitForFunction(()=>{const el=document.querySelector('.oc-feature-card[aria-hidden="false"]');return el && getComputedStyle(el).opacity==='1' && getComputedStyle(el.firstElementChild).opacity==='1'})
      await settle(publicPage)
      const card=publicPage.locator('.oc-feature-card[aria-hidden="false"]')
      const g=await card.evaluate(el=>{const ink=el.querySelector('.oc-feature-statement').getBoundingClientRect(),box=el.getBoundingClientRect(),category=el.querySelector('.oc-feature-category').getBoundingClientRect();return {text:el.textContent.trim(),left:ink.left-box.left,right:box.right-ink.right,bottom:box.bottom-ink.bottom,aligned:Math.abs(category.left-ink.left)<1}})
      assert.ok(g.left>=16 && g.right>=16 && g.bottom>=16,JSON.stringify(g));assert.ok(g.aligned)
      record.slides.push(g)
      if(index===2)await publicPage.screenshot({path:path.join(out,`landing-${audience}-${width}.jpg`),quality:85})
      await publicPage.getByRole('button',{name:'Next feature',exact:true}).click()
     }
     assert.ok(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
     console.log('PASS',record.name,width)
    }catch(e){record.failure=e.message;console.log('FAIL',record.name,width,e.message.slice(0,150))}
    results.push(record)
   }
   await publicPage.close()
   const screens=[['home','student','/?workspace=student'],['recruiting','owner',`/club/${f.clubId}/workspace?section=recruitment&tool=overview`],['application','student',`/?workspace=student&view=tracker&section=applications&applicationId=${draft.id}`],['corkboard','student','/?workspace=student&view=corkboard']]
   for(const [name,role,url] of screens){const p=await contexts[role].newPage(),record={name,width,errors:[]};p.on('pageerror',e=>record.errors.push(e.message));await p.setViewportSize({width,height:900})
    try{
     await p.goto(base+url,{waitUntil:'networkidle',timeout:90000});await settle(p)
     await p.locator('[data-slot="loading-state"],.oc-dashboard-loading').filter({visible:true}).waitFor({state:'hidden',timeout:30000})
     if(name==='home'){await p.getByRole('heading',{name:'Home',exact:true}).waitFor();assert.equal(await p.locator('.oc-home-header').evaluate(el=>getComputedStyle(el,'::after').content),'none');assert.equal(await p.getByText('Your campus,').count(),0)}
     if(name==='recruiting'){assert.equal(await p.getByRole('heading',{level:1,name:'Recruitment',exact:true}).count(),1);await p.locator('.oc-recruiting-status').waitFor();assert.equal(await p.locator('.oc-recruitment-masthead').count(),0);record.intake=await p.locator('.oc-recruiting-status').innerText();await Promise.all([p.waitForResponse(r=>r.url().includes('/api/workspace')),p.getByRole('button',{name:'Refresh overview',exact:true}).click()]);await p.waitForFunction(()=>document.querySelector('.oc-command-refresh')?.getAttribute('aria-busy')!=='true')}
     if(name==='application'){await p.locator('[data-application-form]').waitFor();assert.equal(await p.locator('[data-application-form] [data-slot="progress"]').count(),0);assert.match(await p.locator('.oc-writing-progress').innerText(),/required responses ready|No required questions/);record.responses=await p.locator('textarea').count()}
     if(name==='corkboard'){
      await p.getByRole('heading',{level:1,name:'Virtual Corkboard',exact:true}).waitFor();assert.equal(await p.getByRole('heading',{name:'Events on Grounds',exact:true}).count(),0)
      const toolbar=p.locator('.oc-event-toolbar-actions');assert.ok(await toolbar.getByRole('button',{name:'Saved Clubs',exact:true}).isVisible());assert.ok(await toolbar.getByRole('group',{name:'Event view'}).isVisible())
      const search=await p.getByRole('textbox',{name:'Search events',exact:true}).boundingBox(),view=await p.getByRole('group',{name:'Event view'}).boundingBox(),saved=await p.getByRole('button',{name:'Saved Clubs',exact:true}).boundingBox()
      record.toolbar={search,view,saved};if(width>=1280){assert.ok(Math.abs(search.y+search.height/2-view.y-view.height/2)<2);assert.ok(Math.abs(search.y+search.height/2-saved.y-saved.height/2)<2)}
      await p.getByRole('button',{name:'List View',exact:true}).click();assert.equal(await p.getByRole('button',{name:'List View',exact:true}).getAttribute('aria-pressed'),'true')
      await p.getByRole('button',{name:'Saved Clubs',exact:true}).click();await p.getByRole('button',{name:'Close saved clubs',exact:true}).waitFor();await p.getByRole('button',{name:'Close saved clubs',exact:true}).click();await toolbar.getByRole('button',{name:'Corkboard',exact:true}).click()
     }
     await settle(p);record.pageWidth=await p.evaluate(()=>document.documentElement.scrollWidth);assert.ok(record.pageWidth<=width+1,'Horizontal overflow');await p.screenshot({path:path.join(out,`${name}-${width}.jpg`),quality:85,fullPage:false});assert.deepEqual(record.errors,[]);console.log('PASS',name,width)
    }catch(e){record.failure=e.message;console.log('FAIL',name,width,e.message.slice(0,160));await p.screenshot({path:path.join(out,`${name}-${width}-failure.jpg`),quality:85,fullPage:false}).catch(()=>{})}
    finally{await p.close()}
    results.push(record);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2))
   }
  }
 }finally{await browser.close();await db.$disconnect()}
 if(results.some(r=>r.failure||r.errors.length))process.exitCode=1
}
run().catch(e=>{console.error(e.message);process.exitCode=1})
