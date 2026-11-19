// Demo recording only (branch demo/resume-autofill-video): runs on the reserved disposable
// Supabase stack with made-up students and made-up résumés, records a video and screenshots
// of résumé autofill at sign-up and from Edit profile. Never pointed at a real deployment.
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { PrismaClient } = require("@prisma/client")
const { createClient } = require("@supabase/supabase-js")
const { chromium } = require("playwright")
const { Actor, readConfig, randomUUID, confirmationMessage } = require("./helpers/onboarding-e2e.cjs")
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG
const out = process.env.OUTCLASS_DEMO_OUT || path.join(process.cwd(), "test-results", "resume-demo")
const fixtures = path.join(process.cwd(), "tests", "fixtures", "resume-import")

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
let shot = 0
async function snap(page, name, options = {}) { shot += 1; await page.screenshot({ path: path.join(out, `${String(shot).padStart(2, "0")}-${name}.png`), ...options }).catch(error => console.log("screenshot failed", name, error.message)) }

test("résumé autofill demo recording", { skip: !configFile, timeout: 600000 }, async t => {
  fs.mkdirSync(out, { recursive: true })
  const config = readConfig(configFile)
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL }); t.after(() => db.$disconnect())
  const service = createClient(config.status.API_URL, config.status.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const browser = await chromium.launch({ headless: true, slowMo: 120 }); t.after(() => browser.close())
  const videoDir = path.join(out, "raw-video")
  const size = { width: 1280, height: 800 }

  // ── Part 1: a brand-new test student signs up and fills step 3 from a résumé ──
  const suffix = randomUUID().replaceAll("-", "").slice(0, 6)
  const email = `demo${suffix}@virginia.edu`, password = "Demo-only!" + randomUUID()
  const one = await browser.newContext({ viewport: size, recordVideo: { dir: videoDir, size } })
  const page = await one.newPage()
  page.on("pageerror", error => console.log("pageerror:", error.message))
  try {
    await page.goto(config.appUrl + "/signup")
    await page.locator("#firstName").waitFor()
    await caption(page, "1 · A new test student (Maya Chen, made up) signs up on OutClass"); await pause(page, 2200)
    await page.locator("#firstName").fill("Maya")
    await page.locator("#lastName").fill("Chen")
    await page.locator("#email").fill(email)
    await page.locator("#password").fill(password)
    const terms = page.locator("#accept-terms")
    if (await terms.count()) await terms.check()
    await pause(page, 900)
    await page.getByRole("button", { name: /^Continue/ }).first().click()
    await page.getByRole("heading", { name: "Verify your email" }).waitFor({ timeout: 30000 })
    await caption(page, "The 6-digit code goes to a local test inbox; no real email is sent"); await pause(page, 1500)
    const message = await confirmationMessage(config, email)
    const code = message.Text.match(/\b(\d{6})\b/)[1]
    await page.locator('input[autocomplete="one-time-code"]').first().click()
    await page.keyboard.type(code, { delay: 120 })
    await page.getByRole("button", { name: /Verify email/ }).click()
    await page.getByRole("heading", { name: "Academic profile" }).waitFor({ timeout: 30000 })
    await caption(page, "2 · Step 3 offers: “Have a résumé? Fill this in from your PDF”"); await pause(page, 2000)
    await snap(page, "signup-step3-empty")
    await page.locator("#onboarding-resume-fill").scrollIntoViewIfNeeded()
    await page.locator("#onboarding-resume-fill").setInputFiles(path.join(fixtures, "layout-a-engineering.pdf"))
    await caption(page, "Uploading Maya’s made-up résumé PDF…")
    await page.getByText(/Filled in \d+ details from your résumé/).waitFor({ timeout: 30000 })
    await caption(page, "3 · Major, graduation year, GPA and phone are filled in. She can edit any of them."); await pause(page, 2600)
    await snap(page, "signup-step3-filled", { fullPage: true })
    await page.locator("#gpa").scrollIntoViewIfNeeded(); await pause(page, 1600)
    await page.getByRole("button", { name: /^Continue/ }).last().click()
    await page.getByRole("heading", { name: "Experience & assets" }).waitFor({ timeout: 30000 })
    await caption(page, "4 · Step 4: her experiences, LinkedIn and the résumé itself are already there"); await pause(page, 2600)
    await snap(page, "signup-step4-filled", { fullPage: true })
    await page.locator("#linkedinUrl").scrollIntoViewIfNeeded(); await pause(page, 2200)
    await page.getByRole("button", { name: /^Continue/ }).last().click()
    await page.getByRole("heading", { name: "Help us suggest clubs" }).waitFor({ timeout: 30000 })
    await caption(page, "Nothing was saved until she pressed Continue. She skips the optional survey."); await pause(page, 1800)
    await page.getByRole("button", { name: "Skip for now" }).click()
    await page.waitForURL(url => !url.pathname.startsWith("/signup"), { timeout: 30000 }).catch(() => {})
    // Off camera: the required weekly-availability step, answered through the real action.
    const actor = new Actor(config); await actor.signIn(email, password); await actor.availability()
    await page.goto(config.appUrl + "/profile")
    await page.getByText("Maya", { exact: false }).first().waitFor({ timeout: 30000 })
    await caption(page, "5 · Her saved profile, filled from the résumé"); await pause(page, 2600)
    await snap(page, "maya-saved-profile", { fullPage: true })
    await page.mouse.wheel(0, 700); await pause(page, 2200)
    const saved = await db.studentProfile.findUniqueOrThrow({ where: { userId: actor.user.id }, include: { experiences: true } }).catch(() => db.studentProfile.findUniqueOrThrow({ where: { userId: actor.user.id } }))
    fs.writeFileSync(path.join(out, "maya-saved-profile.json"), JSON.stringify({ firstName: saved.firstName, lastName: saved.lastName, major: saved.major, gradYear: saved.gradYear, gpa: saved.gpa != null ? String(saved.gpa) : null, phone: saved.phone, linkedinUrl: saved.linkedinUrl, resumeAttached: !!saved.resumeUrl, experiences: (saved.experiences || []).map(e => ({ title: e.title, subtitle: e.subtitle, period: e.period })) }, null, 2))
  } finally {
    await snap(page, "part1-last-frame")
    await one.close()
  }

  // ── Part 2: an existing test student imports a résumé from Edit profile ──
  const email2 = `demo${suffix}b@virginia.edu`, password2 = "Demo-only!" + randomUUID()
  const created = await service.auth.admin.createUser({ email: email2, password: password2, email_confirm: true }); assert.equal(created.error, null)
  await db.user.upsert({ where: { id: created.data.user.id }, create: { id: created.data.user.id, email: email2 }, update: {} })
  const jordan = new Actor(config); await jordan.signIn(email2, password2)
  await jordan.action("actions/profile.ts", "upsertStudentProfile", [{ firstName: "Jordan", lastName: "Okafor", computingId: "demo", major: "Undeclared", gradYear: 2029, phone: "434-555-0100", experiences: [] }])
  await jordan.availability()
  const two = await browser.newContext({ viewport: size, recordVideo: { dir: videoDir, size } })
  await two.addCookies([...jordan.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })))
  const p2 = await two.newPage()
  p2.on("pageerror", error => console.log("pageerror:", error.message))
  try {
    await p2.goto(config.appUrl + "/profile")
    const open = p2.getByRole("button", { name: "Import from résumé" })
    await open.waitFor({ timeout: 30000 })
    await caption(p2, "6 · An existing test student (Jordan Okafor, made up) with a mostly empty profile"); await pause(p2, 2400)
    await snap(p2, "jordan-before", { fullPage: true })
    await open.click()
    await p2.getByRole("heading", { name: "Import your résumé" }).waitFor()
    await caption(p2, "Edit profile → Import from résumé"); await pause(p2, 1600)
    await p2.locator("#resume-import-file").setInputFiles(path.join(fixtures, "layout-b-politics.pdf"))
    await p2.getByRole("button", { name: "Confirm selected changes" }).waitFor({ timeout: 30000 })
    await caption(p2, "7 · New details come pre-ticked. His existing major and phone stay unticked, so they aren’t overwritten."); await pause(p2, 3000)
    await snap(p2, "jordan-import-review")
    const dialog = p2.getByRole("dialog")
    await dialog.evaluate(el => { const s = [el, ...el.querySelectorAll("*")].find(n => n.scrollHeight > n.clientHeight + 20 && getComputedStyle(n).overflowY !== "visible"); if (s) s.scrollBy({ top: 600, behavior: "smooth" }) }).catch(() => {})
    await pause(p2, 2200); await snap(p2, "jordan-import-review-experiences")
    await dialog.evaluate(el => { const s = [el, ...el.querySelectorAll("*")].find(n => n.scrollHeight > n.clientHeight + 20 && getComputedStyle(n).overflowY !== "visible"); if (s) s.scrollBy({ top: 5000, behavior: "smooth" }) }).catch(() => {})
    await pause(p2, 1600)
    await caption(p2, "Nothing changes until he confirms")
    await p2.getByRole("button", { name: "Confirm selected changes" }).click()
    await p2.getByRole("heading", { name: "Import your résumé" }).waitFor({ state: "hidden", timeout: 30000 })
    await caption(p2, "8 · Saved: his profile now has the résumé’s details"); await pause(p2, 2600)
    await snap(p2, "jordan-after", { fullPage: true })
    await p2.mouse.wheel(0, 700); await pause(p2, 2400)
  } finally {
    await snap(p2, "part2-last-frame")
    await two.close()
  }

  // Name the two recordings in the order they were made.
  const videos = fs.readdirSync(videoDir).filter(n => n.endsWith(".webm")).map(n => path.join(videoDir, n)).sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs)
  videos.forEach((file, i) => fs.renameSync(file, path.join(out, `part${i + 1}.webm`)))
  assert.equal(videos.length, 2)
})
