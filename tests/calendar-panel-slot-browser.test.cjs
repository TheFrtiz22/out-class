// Calendar: an interview-panel slot the person sits on is theirs to run, not an interview of their own.
// It used to read "Interview · Confirmed", show their own application's status and "View application",
// and tell them to "Contact the club" about their own panel. Real browser on the isolated student-screens
// fixture (fictional data; no sessions or server actions).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright')
const { startStudentScreens } = require('./helpers/student-screens-fixture.cjs')

test('browser: a panel slot says you are on the panel and opens interview tools', async t => {
  const screens = await startStudentScreens(); t.after(() => screens.close())
  const browser = await chromium.launch({ headless: true, ...(!fs.existsSync(chromium.executablePath()) ? { channel: 'chrome' } : {}) }); t.after(() => browser.close())
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true }); t.after(() => context.close())
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto(screens.url('page=calendar&scenario=panel'))
  const row = page.getByRole('button', { name: /interview panel/ }).first()
  await row.waitFor()
  assert.match(await row.innerText(), /You’re on the panel/)
  assert.doesNotMatch(await row.innerText(), /Confirmed/)
  await row.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  const text = await dialog.innerText()
  assert.match(text, /You’re on the panel/)
  assert.doesNotMatch(text, /Interview confirmed|Application status|Contact the club/)
  assert.equal(await dialog.getByRole('button', { name: 'View application' }).count(), 0)
  assert.match(await dialog.getByRole('link', { name: 'Open interview tools' }).getAttribute('href'), /^\/club\/[^/]+\/interview$/)
  assert.deepEqual(errors, [])
})
