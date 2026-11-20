// Demo recording only (branch demo/club-import-video): runs on the reserved disposable local
// Supabase stack with a made-up admin, a made-up club leader and test clubs, and records a video
// and screenshots of filling a club profile from its website link. It reads public UVA club
// websites and writes only to the disposable database. Never pointed at a real deployment.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { PrismaClient } = require("@prisma/client")
const { createClient } = require("@supabase/supabase-js")
const { chromium } = require("playwright")
const { Actor, readConfig, randomUUID, totp } = require("./helpers/onboarding-e2e.cjs")
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG
const out = process.env.OUTCLASS_DEMO_OUT || path.join(process.cwd(), "test-results", "club-demo")

// Public websites of UVA clubs already listed in OutClass's club data.
const candidates = ["https://vcguva.com/", "https://www.180dcuva.org/", "https://www.uvatamid.org/", "https://uvagrc.com/", "https://www.seeduva.com/", "https://gmgatuva.com/", "https://uvapwp.com/", "https://www.enactusatuva.com/", "https://www.vccatuva.org/", "https://www.aifatuva.com/"]

async function caption(page, text) {
  await page.evaluate(value => {
    let el = document.getElementById("__demo_caption")
    if (!el) {
      el = document.createElement("div"); el.id = "__demo_caption"
      Object.assign(el.style, { position: "fixed", left: "50%", bottom: "18px", transform: "translateX(-50%)", zIndex: "2147483647", background: "rgba(17,24,39,0.92)", color: "#fff", font: "600 17px/1.35 system-ui, sans-serif", padding: "10px 18px", borderRadius: "10px", maxWidth: "88vw", textAlign: "center", pointerEvents: "none", boxShadow: "0 6px 24px rgba(0,0,0,0.25)" })
      document.body.appendChild(el)
    }
    el.textContent = value
  }, text).catch(() => {})
}
const pause = (page, ms = 1400) => page.waitForTimeout(ms)
const dismissGuide = async page => { await page.getByRole("button", { name: "Dismiss tutorial" }).click({ timeout: 3000 }).catch(() => {}) }
let shot = 0
async function snap(page, name, options = {}) { shot += 1; await page.screenshot({ path: path.join(out, `${String(shot).padStart(2, "0")}-${name}.png`), ...options }).catch(error => console.log("screenshot failed", name, error.message)) }
const clubRow = club => ({ name: club.name, tagline: club.tagline, description: club.description?.slice(0, 400), color: club.color, logo: club.logoUrl ? (club.logoUrl.startsWith("data:") ? "inline image" : "uploaded") : null, cover: club.bannerUrl ? "uploaded" : null, marketing: club.marketing })

async function scrollPage(page, top) { await page.evaluate(y => { const s = [...document.querySelectorAll("main, [id='workspace-content'], body *")].find(n => n.scrollHeight > n.clientHeight + 200 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)); (s || window).scrollBy({ top: y, behavior: "smooth" }) }, top).catch(() => {}) }

