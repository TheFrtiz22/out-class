/** Local public QA: deterministic browser clocks inspect every real rendered cursor target. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { chromium, webkit } = require('playwright')
const base = process.env.OUTCLASS_LANDING_BASE_URL || 'http://127.0.0.1:3015'
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('Run demonstration QA against a local preview only.')
const engine = process.env.OUTCLASS_LANDING_BROWSER === 'webkit' ? webkit : chromium
const output = process.env.OUTCLASS_LANDING_QA_DIR || '/tmp/outclass-autoplay-qa'
fs.mkdirSync(output,{ recursive:true })
function load(file) {
  const mod = { exports:{} }
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{ compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 } }).outputText
  new Function('require','module','exports',code)(name=>load(path.join(path.dirname(file),`${name}.tsx`)),mod,mod.exports)
  return mod.exports
}
const { demoTimelines } = load('components/landing/demo-timelines.ts')
const scenes = { student:['discover','apply','student-interview','status','join'], leader:['build','recruit','review','leader-interview','decide','manage'] }

async function verify() {
  const browser = await engine.launch({ headless:true,...(engine === chromium ? { channel:'chrome' } : {}) })
  const errors=[], hydration=[], mutations=[], results=[]
  const watch = page => {
    page.on('pageerror',error=>errors.push(error.message))
    page.on('console',message=>{ if (message.type()==='error' && /hydrat|server rendered HTML|didn.t match/i.test(message.text())) hydration.push(message.text()) })
    page.on('request',request=>{ if(request.method() !== 'GET' && new URL(request.url()).pathname.startsWith('/api/')) mutations.push(request.url()) })
  }
  const context = await browser.newContext({ viewport:{width:1440,height:1000} })
  await context.addInitScript(() => {
    window.audiencePaints=[]
    const inspect=()=>{const el=document.querySelector('.oc-landing[data-landing-audience]');if(el&&getComputedStyle(el).visibility==='visible'&&window.audiencePaints.at(-1)!==el.dataset.landingAudience)window.audiencePaints.push(el.dataset.landingAudience);requestAnimationFrame(inspect)}
    requestAnimationFrame(inspect)
  })
  try {
    const page=await context.newPage(); watch(page)
    page.setDefaultTimeout(15000)
    const settled = async expected => {
      await page.waitForFunction(a=>document.querySelectorAll('#product-journey').length===1&&document.querySelector('#product-journey')?.dataset.perspective===a,expected)
      await page.evaluate(()=>document.fonts.ready)
      assert.equal(await page.locator(`[data-perspective-option="${expected}"]`).evaluateAll(els=>els.every(el=>el.getAttribute('aria-pressed')==='true')),true)
    }
    await page.goto(base,{waitUntil:'networkidle'}); await settled('leader')
    assert.equal(await page.locator('[data-demo-scene]').count(),6)
    assert.equal(await page.locator('[data-demo-playing="true"]').count(),0)
    assert.deepEqual(await page.evaluate(()=>window.audiencePaints),['leader'])
    await page.locator('.oc-journey-controls [data-perspective-option="student"]').click()
    await settled('student')
    assert.equal(await page.evaluate(()=>localStorage.getItem('outclass-landing-audience')),'students')
    const response=await page.goto(base,{waitUntil:'networkidle'}); await settled('student')
    assert.match(await response.text(),/class="oc-landing"[^>]*data-landing-audience="student"/)
    assert.deepEqual(await page.evaluate(()=>window.audiencePaints),['student'])
    await page.goto(`${base}/?audience=leader`,{waitUntil:'networkidle'}); await settled('leader')
    await page.goto(`${base}/#students`,{waitUntil:'networkidle'}); await settled('student')
    assert.deepEqual(await page.evaluate(()=>window.audiencePaints),['student'])
    await page.goto(`${base}/?audience=student#club-leaders`,{waitUntil:'networkidle'}); await settled('leader')
    console.log('PASS leader first visit, synchronized toggles, persisted manual choice, SSR preference, URL precedence and no audience flash')

    const storageOnly=await browser.newContext({viewport:{width:390,height:844}})
    await storageOnly.addInitScript(()=>localStorage.setItem('outclass-landing-audience','students'))
    const storagePage=await storageOnly.newPage();watch(storagePage)
    await storagePage.goto(base,{waitUntil:'networkidle'})
    await storagePage.waitForFunction(()=>document.querySelector('#product-journey')?.dataset.perspective==='student')
    await storageOnly.close()
    const blocked=await browser.newContext()
    await blocked.addInitScript(()=>{const read=Storage.prototype.getItem,write=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='outclass-landing-audience')throw Error('Storage unavailable');return read.call(this,key)};Storage.prototype.setItem=function(key,value){if(key==='outclass-landing-audience')throw Error('Storage unavailable');return write.call(this,key,value)}})
    const blockedPage=await blocked.newPage();watch(blockedPage)
    await blockedPage.goto(base,{waitUntil:'networkidle'})
    await blockedPage.waitForFunction(()=>document.querySelector('#product-journey')?.dataset.perspective==='leader')
    await blockedPage.locator('.oc-journey-controls [data-perspective-option="student"]').click()
    await blockedPage.waitForFunction(()=>document.querySelector('#product-journey')?.dataset.perspective==='student')
    await blocked.close()
    console.log('PASS storage-only preference and graceful blocked preference storage')

    // Browser clocks apply to the entire context. Keep preference pages with
    // already-mounted native clocks out of the controlled playback context.
    const playbackContext=await browser.newContext({viewport:{width:1440,height:1000}})
    const playback=await playbackContext.newPage();watch(playback)
    // Install before the controllers mount, retaining natural frames for native scroll and screenshots.
    await playback.clock.install()
    const openPlayback=async audience=>{
      await playback.clock.resume()
      await playback.goto(`${base}/?audience=${audience}#top`,{waitUntil:'networkidle'})
      await playback.waitForFunction(a=>document.querySelectorAll('#product-journey').length===1&&document.querySelector('#product-journey')?.dataset.perspective===a,audience)
      await playback.evaluate(()=>document.fonts.ready)
      // Once mounted, advance only explicitly so browser workload cannot move
      // a 160ms press past its assertion while screenshots are being written.
      await playback.clock.pauseAt(await playback.evaluate(()=>Date.now())+100)
    }
    const frame=scene=>playback.locator(`[data-demo-scene="${scene}"]`)
    const elapsed=async scene=>frame(scene).locator('.oc-demo-progress-fill').evaluate((el,duration)=>Number(el.style.transform.match(/scaleX\(([^)]+)\)/)?.[1]??1)*duration,demoTimelines[scene].duration)
    const show=async scene=>{
      await frame(scene).evaluate(el=>{const b=el.getBoundingClientRect();scrollTo({top:scrollY+b.top-Math.max(112,(innerHeight-b.height)/2),behavior:'instant'});dispatchEvent(new Event('scroll'))})
      await playback.clock.runFor(120)
    }
    const control=(scene,prefix)=>frame(scene).getByRole('button',{name:`${prefix} ${demoTimelines[scene].title} demonstration`,exact:true})
    const clickControl=async(scene,prefix)=>{
      const button=control(scene,prefix)
      // Tall phone screenshots can leave a toolbar behind the fixed navbar.
      // Bring the real control into an uncovered position before clicking it.
      await button.evaluate(el=>{const b=el.getBoundingClientRect();if(b.top<128||b.bottom>innerHeight-16){scrollBy({top:b.top-140,behavior:'instant'});dispatchEvent(new Event('scroll'))}})
      await playback.clock.runFor(32)
      assert.equal(await button.evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2))}),true,`${scene} ${prefix} is uncovered`)
      await button.click({force:true})
    }
    const capture=async(scene,label)=>{
      await playback.locator('.oc-public-nav').evaluate(el=>{el.style.visibility='hidden'})
      let done=false
      const shot=frame(scene).screenshot({path:path.join(output,`${label}-${scene}.png`),animations:'disabled'}).finally(()=>{done=true})
      // Element captures use animation frames for stability. Advance those while
      // the demonstration itself is explicitly paused at its measured action.
      for(let i=0;i<30&&!done;i++){await playback.clock.runFor(100);await playback.waitForTimeout(30)}
      await shot
      await playback.locator('.oc-public-nav').evaluate(el=>{el.style.visibility=''})
    }
    const single=async()=>assert.ok(await playback.locator('[data-demo-playing="true"]').count()<=1,'one active demonstration')
    const pause=async scene=>{if(await frame(scene).getAttribute('data-demo-complete')!=='true'&&await frame(scene).getAttribute('data-demo-paused')!=='true')await clickControl(scene,'Pause')}
    const resume=async scene=>{if(await frame(scene).getAttribute('data-demo-paused')==='true')await clickControl(scene,'Resume')}
    for(const [width,height] of [[1440,1000],[390,844],[768,1024]]){
      await playback.setViewportSize({width,height})
      for(const audience of ['student','leader']){
        await openPlayback(audience)
        for(const scene of scenes[audience]){
          await show(scene)
          await clickControl(scene,'Replay')
          assert.ok(await elapsed(scene)<150,'replay resets actual timeline')
          const heightBefore=await frame(scene).evaluate(el=>el.getBoundingClientRect().height)
          const timeline=demoTimelines[scene]
          for(let i=0;i<timeline.beats.length;i++){
            const beat=timeline.beats[i]
            await resume(scene)
            await playback.clock.runFor(Math.max(0,beat.press+65-await elapsed(scene)))
            await pause(scene)
            const position=await frame(scene).evaluate((el,target)=>{
              const surface=el.querySelector('.oc-story-interface').getBoundingClientRect(),cursor=el.querySelector('.oc-demo-cursor').getBoundingClientRect()
              const action=[...el.querySelectorAll(`[data-demo-target="${target}"]`)].find(node=>!node.closest('[data-demo-view="false"]'))
              const box=action?.getBoundingClientRect()
              return { target:!!box, tipX:cursor.left+2,tipY:cursor.top+2,box:box&&{left:box.left,top:box.top,right:box.right,bottom:box.bottom},bounded:cursor.left>=surface.left&&cursor.right<=surface.right&&cursor.top>=surface.top&&cursor.bottom<=surface.bottom,state:Number(el.dataset.demoState),inert:el.querySelector('.oc-demo-observation').inert,opacity:getComputedStyle(el.querySelector('.oc-demo-cursor')).opacity }
            },beat.target)
            assert.equal(position.target,true,`${scene} target ${beat.target}: ${JSON.stringify(position)} at ${await elapsed(scene)}ms`)
            assert.equal(position.inert,true)
            assert.equal(position.bounded,true,`${scene} cursor stays inside interface`)
            assert.ok(position.tipX>=position.box.left-2&&position.tipX<=position.box.right+2&&position.tipY>=position.box.top-2&&position.tipY<=position.box.bottom+2,`${scene} cursor aligns with ${beat.target}`)
            assert.equal(position.state,i===0?0:timeline.beats[i-1].state,`${scene}: response follows click at ${await elapsed(scene)}ms`)
            await single()
            if(width!==768)await capture(scene,`${width}-action-${i+1}`)
            const pausedAt=await elapsed(scene)
            const pausedVisual=await frame(scene).evaluate(el=>({cursor:el.querySelector('.oc-demo-cursor').style.cssText,interface:el.querySelector('.oc-story-interface').style.cssText,state:el.dataset.demoState}))
            await playback.clock.runFor(300)
            assert.equal(await elapsed(scene),pausedAt,'progress pauses with cursor and UI')
            assert.deepEqual(await frame(scene).evaluate(el=>({cursor:el.querySelector('.oc-demo-cursor').style.cssText,interface:el.querySelector('.oc-story-interface').style.cssText,state:el.dataset.demoState})),pausedVisual,'cursor and response opacity pause with progress')
            await resume(scene)
            await playback.clock.runFor(Math.max(0,beat.respond+600-await elapsed(scene)))
            await pause(scene)
            assert.equal(await frame(scene).getAttribute('data-demo-state'),String(beat.state))
            assert.ok(Math.abs(await frame(scene).evaluate(el=>el.getBoundingClientRect().height)-heightBefore)<1,`${scene}: reserved layout`)
          }
          await resume(scene)
          await playback.clock.runFor(timeline.duration-await elapsed(scene)+100)
          assert.equal(await frame(scene).getAttribute('data-demo-complete'),'true')
          assert.equal(await frame(scene).locator('[role="progressbar"]').getAttribute('aria-valuenow'),'100')
          const finished=await elapsed(scene)
          await playback.clock.runFor(1000)
          assert.equal(await elapsed(scene),finished,'completed timeline never loops')
          assert.equal(await frame(scene).getAttribute('data-demo-playing'),'false')
          await capture(scene,`${width}-completed`)
          assert.equal(await playback.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
          results.push({width,height,audience,scene,duration:timeline.duration,targets:timeline.beats.map(beat=>beat.target),complete:true})
          console.log(`PASS ${scene}: ${timeline.beats.length} aligned actions, ${timeline.duration/1000}s, ${width}px`)
        }
      }
    }
    console.log('PASS all eleven scenes on desktop, tablet and phone, shared progress, observational interfaces and no layout shifts')

    await playback.setViewportSize({width:1440,height:1000})
    await openPlayback('leader')
    await show('build');await clickControl('build','Replay')
    await pause('build')
    await control('build','Replay').focus()
    await playback.keyboard.press('Tab')
    assert.equal(await playback.evaluate(()=>!!document.activeElement.closest('.oc-demo-observation')),false,'Tab skips the observational interface')
    await show('build')
    const unchanged=await elapsed('build')
    const target=frame('build').locator('[data-demo-target="edit-profile"]')
    const targetBox=await target.boundingBox()
    assert.ok(targetBox.y>=104&&targetBox.y+targetBox.height<=1000,'observational click target is on screen')
    await playback.mouse.click(targetBox.x+targetBox.width/2,targetBox.y+targetBox.height/2)
    assert.equal(await elapsed('build'),unchanged,'real clicks do not operate miniature controls')
    assert.equal(await frame('build').getAttribute('data-demo-state'),'0')
    for(let i=0;i<12;i++)await clickControl('build','Replay')
    await playback.clock.runFor(1500);await single()
    assert.ok(await elapsed('build')<2000)
    await playback.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))})
    const hidden=await elapsed('build')
    await playback.clock.runFor(5000)
    assert.equal(await elapsed('build'),hidden,'hidden document pauses playback')
    await playback.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))})
    await playback.clock.runFor(500)
    assert.ok(await elapsed('build')>hidden)
    await playback.evaluate(()=>{scrollTo({top:0,behavior:'instant'});dispatchEvent(new Event('scroll'))})
    await playback.clock.runFor(100)
    const offscreen=await elapsed('build');await playback.clock.runFor(3000)
    assert.equal(await elapsed('build'),offscreen)
    await show('build');await playback.clock.runFor(500)
    assert.ok(await elapsed('build')>offscreen,'reverse scrolling resumes without restarting')
    await playback.locator('.oc-public-journey-desktop [data-perspective-option="student"]').click({force:true})
    await playback.waitForFunction(()=>document.querySelector('#product-journey')?.dataset.perspective==='student')
    assert.equal(await frame('build').count(),0)
    for(const top of [3000,800,7500,2000,0]){await playback.evaluate(y=>{scrollTo({top:y,behavior:'instant'});dispatchEvent(new Event('scroll'))},top);await playback.clock.runFor(80);await single()}
    console.log('PASS repeated Replay, simulated tab visibility, offscreen pause, reverse/rapid scrolling and audience cancellation')

    await playback.emulateMedia({reducedMotion:'reduce'})
    for(const [width,height] of [[320,844],[1024,768],[844,390]]){
      await playback.setViewportSize({width,height})
      for(const audience of ['student','leader']){
        await openPlayback(audience)
        for(const scene of scenes[audience]){
          await show(scene)
          assert.equal(await frame(scene).getAttribute('data-demo-complete'),'true')
          assert.equal(await frame(scene).locator('.oc-demo-cursor').evaluate(el=>getComputedStyle(el).display),'none')
          await clickControl(scene,'Replay')
          assert.equal(await frame(scene).getAttribute('data-demo-complete'),'true')
          assert.equal(await playback.locator('[data-demo-playing="true"]').count(),0)
          assert.equal(await playback.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
        }
      }
    }
    console.log('PASS completed reduced-motion previews, accessible Replay and narrow/tablet/landscape layouts')
    assert.deepEqual(errors,[]);assert.deepEqual(hydration,[]);assert.deepEqual(mutations,[])
    fs.writeFileSync(path.join(output,'autoplay-verification.json'),JSON.stringify({engine:engine===chromium?'chrome':'webkit',results,errors,hydration,mutations,visibility:'Browser document.hidden and visibilitychange simulated',onlyOneActive:true},null,2))
    console.log('PASS no browser errors, hydration warnings or API mutations')
  } finally { await context.close();await browser.close() }
}
module.exports={verify}
if(require.main===module)verify().catch(error=>{console.error(error);process.exitCode=1})
