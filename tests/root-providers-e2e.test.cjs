// Real Next production build + Supabase Auth + PostgreSQL on the reserved disposable stack only.
// FE-3: saved clubs load only where a page shows them, and saving still works end to end.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { PrismaClient } = require("@prisma/client")
const { createClient } = require("@supabase/supabase-js")
const { chromium } = require("playwright")
const { Actor, readConfig, randomUUID } = require("./helpers/onboarding-e2e.cjs")
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG

test("saved clubs load only where shown; saving works on club profile, Explore and the saved-clubs list", { skip: !configFile, timeout: 180000 }, async t => {
  const config = readConfig(configFile)
  const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(configFile), "ui-fixture.json"), "utf8"))
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL }); t.after(() => db.$disconnect())
  const club = await db.club.findUniqueOrThrow({ where: { id: fixture.clubId }, select: { id: true, name: true } })
  const service = createClient(config.status.API_URL, config.status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const email = `saved.${randomUUID()}@virginia.edu`, password = "Disposable-saved!" + randomUUID()
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true }); assert.equal(created.error, null)
  await db.user.upsert({ where: { id: created.data.user.id }, create: { id: created.data.user.id, email }, update: {} })
  const actor = new Actor(config); await actor.signIn(email, password); await actor.profile("Saved Student", 2028)

  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close())
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addCookies([...actor.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })))
  const page = await context.newPage(), errors = []
  page.on("pageerror", error => errors.push(error.message))
  let reads = 0
  page.on("request", request => { const url = new URL(request.url()); if (url.pathname === "/api/workspace" && url.searchParams.get("kind") === "corkboard") reads++ })
  const visit = async route => { const response = await page.goto(config.appUrl + route, { waitUntil: "networkidle" }); assert.ok(response && response.status() < 400, `${route} loads`) }
  const saveButton = () => page.getByRole("button", { name: `Save to saved clubs: ${club.name}` })
  const removeButton = () => page.getByRole("button", { name: `Remove from saved clubs: ${club.name}` })
  const savedRows = () => db.corkboardClub.count({ where: { userId: created.data.user.id, clubId: club.id } })
  // Poll the database until it reaches the expected count; fail with the last value otherwise.
  async function rowsBecome(expected, message) {
    let last
    for (let i = 0; i < 40; i++) { last = await savedRows(); if (last === expected) return; await page.waitForTimeout(250) }
    assert.equal(last, expected, message)
  }

  await t.test("pages without saved-club UI make no saved-clubs request", async () => {
    for (const route of ["/check-in", "/home"]) {
      reads = 0
      await visit(route)
      await page.evaluate(() => window.dispatchEvent(new Event("focus")))
      await page.waitForTimeout(300)
      assert.equal(reads, 0, `${route}: no Corkboard request, even on focus`)
    }
  })

  await t.test("the club profile loads saved clubs and saves one", async () => {
    reads = 0
    await visit(`/club/${club.id}`)
    assert.ok(reads >= 1, "a page with saved-club UI loads them")
    await saveButton().click()
    await removeButton().waitFor()
    await rowsBecome(1, "the save is stored")
  })

  await t.test("the saved-clubs list shows it after a reload", async () => {
    await visit("/saved-clubs")
    await page.getByText(club.name).first().waitFor()
  })

  await t.test("Explore shows it as saved and can remove it", async () => {
    await visit("/explore")
    await page.getByText(club.name).first().click()
    await removeButton().click()
    await saveButton().waitFor()
    await rowsBecome(0, "the removal is stored")
  })

  assert.deepEqual(errors, [])
})
