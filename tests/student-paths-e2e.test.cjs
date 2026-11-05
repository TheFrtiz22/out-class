// Real Next + Supabase Auth + PostgreSQL on the reserved disposable stack only.
// Student workspace views have real paths: old `/?workspace=student&view=…` URLs redirect, tab
// switches push the new paths client-side, and back/forward and reload land on the same view.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const { PrismaClient } = require("@prisma/client")
const { createClient } = require("@supabase/supabase-js")
const { chromium } = require("playwright")
const { Actor, readConfig, randomUUID } = require("./helpers/onboarding-e2e.cjs")
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG

test("student workspace paths: old URLs redirect, back/forward and reload stay on the right view", { skip: !configFile, timeout: 180000 }, async t => {
  const config = readConfig(configFile)
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL }); t.after(() => db.$disconnect())
  const service = createClient(config.status.API_URL, config.status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const email = `paths.${randomUUID()}@virginia.edu`, password = "Disposable-paths!" + randomUUID()
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true }); assert.equal(created.error, null)
  await db.user.upsert({ where: { id: created.data.user.id }, create: { id: created.data.user.id, email }, update: {} })
  const actor = new Actor(config); await actor.signIn(email, password); await actor.profile("Paths Student", 2028)

  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close())
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addCookies([...actor.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })))
  const page = await context.newPage(), errors = []
  page.on("pageerror", error => errors.push(error.message))
  const here = () => { const url = new URL(page.url()); return url.pathname + url.search }
  const shell = () => page.locator("[data-product-shell]").first().waitFor()

  await t.test("every old student URL redirects to its path while signed in", async () => {
    const cases = [
      ["/?workspace=student", "/home"],
      ["/?workspace=student&view=explore", "/explore"],
      ["/?workspace=student&view=corkboard", "/corkboard"],
      ["/?workspace=student&view=tracker&section=applications", "/applications"],
      ["/?workspace=student&view=status&section=status", "/applications/status"],
      ["/?workspace=student&view=my-clubs&section=tasks", "/clubs/tasks"],
      ["/?workspace=student&view=calendar&section=meetings", "/calendar?section=meetings"],
      ["/?workspace=student&view=inbox&tab=preferences", "/inbox?tab=preferences"],
      ["/?workspace=student&view=student-profile", "/profile"],
      ["/interviews?applicationId=a", "/applications/status?applicationId=a"],
      ["/", "/home"],
    ]
    for (const [from, to] of cases) {
      await page.goto(config.appUrl + from)
      await page.waitForURL(url => url.pathname + url.search === to, { timeout: 30000 })
      assert.equal(here(), to, from)
      if (to !== "/corkboard") await shell()
    }
  })

  await t.test("tab switches push real paths without a reload; back and forward return to each view", async () => {
    await page.goto(config.appUrl + "/home"); await shell()
    await page.evaluate(() => { window.__sameDocument = true })
    const visible = selector => page.locator(selector).filter({ visible: true }).first()
    const go = async (selector, path) => { await visible(selector).click(); await page.waitForURL(url => url.pathname === path); assert.equal(await page.evaluate(() => window.__sameDocument), true, `${path} must not reload the page`) }
    await go('[data-tour="mode-apply"]', "/applications")
    await go('[data-tour="mode-clubs"]', "/clubs")
    await go('[data-tour="nav-meetings"]', "/clubs/meetings")
    const active = async id => assert.equal(await visible(`[data-tour="nav-${id}"]`).getAttribute("aria-current"), "page", id)
    await active("meetings")
    await page.goBack(); await page.waitForURL(url => url.pathname === "/clubs"); await active("clubs")
    await page.goBack(); await page.waitForURL(url => url.pathname === "/applications"); await active("applications")
    await page.goForward(); await page.waitForURL(url => url.pathname === "/clubs"); await active("clubs")
    assert.equal(await page.evaluate(() => window.__sameDocument), true, "back/forward stays in the same document")
  })

  await t.test("reloading or opening a path directly renders that view", async () => {
    for (const [path, id] of [["/clubs/meetings", "meetings"], ["/applications/status", "status"], ["/explore", "explore"]]) {
      await page.goto(config.appUrl + path); await shell()
      assert.equal(here(), path)
      assert.equal(await page.locator(`[data-tour="nav-${id}"]`).filter({ visible: true }).first().getAttribute("aria-current"), "page", path)
    }
  })

  assert.deepEqual(errors, [])
})
