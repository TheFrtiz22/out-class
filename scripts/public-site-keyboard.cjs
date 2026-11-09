/**
 * Keyboard-only run, signed out, fresh contexts: header menu (phone), audience toggle (homepage),
 * sign in and sign up forms. Uses only Tab/Shift+Tab/Enter/Space/Escape/arrows and typing.
 * Never submits a real account: the sign-in attempt uses a non-existent address on a local server.
 *
 *   OUTCLASS_AUDIT_URL=http://127.0.0.1:3206 node scripts/public-site-keyboard.cjs
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright')
const base = process.env.OUTCLASS_AUDIT_URL || 'http://127.0.0.1:3000'
const results = []
const check = (name, fn) => results.push({ name, fn })

async function tabTo(page, predicate, max = 60, key = 'Tab') {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(key)
    if (await page.evaluate(predicate)) return true
  }
  return false
}
const focused = page => page.evaluate(() => { const el = document.activeElement; return { tag: el?.tagName, text: (el?.getAttribute('aria-label') || el?.textContent || '').trim().slice(0, 40), outline: el ? getComputedStyle(el).outlineStyle : '', height: el?.getBoundingClientRect().height } })

check('phone header menu opens, is reachable and closes with Escape back to the toggle', async browser => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
  await page.goto(base + '/uva', { waitUntil: 'networkidle' })
  assert.ok(await tabTo(page, () => document.activeElement?.classList.contains('oc-public-menu-toggle')), 'menu toggle reachable by Tab')
  assert.ok((await focused(page)).height >= 44)
  await page.keyboard.press('Enter')
  assert.equal(await page.getAttribute('.oc-public-menu-toggle', 'aria-expanded'), 'true')
  await page.keyboard.press('Tab')
  const first = await focused(page)
  assert.match(first.text, /How It Works/, 'first menu link receives focus next')
  assert.notEqual(first.outline, 'none', 'focus is visible')
  await page.keyboard.press('Escape')
  assert.equal(await page.getAttribute('.oc-public-menu-toggle', 'aria-expanded'), 'false')
  assert.ok(await page.evaluate(() => document.activeElement?.classList.contains('oc-public-menu-toggle')), 'focus returns to the toggle')
})

check('homepage audience toggle works from the keyboard and survives a reload (cookie)', async browser => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  assert.match(await page.textContent('h1'), /Build your next class/, 'club leaders are the first-visit default')
  assert.ok(await tabTo(page, () => document.activeElement?.closest('.oc-hero-audience-toggle') !== null), 'toggle reachable by Tab')
  assert.match((await focused(page)).text, /Club leaders/i, 'roving focus starts on the selected option')
  await page.keyboard.press('ArrowLeft')
  assert.match((await focused(page)).text, /Students/)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => /Find and apply/.test(document.querySelector('h1')?.textContent || ''))
  const cookie = (await context.cookies()).find(c => c.name === 'outclass-landing-audience')
  assert.equal(cookie?.value, 'students')
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  assert.match(await page.textContent('h1'), /Find and apply/, 'server render follows the saved preference')
  assert.equal(await page.locator('.oc-footer-invitation [data-slot="button"]').textContent(), 'Create your profile')
})

check('sign in: fields, Forgot password and the submit button are reachable in order; errors are announced', async browser => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  await page.goto(base + '/login?next=%2Fclub%2Fvcg-uva', { waitUntil: 'networkidle' })
  assert.equal(await page.locator('h1').count(), 1); assert.match(await page.textContent('h1'), /Welcome back/)
  assert.ok(await tabTo(page, () => document.activeElement?.id === 'uva-email'), 'email field reachable')
  await page.keyboard.type('nobody-keyboard-check@virginia.edu')
  await page.keyboard.press('Tab'); assert.match((await focused(page)).text, /Forgot password/)
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.id), 'login-password')
  await page.keyboard.type('not-a-real-password')
  await page.keyboard.press('Tab'); const submit = await focused(page)
  assert.match(submit.text, /Sign in/); assert.ok(submit.height >= 44)
  await page.keyboard.press('Enter')
  await page.locator('#auth-error[role="alert"]').waitFor({ timeout: 15000 })
})

check('sign up: one h1, the form is reachable by keyboard and the disabled-looking state is still a button', async browser => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
  await page.goto(base + '/signup', { waitUntil: 'networkidle' })
  assert.equal(await page.locator('h1').count(), 1); assert.match(await page.textContent('h1'), /Create your profile/)
  assert.equal(await page.getByRole('heading', { name: 'Create your account' }).count(), 0, 'no repeated title')
  assert.ok(await tabTo(page, () => document.activeElement?.id === 'firstName'), 'first name reachable')
  await page.keyboard.type('Keyboard')
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.id), 'lastName')
  const submit = page.locator('form button[type="submit"]').first()
  const box = await submit.boundingBox(); assert.ok(box.height >= 44)
})

;(async () => {
  const browser = await chromium.launch(process.env.OUTCLASS_CHROMIUM ? { executablePath: process.env.OUTCLASS_CHROMIUM } : {})
  const report = []
  try {
    for (const { name, fn } of results) {
      try { await fn(browser); report.push({ name, pass: true }); console.log('PASS', name) }
      catch (error) { report.push({ name, pass: false, error: error.message }); console.log('FAIL', name, '-', error.message); process.exitCode = 1 }
    }
  } finally { await browser.close() }
  if (process.env.OUTCLASS_AUDIT_OUT) fs.writeFileSync(process.env.OUTCLASS_AUDIT_OUT, JSON.stringify(report, null, 2))
})()
