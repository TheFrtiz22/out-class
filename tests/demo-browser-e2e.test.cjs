// Real Next production build + Supabase Auth + PostgreSQL on the reserved disposable stack only.
// Run through scripts/run-onboarding-e2e.cjs --keep with OUTCLASS_DEMO_ENABLED=true and
// OUTCLASS_DEMO_ALLOWED_EMAILS=<one @virginia.edu presenter address>, then point
// OUTCLASS_ONBOARDING_E2E_CONFIG at the kept stack's config.json.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { PrismaClient } = require("@prisma/client")
const { createClient } = require("@supabase/supabase-js")
const { chromium } = require("playwright")
const { Actor, readConfig, randomUUID } = require("./helpers/onboarding-e2e.cjs")
const { harness } = require("./helpers/demo-harness.cjs")

const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG
const presenter = (process.env.OUTCLASS_DEMO_ALLOWED_EMAILS || "").split(",")[0].trim().toLowerCase()
const skip = !configFile || process.env.OUTCLASS_DEMO_ENABLED !== "true" || !presenter

// Demo chunks in this build, found by strings that exist only in demo modules.
function demoChunks(buildDir) {
  const markers = { seed: "sample meeting room", store: "Demo is not active.", workspace: "Exit Demo Mode to manage campus events." }
  const found = { seed: new Set(), store: new Set(), workspace: new Set() }
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (file.endsWith(".js")) {
        const text = fs.readFileSync(file, "utf8")
        for (const [kind, marker] of Object.entries(markers)) if (text.includes(marker)) found[kind].add(path.basename(file))
      }
    }
  }
  walk(path.join(buildDir, "static/chunks"))
  return found
}
const isDemoChunk = (chunks, url) => Object.values(chunks).some(set => set.has(path.basename(new URL(url).pathname)))

// Records every empty state and loader from the first paint, so a transient empty
// state that disappears once demo data arrives is caught as a flash.
const recordStates = () => {
  window.__oc = { empty: new Set(), loaders: 0 }
  const scan = () => {
    for (const node of document.querySelectorAll('[data-slot="empty-state"]')) window.__oc.empty.add(node.textContent.trim().slice(0, 80))
    window.__oc.loaders = Math.max(window.__oc.loaders, document.querySelectorAll('[role="status"][aria-busy="true"]').length)
  }
  new MutationObserver(scan).observe(document, { childList: true, subtree: true, characterData: true })
}
async function flashes(page) {
  return page.evaluate(() => {
    const final = new Set([...document.querySelectorAll('[data-slot="empty-state"]')].map(node => node.textContent.trim().slice(0, 80)))
    return { flashed: [...window.__oc.empty].filter(text => !final.has(text)), loaders: window.__oc.loaders }
  })
}