test("club website import demo recording", { skip: !configFile, timeout: 900000 }, async t => {
  fs.mkdirSync(out, { recursive: true })
  const config = readConfig(configFile)
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL }); t.after(() => db.$disconnect())
  const service = createClient(config.status.API_URL, config.status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const browser = await chromium.launch({ headless: true, slowMo: 120 }); t.after(() => browser.close())
  const videoDir = path.join(out, "raw-video")
  const size = { width: 1280, height: 800 }
  const suffix = randomUUID().replaceAll("-", "").slice(0, 6)
  const log = { probes: [] }

  // The stack's made-up platform admin, elevated with password + authenticator code like a real admin.
  const admin = new Actor(config); await admin.signIn(config.admin.email, config.admin.password)
  await admin.profile("Demo Admin", 2027).catch(error => console.log("admin profile:", error.message))
  const elevate = body => admin.request("/api/platform/elevation", { method: "POST", headers: { origin: config.appUrl, "Content-Type": "application/json" }, body: JSON.stringify(body) })
  assert.equal((await elevate({ action: "password", password: config.admin.password })).status, 200)
  assert.equal((await elevate({ action: "verify", code: totp(config.admin.totpSecret) })).status, 200)

  // Off camera: try each candidate site once in the real editor (no recording) and keep the two
  // that fill the most fields. The browser decodes the full action reply, images included.
  const probeContext = await browser.newContext({ viewport: size })
  await probeContext.addCookies([...admin.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })))
  const probe = await probeContext.newPage()
  for (const url of candidates) {
    try {
      await probe.goto(config.appUrl + "/platform/clubs"); await dismissGuide(probe)
      await probe.getByRole("button", { name: /New club/ }).click({ timeout: 30000 })
      await probe.getByRole("textbox", { name: "Club website link" }).fill(url)
      await probe.getByRole("button", { name: "Fill profile" }).click()
      const result = probe.locator("p", { hasText: /^(Filled |Your profile already has)/ }).or(probe.getByRole("alert"))
      await result.first().waitFor({ timeout: 45000 })
      const text = (await result.first().textContent()) || ""
      const filled = text.match(/^Filled (.*) from /)?.[1] || ""
      log.probes.push({ url, ok: /^Filled /.test(text), score: filled ? filled.split(/, | and /).length : 0, message: text.trim() })
    } catch (error) { log.probes.push({ url, ok: false, error: error.message.split("\n")[0] }) }
  }
  await probeContext.close()
  console.log(JSON.stringify(log.probes, null, 1))
  const ranked = log.probes.filter(p => p.ok).sort((a, b) => b.score - a.score)
  assert.ok(ranked.length >= 1, "at least one club site readable")
  const siteA = ranked[0], siteB = ranked[1] || ranked[0]
  fs.writeFileSync(path.join(out, "site-probes.json"), JSON.stringify(log.probes, null, 2))

  // ── Part 1: the test admin adds a new club by pasting its website link ──
  const one = await browser.newContext({ viewport: size, recordVideo: { dir: videoDir, size } })
  await one.addCookies([...admin.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })))
  const page = await one.newPage()
  page.on("pageerror", error => console.log("pageerror:", error.message))
  let createdId
  try {
    await page.goto(config.appUrl + "/platform/clubs")
    await page.getByRole("button", { name: /New club/ }).waitFor({ timeout: 30000 })
    await pause(page, 600); await dismissGuide(page)
    await caption(page, "1 · A test admin account (made up, on a throwaway copy of OutClass) adds a new club"); await pause(page, 2400)
    await page.getByRole("button", { name: /New club/ }).click()
    const link = page.getByRole("textbox", { name: "Club website link" })
    await link.waitFor({ timeout: 30000 }); await link.scrollIntoViewIfNeeded(); await pause(page, 600)
    await caption(page, "The profile starts empty. Paste the club’s website link…"); await pause(page, 1800)
    await snap(page, "admin-new-club-empty")
    await link.click(); await page.keyboard.type(siteA.url, { delay: 35 }); await pause(page, 700)
    await page.getByRole("button", { name: "Fill profile" }).click()
    await caption(page, `…and press Fill profile. OutClass reads ${new URL(siteA.url).hostname}`)
    await page.getByText(/^Filled .* Review them, then publish\./).waitFor({ timeout: 45000 })
    await pause(page, 900)
    await caption(page, "2 · The name, description and links are filled in as unsaved edits for review"); await pause(page, 2600)
    await snap(page, "admin-filled")
    await scrollPage(page, 500); await pause(page, 2200); await snap(page, "admin-filled-more")
    await scrollPage(page, 600); await pause(page, 2000)
    await scrollPage(page, -2000); await pause(page, 900)
    await caption(page, "Nothing is saved yet. The admin adds a slug and a reason, then publishes")
    await page.getByLabel("Slug", { exact: true }).fill(`demo-import-${suffix}`)
    await page.getByLabel("Reason for change", { exact: true }).fill("Demo of the website import on a test copy")
    await pause(page, 1400)
    await page.getByRole("button", { name: "Publish profile" }).click()
    await page.getByText("Club saved. No leadership was granted.").waitFor({ timeout: 30000 })
    await caption(page, "3 · Saved. The new club stays hidden from Explore until the admin turns Discoverable on"); await pause(page, 2600)
    await snap(page, "admin-saved")
    const saved = await db.club.findFirstOrThrow({ where: { slug: `demo-import-${suffix}` } }); createdId = saved.id
    // Now the club exists, a second fill can upload the site's logo and cover image too.
    if (/logo|cover image/.test(siteA.message)) {
      await link.scrollIntoViewIfNeeded()
      await caption(page, "Images upload once the club exists, so the admin presses Fill profile again for the logo and cover"); await pause(page, 2400)
      await page.getByRole("button", { name: "Fill profile" }).click()
      await page.getByText(/^(Filled|Your profile already has)/).waitFor({ timeout: 45000 }); await pause(page, 1600)
      await snap(page, "admin-images-filled")
      const publish = page.getByRole("button", { name: "Publish profile" })
      if (await publish.isEnabled().catch(() => false)) { await publish.click(); await page.getByText("Club saved. No leadership was granted.").waitFor({ timeout: 30000 }).catch(() => {}) }
      await caption(page, "4 · Logo and cover added from the website"); await pause(page, 2400)
      await snap(page, "admin-with-images")
    }
    log.adminClub = clubRow(await db.club.findUniqueOrThrow({ where: { id: createdId } }))
  } finally {
    await snap(page, "part1-last-frame")
    await one.close()
  }

  // ── Part 2: a test club leader refreshes an existing test club from its website ──
  const email = `demolead${suffix}@virginia.edu`, password = "Demo-only!" + randomUUID()
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true }); assert.equal(created.error, null)
  await db.user.upsert({ where: { id: created.data.user.id }, create: { id: created.data.user.id, email }, update: {} })
  const leader = new Actor(config); await leader.signIn(email, password)
  await leader.profile("Riley Demo", 2027); await leader.availability()
  const club = await db.club.create({ data: { slug: "demo-test-club-" + suffix, name: "Demo Test Club", tagline: "Our own tagline, kept", description: "", color: "#142D45", category: "Academic", claimedAt: new Date() } })
  await db.clubMember.create({ data: { clubId: club.id, userId: leader.user.id, isOwner: true, accessRole: "OWNER" } })
  await leader.action("actions/tutorials.ts", "saveTutorial", [{ experience: "student", action: "skip", step: 0 }]).catch(() => {})
  await leader.action("actions/tutorials.ts", "saveTutorial", [{ experience: "leader", clubId: club.id, action: "skip", step: 0 }]).catch(() => {})
  const two = await browser.newContext({ viewport: size, recordVideo: { dir: videoDir, size } })
  await two.addCookies([...leader.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })))
  const p2 = await two.newPage()
  p2.on("pageerror", error => console.log("pageerror:", error.message))
  try {
    await p2.goto(config.appUrl + `/club/${club.id}/workspace?section=settings&setting=general`)
    const link = p2.getByRole("textbox", { name: "Club website link" })
    await link.waitFor({ timeout: 30000 }); await pause(p2, 600); await dismissGuide(p2)
    await caption(p2, "5 · A test club leader (made up) opens a test club’s profile settings"); await pause(p2, 2200)
    await link.scrollIntoViewIfNeeded(); await pause(p2, 600)
    await caption(p2, "This test club has a name and tagline but no description or links"); await pause(p2, 2200)
    await snap(p2, "leader-before")
    const fill = p2.getByRole("button", { name: "Fill profile" })
    await link.click(); await p2.keyboard.type("not a real club site", { delay: 30 })
    await fill.click()
    await p2.getByRole("alert").waitFor({ timeout: 30000 }).catch(() => {})
    await caption(p2, "A link that isn’t a website gets a plain message, and nothing changes"); await pause(p2, 2400)
    await snap(p2, "leader-bad-link")
    await link.fill(""); await link.click(); await p2.keyboard.type(siteB.url, { delay: 35 }); await pause(p2, 600)
    await caption(p2, `6 · The real link: ${new URL(siteB.url).hostname}. Replace is off, so existing fields are kept`); await pause(p2, 1600)
    await fill.click()
    await p2.getByText(/^(Filled|Your profile already has)/).waitFor({ timeout: 45000 }); await pause(p2, 1000)
    await caption(p2, "Empty fields are filled; the name and tagline the leader wrote are kept"); await pause(p2, 2800)
    await snap(p2, "leader-filled-keep")
    await scrollPage(p2, 500); await pause(p2, 2200); await snap(p2, "leader-filled-more")
    await scrollPage(p2, -2000); await pause(p2, 800)
    await link.scrollIntoViewIfNeeded()
    await caption(p2, "7 · With Replace on, the website’s versions replace what was there"); await pause(p2, 1600)
    await p2.getByRole("switch", { name: "Replace fields that already have content" }).click().catch(async () => { await p2.getByText("Replace fields that already have content").click() })
    await pause(p2, 700); await fill.click()
    await p2.getByText(/^(Filled|Your profile already has)/).waitFor({ timeout: 45000 }); await pause(p2, 1000)
    await snap(p2, "leader-filled-replace"); await pause(p2, 1600)
    await caption(p2, "The leader reviews, then presses Publish profile")
    await p2.getByRole("button", { name: "Publish profile" }).click()
    await p2.getByText(/Profile published/).waitFor({ timeout: 30000 })
    await caption(p2, "8 · Published to the test club"); await pause(p2, 2600)
    await snap(p2, "leader-published")
    log.leaderClub = clubRow(await db.club.findUniqueOrThrow({ where: { id: club.id } }))
  } finally {
    await snap(p2, "part2-last-frame")
    await two.close()
  }

  log.sites = { admin: siteA.url, leader: siteB.url }
  fs.writeFileSync(path.join(out, "saved-test-clubs.json"), JSON.stringify(log, null, 2))
  const videos = fs.readdirSync(videoDir).filter(n => n.endsWith(".webm")).map(n => path.join(videoDir, n)).sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs)
  videos.forEach((file, i) => fs.renameSync(file, path.join(out, `part${i + 1}.webm`)))
  assert.equal(videos.length, 2)
})
