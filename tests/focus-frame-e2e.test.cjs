// Real Next + Supabase Auth + PostgreSQL on the reserved disposable stack only.
// Focus screens render in one frame (mark, task, Exit) at unchanged URLs; Exit returns to the
// referring product page; the old in-workspace interview URL moves to /club/[clubId]/interview.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const { PrismaClient } = require("@prisma/client")
const { createClient } = require("@supabase/supabase-js")
const { chromium } = require("playwright")
const { Actor, readConfig, randomUUID } = require("./helpers/onboarding-e2e.cjs")
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG

test("focus frame: unchanged URLs, Exit to the referring page, interview room route and redirects", { skip: !configFile, timeout: 180000 }, async t => {
  const config = readConfig(configFile)
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL }); t.after(() => db.$disconnect())
  const service = createClient(config.status.API_URL, config.status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const email = `focus.${randomUUID()}@virginia.edu`, password = "Disposable-focus!" + randomUUID()
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true }); assert.equal(created.error, null)
  await db.user.upsert({ where: { id: created.data.user.id }, create: { id: created.data.user.id, email }, update: {} })
  const actor = new Actor(config); await actor.signIn(email, password); await actor.profile("Focus Student", 2028)

  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close())
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addCookies([...actor.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })))
  const page = await context.newPage(), errors = []
  page.on("pageerror", error => errors.push(error.message))
  const here = () => { const url = new URL(page.url()); return url.pathname + url.search }
  const frame = () => page.locator("[data-focus-frame]")
  const club = randomUUID(), application = randomUUID(), round = randomUUID()

  await t.test("a focus screen keeps its URL, shows the frame, and Exit returns to the product page it came from", async () => {
    await page.goto(config.appUrl + "/clubs/meetings"); await page.locator("[data-product-shell]").first().waitFor()
    await page.goto(config.appUrl + "/check-in"); await frame().waitFor()
    assert.equal(here(), "/check-in")
    assert.equal(await page.locator(".oc-focus-task").textContent(), "Meeting check-in")
    assert.equal(await page.locator("main").count(), 1)
    const exit = page.getByRole("link", { name: "Exit", exact: true })
    await page.waitForFunction(() => document.querySelector(".oc-focus-exit")?.getAttribute("href") === "/clubs/meetings")
    await exit.click(); await page.waitForURL(url => url.pathname === "/clubs/meetings"); await page.locator("[data-product-shell]").first().waitFor()
    await page.goBack(); await page.waitForURL(url => url.pathname === "/check-in"); await frame().waitFor()
    await page.goForward(); await page.waitForURL(url => url.pathname === "/clubs/meetings")
  })

  await t.test("the old in-workspace interview URL moves to the interview route with its filters; no access shows no candidate", async () => {
    await page.goto(`${config.appUrl}/club/${club}/workspace?section=recruitment&tool=interviews&interview=1&interviewTab=rooms&applicationId=${application}&roundId=${round}`)
    await page.waitForURL(url => url.pathname === `/club/${club}/interview`)
    assert.equal(here(), `/club/${club}/interview?interviewTab=rooms&applicationId=${application}&roundId=${round}`)
    await frame().waitFor()
    await page.getByRole("heading", { name: "Interview room unavailable", exact: true }).waitFor()
    assert.equal(await page.locator(".oc-focus-task").textContent(), "Interview")
  })

  await t.test("the projector route uses the dark present theme; other voting views do not", async () => {
    await page.goto(`${config.appUrl}/voting/rooms/${randomUUID()}?clubId=${club}&view=present`); await frame().waitFor()
    await page.waitForFunction(() => document.querySelector("[data-focus-frame]")?.getAttribute("data-theme") === "present")
    const background = await page.evaluate(() => getComputedStyle(document.querySelector("[data-focus-frame]")).backgroundColor)
    assert.equal(background, "rgb(15, 28, 43)")
    await page.goto(`${config.appUrl}/vote`); await frame().waitFor()
    assert.equal(await frame().getAttribute("data-theme"), null)
  })

  await t.test("signed out, the interview route asks for sign-in and returns to the same room", async () => {
    const anonymous = await browser.newContext(), signedOut = await anonymous.newPage(); t.after(() => anonymous.close())
    await signedOut.goto(`${config.appUrl}/club/${club}/interview?applicationId=${application}`)
    await signedOut.waitForURL(url => url.pathname === "/login")
    assert.equal(new URL(signedOut.url()).searchParams.get("next"), `/club/${club}/interview?applicationId=${application}`)
  })

  assert.deepEqual(errors, [])
})