test("Demo Mode in a real browser: no live demo chunks, first-try demo data, fail-closed load errors", { skip, timeout: 300000 }, async t => {
  const config = readConfig(configFile)
  const chunks = demoChunks(config.buildDir)
  assert.ok(chunks.seed.size && chunks.store.size && chunks.workspace.size, `demo chunks identified in the build: ${JSON.stringify(Object.fromEntries(Object.entries(chunks).map(([k, v]) => [k, [...v]])))}`)
  const report = { chunks: Object.fromEntries(Object.entries(chunks).map(([k, v]) => [k, [...v]])) }
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close())
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL }); t.after(() => db.$disconnect())

  await t.test("a signed-in leader outside Demo Mode never requests a demo chunk", async () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(configFile), "ui-fixture.json"), "utf8"))
    const actor = new Actor(config); await actor.signIn(fixture.president.email, fixture.president.password)
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await context.addCookies([...actor.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })))
    const page = await context.newPage(), scripts = [], errors = []
    page.on("request", request => { if (request.resourceType() === "script") scripts.push(request.url()) })
    page.on("pageerror", error => errors.push(error.message))
    const routes = ["/home", "/explore", "/calendar", "/inbox", "/meetings", "/profile", `/club/${fixture.clubId}/workspace`, `/club/${fixture.clubId}/workspace?section=recruitment`]
    for (const route of routes) {
      const response = await page.goto(config.appUrl + route, { waitUntil: "networkidle" })
      assert.ok(response && response.status() < 400, `${route} loads (${response?.status()})`)
    }
    report.live = { routes, scripts: scripts.length, demo: scripts.filter(url => isDemoChunk(chunks, url)) }
    assert.deepEqual(report.live.demo, [], "no demo chunk is requested outside Demo Mode")
    assert.deepEqual(errors, [])
    await context.close()
  })

  // The allowlisted presenter, created confirmed through the local service role.
  const service = createClient(config.status.API_URL, config.status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const password = "Disposable-demo!" + randomUUID()
  const existing = (await service.auth.admin.listUsers()).data.users.find(user => user.email === presenter)
  const created = existing ? await service.auth.admin.updateUserById(existing.id, { password }) : await service.auth.admin.createUser({ email: presenter, password, email_confirm: true })
  assert.equal(created.error, null)
  await db.user.upsert({ where: { id: created.data.user.id }, create: { id: created.data.user.id, email: presenter }, update: {} })
  const actor = new Actor(config); await actor.signIn(presenter, password); await actor.profile("Demo Presenter", 2027)
  const miiId = harness().load("lib/demo/seed.ts").createDemoSeed().clubs[0].id

  // Enable Demo Mode once for the presenter. The route checks Origin against the
  // server's own origin, which Next reports as localhost for a 127.0.0.1 listener.
  const serverOrigin = config.appUrl.replace("127.0.0.1", "localhost")
  const enabled = await actor.request("/api/demo", { method: "POST", headers: { origin: serverOrigin, "content-type": "application/json" }, body: JSON.stringify({ enabled: true }) })
  assert.equal(enabled.status, 200, `the allowlisted presenter enables Demo Mode: ${await enabled.text()}`)
  assert.equal(actor.cookies.get("outclass-demo-session"), "1")

  async function demoContext() {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await context.addCookies([...actor.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })))
    await context.addInitScript(recordStates)
    const page = await context.newPage()
    return { context, page }
  }

  await t.test("demo pages load demo data on the first try with no empty-state flash", async () => {
    const { context, page } = await demoContext()
    const live = [], errors = [], demoScripts = new Set()
    page.on("request", request => {
      const url = new URL(request.url())
      if (url.pathname === "/api/workspace" || request.headers()["next-action"]) live.push(url.pathname)
      if (request.resourceType() === "script" && isDemoChunk(chunks, request.url())) demoScripts.add(path.basename(url.pathname))
    })
    page.on("pageerror", error => errors.push(error.message))
    report.demo = []
    for (const [route, ready] of [
      ["/preview", "[data-product-shell]"],
      ["/preview?view=leader-dashboard", "[data-product-shell]"],
      [`/club/${miiId}/workspace`, "main"],
      [`/club/${miiId}/workspace?section=recruitment`, "main"],
    ]) {
      await page.goto(config.appUrl + route, { waitUntil: "networkidle" })
      await page.locator(ready).first().waitFor()
      assert.equal(await page.locator('[role="alert"]').filter({ hasText: /Demo Mode|Demo storage/ }).count(), 0, `${route}: no demo load error`)
      const result = await flashes(page)
      report.demo.push({ route, ...result })
      assert.deepEqual(result.flashed, [], `${route}: no empty state appeared before demo data`)
      await page.screenshot({ path: path.join(path.dirname(configFile), `demo-${report.demo.length}.png`) })
    }
    assert.deepEqual(live, [], "Demo Mode makes no live workspace or server-action request")
    // Positive control for the live-route check: the same scan sees every demo chunk load in Demo Mode.
    report.demoScripts = [...demoScripts]
    for (const kind of ["seed", "store", "workspace"]) assert.ok([...chunks[kind]].some(name => demoScripts.has(name)), `Demo Mode loads the ${kind} chunk`)
    assert.deepEqual(errors, [])
    await context.close()
  })

  await t.test("a blocked demo chunk shows the error with Try again, and the retry recovers", async () => {
    const { context, page } = await demoContext()
    let blocked = true
    await page.route("**/_next/static/chunks/**", route => blocked && isDemoChunk(chunks, route.request().url()) ? route.abort() : route.continue())
    await page.goto(config.appUrl + "/preview", { waitUntil: "domcontentloaded" })
    const alert = page.getByRole("alert").filter({ hasText: "could not load" })
    await alert.waitFor({ timeout: 15000 })
    assert.equal(await page.getByRole("button", { name: "Try again" }).count(), 1)
    assert.equal(await page.getByRole("button", { name: "Exit demo" }).count(), 1)
    blocked = false
    await page.getByRole("button", { name: "Try again" }).click()
    await page.locator("[data-product-shell]").first().waitFor({ timeout: 15000 })
    assert.equal(await alert.count(), 0)
    report.blocked = "error + Try again, recovered"
    await context.close()
  })

  await t.test("a stalled demo chunk times out to the error instead of an indefinite loader", async () => {
    const { context, page } = await demoContext()
    const held = []
    await page.route("**/_next/static/chunks/**", route => isDemoChunk(chunks, route.request().url()) ? held.push(route) : route.continue())
    const started = Date.now()
    await page.goto(config.appUrl + "/preview", { waitUntil: "domcontentloaded" })
    await page.getByRole("alert").filter({ hasText: "taking too long" }).waitFor({ timeout: 20000 })
    const elapsed = Date.now() - started
    assert.ok(elapsed >= 9000 && elapsed < 20000, `timeout after about 10 s (${elapsed} ms)`)
    await page.getByRole("button", { name: "Try again" }).click()
    for (const route of held.splice(0)) await route.continue()
    await page.unroute("**/_next/static/chunks/**")
    await page.locator("[data-product-shell]").first().waitFor({ timeout: 20000 })
    assert.equal(await page.getByRole("alert").filter({ hasText: /taking too long|could not load/ }).count(), 0)
    report.stalled = { alertAfterMs: elapsed, recovered: true }
    await context.close()
  })

  fs.writeFileSync(path.join(path.dirname(configFile), "demo-browser-report.json"), JSON.stringify(report, null, 2))
})
