// Real local app + reserved synthetic accounts. Hold reads in Playwright, never in product code.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), assert = require("node:assert/strict")
const { chromium } = require("playwright")
const { readConfig, Actor } = require("../tests/helpers/onboarding-e2e.cjs")
const c = readConfig(path.join(os.tmpdir(), "outclass-dashboards-e2e/config.json"))
const f = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "outclass-dashboards-e2e/visual-fixture.json")))
const port = process.env.LOADING_PORT || "3116"
assert.ok(["3115", "3116"].includes(port), "Only reserved local test ports are allowed")
const base = `http://127.0.0.1:${port}`, phase = process.argv[2] || "after"
const out = path.resolve("docs/loading-design/evidence", phase)
fs.mkdirSync(out, { recursive: true })
const club = section => `/club/${f.clubId}/workspace?section=${section}`
const screens = [
 ["applicants", "owner", club("recruitment") + "&tool=applicants"],
 ["applications", "student", "/?workspace=student&view=tracker"],
 ["recruiting", "owner", club("recruitment") + "&tool=overview"],
 ["settings", "owner", club("settings") + "&setting=application"],
 ["members", "owner", club("settings") + "&setting=members"],
 ["interview", "reviewer", club("recruitment") + `&tool=interviews&applicationId=${f.focusedApplicationId || f.applicationId}&roundId=${f.roundId}&bookingId=${f.bookingId}&interview=1`],
 ["letter", "student", `/applications/${f.loadingLetterApplicationId || f.applicationId}/decision`],
]
async function settleMotion(page) {
 await page.evaluate(async()=>{
  await document.fonts.ready
  await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))
 })
}
async function run() {
 const browser = await chromium.launch(), contexts = {}, results = fs.existsSync(path.join(out,"results.json")) ? JSON.parse(fs.readFileSync(path.join(out,"results.json"))) : []
 try {
  for (const role of ["owner", "student", "reviewer"]) {
   const actor = new Actor(c), {email, password} = f.actors[role].credentials
   await actor.signIn(email, password)
   const context = await browser.newContext()
   await context.addCookies([...actor.cookies].map(([name,value])=>({name,value,url:base})))
   contexts[role] = context
  }
  for (const width of (process.env.LOADING_WIDTHS || "1440,1280,768,390").split(",").map(Number)) for (const [name,role,route] of screens) {
   if(process.env.LOADING_ONLY && !process.env.LOADING_ONLY.split(",").includes(name)) continue
   const page = await contexts[role].newPage(), errors = [], requests = []
   page.on("pageerror", e=>errors.push(e.stack || e.message))
   await page.setViewportSize({width,height:900})
   let release; const gate = new Promise(resolve=>release=resolve); let holding = true
   await page.route("**/*", async r => {
    const req = r.request()
    if(holding && (req.url().includes("/api/workspace") || req.headers()["next-action"])) {
     requests.push(req.url().split("?")[0].replace(base,"")); await gate
    }
    await r.continue()
   })
   const record = {name,width,errors,requests}
   try {
    await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:90000})
    const loader=page.locator('[data-slot="loading-state"],.oc-dashboard-loading').filter({visible:true}).first()
    await loader.waitFor({state:"visible",timeout:30000})
    // The network gate holds the real pending state through font loading and capture.
    await page.evaluate(()=>document.fonts.ready)
    await settleMotion(page);await page.screenshot({quality:85,path:path.join(out,`${name}-${width}-loading.jpg`),fullPage:true})
    record.loading = await loader.evaluate(el=>({layout:el.getAttribute("data-layout"),text:el.textContent,statuses:el.querySelectorAll('[role="status"]').length+Number(el.getAttribute("role")==="status"),top:el.getBoundingClientRect().top}))
    holding=false;release()
    await page.locator('[data-slot="loading-state"],.oc-dashboard-loading').filter({visible:true}).waitFor({state:"hidden",timeout:45000})
    await settleMotion(page);await page.screenshot({quality:85,path:path.join(out,`${name}-${width}-loaded.jpg`),fullPage:true})
    record.loaded = await page.evaluate(()=>({width:document.documentElement.scrollWidth,headings:[...document.querySelectorAll("h1,h2,h3")].map(e=>e.textContent),alerts:[...document.querySelectorAll('[role="alert"]')].map(e=>e.textContent)}))
    assert.ok(record.loaded.width<=width+1,"Horizontal overflow")
    assert.equal(record.loading.statuses,1,"One loading announcement per region")
    console.log(`CAPTURE ${name} ${width}: ${record.loading.layout||"dashboard"} -> loaded`)
   } catch(error) { record.failure=error.message;console.log(`FAILED ${name} ${width}: ${error.message.slice(0,150)}`);await settleMotion(page);await page.screenshot({quality:85,path:path.join(out,`${name}-${width}-failure.jpg`),fullPage:true}).catch(()=>{}) }
   finally {holding=false;release();await page.close()}
   const old=results.findIndex(r=>r.name===name&&r.width===width); if(old>=0)results.splice(old,1);results.push(record);fs.writeFileSync(path.join(out,"results.json"),JSON.stringify(results,null,2))
  }

  if(phase === "after" && (!process.env.LOADING_ONLY || process.env.LOADING_ONLY.split(",").includes("actions"))) for(const width of [1440,1280,768,390]) {
   const page=await contexts.owner.newPage();await page.setViewportSize({width,height:900})
   const record={name:"actions",width,errors:[]}
   page.on("pageerror",e=>record.errors.push(e.message))
   try {
    await page.goto(base+club("recruitment")+"&tool=overview",{waitUntil:"networkidle"})
    const button=page.getByRole("button",{name:"Refresh overview",exact:true})
    await button.waitFor();const before=await button.boundingBox()
    const headings=await page.locator("h2").allTextContents()
    let release;const gate=new Promise(resolve=>release=resolve)
    await page.route("**/api/workspace?**",async r=>{await gate;await r.continue()})
    await button.click();await page.locator('[data-slot="button"][data-loading="true"]').waitFor()
    const during=await button.boundingBox()
    for(const key of ["x","y","width","height"]) assert.ok(Math.abs(before[key]-during[key])<.5,`Button ${key} changed`)
    assert.deepEqual(await page.locator("h2").allTextContents(),headings,"Refresh preserves loaded content")
    assert.equal(await page.locator('[data-slot="loading-state"],.oc-dashboard-loading').filter({visible:true}).count(),0)
    assert.equal(await button.getAttribute("aria-busy"),"true")
    record.refresh={before,during,preserved:true}
    await settleMotion(page);await page.screenshot({quality:85,path:path.join(out,`refresh-${width}-pending.jpg`),fullPage:true})
    await page.emulateMedia({reducedMotion:"reduce"})
    assert.equal(await button.locator('[data-slot="loading-indicator"]').evaluate(el=>getComputedStyle(el).animationName),"none")
    await page.emulateMedia({forcedColors:"active"})
    await settleMotion(page);await page.screenshot({quality:85,path:path.join(out,`refresh-${width}-reduced-forced.jpg`),fullPage:true})
    release();await page.unrouteAll({behavior:"wait"});await page.locator('[data-loading="true"]').waitFor({state:"hidden"})
    await page.emulateMedia({forcedColors:"none",reducedMotion:"no-preference"})
    // Network failures must release placeholders into the existing error state.
    await page.route("**/api/workspace?**",r=>r.fulfill({status:503,body:'{"error":"Synthetic test failure"}',contentType:"application/json"}))
    await page.goto(base+club("settings")+"&setting=members",{waitUntil:"networkidle"})
    await page.getByRole("alert").filter({hasText:/could not|couldn’t|access changed|try again/i}).first().waitFor()
    assert.equal(await page.locator('[data-slot="loading-state"]').filter({visible:true}).count(),0)
    await settleMotion(page);await page.screenshot({quality:85,path:path.join(out,`members-${width}-error.jpg`),fullPage:true})
    record.failureReleasesLoader=true
    await page.unrouteAll()
    // A real member dialog, with its mutation held then failed at the network boundary.
    await page.goto(base+club("settings")+"&setting=members",{waitUntil:"networkidle"})
    await page.getByRole("button",{name:"Add member",exact:true}).click()
    const dialog=page.getByRole("dialog")
    await dialog.getByLabel("UVA email").fill("loading-test-missing@virginia.edu")
    await dialog.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))))
    const submit=dialog.getByRole("button",{name:"Add member",exact:true}),rest=await submit.boundingBox()
    let fail;const actionGate=new Promise(resolve=>fail=resolve)
    await page.route("**/*",async r=>{if(r.request().headers()["next-action"]){await actionGate;await r.abort("failed")}else await r.continue()})
    await submit.click();await submit.locator('[data-slot="loading-indicator"]').waitFor()
    const pending=await submit.boundingBox();record.dialog={rest,pending}
    for(const key of ["x","y","width","height"])assert.ok(Math.abs(rest[key]-pending[key])<.5,`Modal button ${key} changed`)
    await settleMotion(page);await page.screenshot({quality:85,path:path.join(out,`member-dialog-${width}-pending.jpg`),fullPage:false})
    fail();await dialog.getByRole("alert").waitFor();await submit.locator('[data-slot="loading-indicator"]').waitFor({state:"hidden"})
    record.dialog={rest,pending,failureReleasesLoader:true}
    console.log(`PASS actions ${width}: stable refresh and modal buttons, content retained, failures resolve, reduced motion`)
   }catch(error){record.failure=error.message;console.log(`FAILED actions ${width}: ${error.message.slice(0,160)}`)}
   finally{await page.close()}
   const old=results.findIndex(r=>r.name===record.name&&r.width===width);if(old>=0)results.splice(old,1);results.push(record);fs.writeFileSync(path.join(out,"results.json"),JSON.stringify(results,null,2))
  }
 } finally {await browser.close()}
 if(results.some(r=>r.failure||r.errors.length))process.exitCode=1
}
run().catch(error=>{console.error(error.message);process.exitCode=1})
