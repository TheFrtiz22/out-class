/* Run against a local app with OUTCLASS_PLAYWRIGHT_MODULE pointing to Playwright. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { chromium } = require(process.env.OUTCLASS_PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.OUTCLASS_BASE_URL || 'http://localhost:3000'
const output = process.env.OUTCLASS_HERO_QA_DIR || '/tmp/outclass-hero-qa'
const stack = '.oc-feature-stack'
const active = '.oc-feature-card[aria-hidden="false"]'
const label = page => page.locator(active).getAttribute('aria-label')
const waitSlide = (page, slide) => page.waitForFunction(expected =>
  document.querySelector('.oc-feature-card[aria-hidden="false"]')?.getAttribute('aria-label') === `${expected} of 6`, slide)
const idle = page => page.waitForFunction(() =>
  document.querySelector('.oc-feature-stage').getAnimations({ subtree: true }).length === 0)

async function run() {
  await fs.mkdir(output, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.OUTCLASS_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      window.heroShifts = []
      new PerformanceObserver(list => list.getEntries().forEach(entry => {
        if (!entry.hadRecentInput) window.heroShifts.push(entry.value)
      })).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.locator(stack).hover()
    await idle(page)
    let start = Number((await label(page)).split(' ')[0])
    await page.screenshot({ path: `${output}/desktop.png` })
    assert.equal(await page.locator('.oc-opening-panels, .oc-opening-panel, .oc-hero-preview').count(), 0)
    assert.equal(await page.locator('.oc-intro-backdrop img').evaluate(image => image.complete && image.naturalWidth > 0), true)
    assert.equal(await page.locator('.oc-feature-card[aria-hidden="true"]').count(), 5)
    assert.equal(await page.locator('.oc-hero-demo-link').getAttribute('href'), '/preview?view=student-dashboard')
    const heroRect = await page.locator('#landing-content').boundingBox()
    await page.waitForTimeout(3800)
    assert.equal(await label(page), `${start} of 6`, 'hover pauses autoplay')

    // Observe two complete real-time cycles, including both sixth-to-first glides.
    await page.mouse.move(0, 0)
    for (let turn = 1; turn <= 12; turn++) {
      const expected = (start - 1 + turn) % 6 + 1
      await waitSlide(page, expected)
      await idle(page)
      assert.equal(await page.locator(`${stack} [aria-live]`).textContent(), '', 'autoplay stays silent')
      console.log(`Autoplay ${turn}/12: ${expected} of 6`)
    }
    assert.deepEqual(await page.locator('#landing-content').boundingBox(), heroRect, 'motion never changes hero layout')
    assert.equal(await page.evaluate(() => window.heroShifts.reduce((sum, value) => sum + value, 0)), 0)

    await page.waitForFunction(() => document.querySelector('.oc-feature-stage').getAnimations({ subtree: true }).length > 0)
    await page.locator(stack).hover()
    const times = () => page.locator('.oc-feature-stage').evaluate(element =>
      element.getAnimations({ subtree: true }).map(animation => animation.currentTime))
    const stopped = await times()
    await page.waitForTimeout(250)
    assert.deepEqual(await times(), stopped, 'hover freezes an in-flight shuffle')
    await page.mouse.move(0, 0)
    await idle(page)
    start = Number((await label(page)).split(' ')[0])

    const next = page.getByRole('button', { name: 'Next feature', exact: true })
    await next.focus()
    await page.mouse.move(0, 0)
    const focused = await label(page)
    await page.waitForTimeout(3800)
    assert.equal(await label(page), focused, 'keyboard focus pauses autoplay')
    await next.click()
    await waitSlide(page, start % 6 + 1)
    assert.ok(await page.locator(`${stack} [aria-live]`).textContent(), 'manual changes announce the feature')
    await page.getByRole('button', { name: 'Previous feature', exact: true }).click()
    await waitSlide(page, start)

    await page.evaluate(() => document.activeElement.blur())
    await page.mouse.move(0, 0)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(3800)
    assert.equal(await label(page), `${start} of 6`, 'hidden-tab event pauses autoplay')
    await page.evaluate(() => {
      delete document.hidden
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.locator('#create-account').scrollIntoViewIfNeeded()
    await page.waitForTimeout(3800)
    assert.equal(await label(page), `${start} of 6`, 'offscreen stack pauses autoplay')
    await page.locator(stack).scrollIntoViewIfNeeded()
    await next.click()
    await page.waitForTimeout(350)
    // Changing motion preference during a shuffle settles without a flash.
    assert.ok((await times()).length)

    // Reduced motion has a static foreground and instantaneous manual changes.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await idle(page)
    const reduced = await label(page)
    await page.waitForTimeout(3800)
    assert.equal(await label(page), reduced)
    await next.click()
    await idle(page)
    assert.notEqual(await label(page), reduced)
    assert.equal(await page.locator('.oc-feature-autoplay').isVisible(), false)
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 900 })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: `${output}/${width}.png` })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px has no horizontal overflow`)
      assert.equal(await page.locator(active).evaluate(card => {
        const text = card.querySelector('.oc-feature-statement').getBoundingClientRect()
        const bounds = card.getBoundingClientRect()
        return text.left >= bounds.left && text.right <= bounds.right && text.bottom <= bounds.bottom
      }), true, `${width}px card text fits`)
      const cta = await page.locator('.oc-hero-ctas button').boundingBox()
      assert.ok(cta.y + cta.height < (width < 600 ? 844 : 900), 'primary CTA is in the initial viewport')
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.locator('.oc-hero-ctas button').click()
    await page.getByRole('dialog').waitFor()
    assert.ok(await page.getByRole('heading', { name: 'Create your student profile', exact: true }).count())
    await page.keyboard.press('Escape')
    await page.getByRole('link', { name: 'Sign in', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('.oc-feature-stack'))
    assert.deepEqual(errors, [], 'no browser errors or hydration failures')
    console.log('Responsive, motion preferences, pause conditions, accessibility, CTA, and cleanup checks passed.')

    const noJS = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } })
    await noJS.goto(base, { waitUntil: 'load' })
    assert.equal(await noJS.locator('.oc-intro-backdrop img').evaluate(image => image.complete && image.naturalWidth > 0), true)
    assert.equal(await noJS.locator(active).count(), 1)
    await noJS.screenshot({ path: `${output}/no-js.png` })
    console.log(`Server-rendered Rotunda and first feature verified. Screenshots: ${output}`)
  } finally {
    await browser.close()
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
