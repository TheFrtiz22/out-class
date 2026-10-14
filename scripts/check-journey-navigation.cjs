/** Exercise the showcase/navbar handoff against a local dev or production build. */
const assert = require('node:assert/strict')
const { chromium, webkit } = require('playwright')
const baseURL = process.env.OUTCLASS_NAV_BASE_URL || 'http://127.0.0.1:3000'
const engine = process.env.OUTCLASS_NAV_BROWSER === 'webkit' ? webkit : chromium
async function check() {
  const browser = await engine.launch({ headless: true, ...(engine === chromium ? { channel: 'chrome' } : {}) })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    assert.equal((await page.goto(baseURL, { waitUntil: 'networkidle' })).status(), 200)
    const header = page.locator('.oc-public-nav')
    const original = page.locator('.oc-journey-controls')
    const compact = page.locator('.oc-public-journey-desktop')
    const mobile = page.locator('.oc-public-journey-mobile')
    const settleAnimations = locator => locator.evaluate(async el => {
      await Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
    })
    const merged = value => page.waitForFunction(expected => !!document.querySelector('.oc-public-nav').dataset.journey === expected, value)
    const geometry = () => page.evaluate(() => ({
      start: document.querySelector('.oc-journey-handoff-sentinel').getBoundingClientRect().top + scrollY,
      end: document.querySelector('.oc-journey-end-sentinel').getBoundingClientRect().top + scrollY,
      edge: document.querySelector('.oc-public-nav-surface').getBoundingClientRect().bottom + 12,
      endEdge: document.querySelector('.oc-public-nav-surface').getBoundingClientRect().bottom + 12 + Math.min(innerHeight / 2, 320),
    }))
    const scroll = top => page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top)
    const startAt = async top => { const g = await geometry(); await scroll(g.start - top) }
    const endAt = async top => { const g = await geometry(); await scroll(g.end - top) }
    const navMetrics = () => header.locator('.oc-public-logo, .oc-public-desktop > a, .oc-public-account > a').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))
    const sync = async perspective => {
      await page.waitForFunction(value => document.querySelector('#product-journey').dataset.perspective === value, perspective)
      assert.equal(await original.locator(`[data-perspective-option="${perspective}"]`).getAttribute('aria-pressed'), 'true')
      assert.equal(await compact.locator(`[data-perspective-option="${perspective}"]`).getAttribute('aria-pressed'), 'true')
    }
    await merged(false)
    assert.equal(await original.evaluate(el => getComputedStyle(el).position), 'relative')
    assert.equal(await original.getAttribute('inert'), null)
    assert.equal(await compact.isVisible(), false)
    const initialMetrics = await navMetrics()
    console.log('PASS initial navbar, original control, and no secondary sticky header')

    let g = await geometry()
    await startAt(g.edge + 50)
    await original.getByRole('button', { name: 'For Students', exact: true }).evaluate(el => el.focus({ preventScroll: true }))
    for (const offset of [20, 6]) { await startAt(g.edge + offset); await page.waitForTimeout(80); assert.equal(await header.getAttribute('data-journey'), null) }
    const positionsBefore = await page.locator('.oc-journey-controls-slot, #journey-1').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top + scrollY))
    await startAt(g.edge - 2); await merged(true)
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.oc-journey-controls')).opacity === '0')
    assert.equal(await original.getAttribute('inert'), '')
    assert.equal(await original.evaluate(el => getComputedStyle(el).opacity), '0')
    assert.equal(await compact.isVisible(), true)
    assert.equal(await compact.locator('[data-perspective-option="student"]').evaluate(el => el === document.activeElement), true)
    assert.deepEqual(await navMetrics(), initialMetrics)
    assert.deepEqual(await page.locator('.oc-journey-controls-slot, #journey-1').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top + scrollY)), positionsBefore)
    for (const offset of [6, -3, 22, 1]) { await startAt(g.edge + offset); await page.waitForTimeout(70); assert.equal(await header.getAttribute('data-journey'), 'true') }
    console.log('PASS slow handoff, hysteresis, keyboard focus, and unchanged page/navbar layout')

    const y = await page.evaluate(() => scrollY)
    await compact.getByRole('button', { name: 'Club Leaders', exact: true }).click()
    await sync('leader')
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - y) < 2)
    await settleAnimations(compact)
    await page.screenshot({ path: '/tmp/outclass-journey-desktop.png' })
    // Safari keeps the prior keyboard focus when a button is clicked with a mouse.
    await compact.getByRole('button', { name: 'Club Leaders', exact: true }).evaluate(el => el.focus({ preventScroll: true }))
    await startAt(g.edge + 40); await merged(false); await page.waitForTimeout(400)
    assert.equal(await original.locator('[data-perspective-option="leader"]').evaluate(el => el === document.activeElement), true)
    await original.getByRole('button', { name: 'For Students', exact: true }).click(); await sync('student')
    await startAt(g.edge - 40); await merged(true)
    await compact.getByRole('button', { name: 'Club Leaders', exact: true }).click(); await sync('leader')
    console.log('PASS both controls share state and preserve perspective URL/content switching without scrolling')

    g = await geometry()
    await endAt(g.endEdge - 10); await merged(false)
    await endAt(g.endEdge + 10); await page.waitForTimeout(100); assert.equal(await header.getAttribute('data-journey'), null)
    await endAt(g.endEdge + 30); await merged(true)
    for (let i = 0; i < 3; i++) {
      await scroll(0); await merged(false)
      g = await geometry(); await scroll(g.start + 800); await merged(true)
      await scroll(g.end + 200); await merged(false)
    }
    console.log('PASS showcase exit, upward reversal, and repeated rapid jumps')

    for (const width of [1440, 1280, 1100, 1024, 768, 767, 540, 390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await page.waitForTimeout(150)
      g = await geometry(); await startAt(g.edge - 60); await merged(true); await page.waitForTimeout(400)
      if (width >= 768) {
        assert.equal(await compact.isVisible(), true)
        assert.equal(await compact.evaluate(el => {
          const rect = el.getBoundingClientRect(), brand = document.querySelector('.oc-public-logo').getBoundingClientRect()
          const sibling = document.querySelector(innerWidth >= 1100 ? '.oc-public-desktop' : '.oc-public-account').getBoundingClientRect()
          return rect.left >= brand.right + 8 && rect.right <= sibling.left - 8
        }), true, `compact control fits at ${width}px`)
        await compact.getByRole('button', { name: 'Students', exact: true }).click(); await sync('student')
      } else {
        assert.equal(await compact.isVisible(), false)
        const menu = header.getByRole('button', { name: 'Open navigation menu and perspective switcher', exact: true })
        await menu.click()
        await mobile.getByRole('button', { name: 'Club Leaders', exact: true }).click(); await sync('leader')
        assert.equal(await mobile.locator('[data-perspective-option="leader"]').getAttribute('aria-pressed'), 'true')
        assert.equal(await header.getByRole('button', { name: 'Close navigation menu' }).getAttribute('aria-expanded'), 'true')
        if (width === 390) { await settleAnimations(page.locator('.oc-public-mobile')); await page.screenshot({ path: '/tmp/outclass-journey-mobile.png' }) }
        await page.keyboard.press('Escape')
      }
      assert.equal(await header.evaluate(el => Array.from(el.querySelectorAll('button')).filter(button => button.getBoundingClientRect().width && !button.closest('[inert]')).every(button => { const r = button.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height >= 44 })), true)
    }
    console.log('PASS desktop, tablet, and mobile controls across nine widths without crowded or overlapping navigation')

    await page.setViewportSize({ width: 390, height: 844 })
    await scroll(0); await merged(false)
    g = await geometry(); await startAt(g.edge + 40)
    await original.getByRole('button', { name: 'For Students', exact: true }).evaluate(el => el.focus({ preventScroll: true }))
    await startAt(g.edge - 40); await merged(true)
    await page.waitForFunction(() => document.activeElement.classList.contains('oc-public-menu-toggle'))
    await page.keyboard.press('Enter')
    await page.keyboard.press(engine === webkit ? 'Alt+Tab' : 'Tab')
    assert.equal(await mobile.getByRole('button', { name: 'Students', exact: true }).evaluate(el => el === document.activeElement), true)
    await page.keyboard.press('Space'); await sync('student'); await page.keyboard.press('Escape')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.ok(await original.evaluate(el => getComputedStyle(el).transitionDuration.split(',').every(duration => parseFloat(duration) <= .001)))
    await header.getByRole('button', { name: 'Open navigation menu and perspective switcher' }).click()
    assert.ok(await mobile.locator('.oc-perspective-indicator').evaluate(el => getComputedStyle(el).transitionDuration.split(',').every(duration => parseFloat(duration) <= .001)))
    await mobile.getByRole('button', { name: 'Club Leaders', exact: true }).click(); await sync('leader')
    await page.keyboard.press('Escape')
    await scroll(0); await merged(false)
    console.log('PASS mobile keyboard handoff, synchronized selection, and reduced motion')

    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`${baseURL}/#journey-2`, { waitUntil: 'networkidle' }); await merged(true)
    assert.equal(await header.getByRole('link', { name: 'Get Started', exact: true }).getAttribute('href'), '/signup')
    assert.equal(await header.getByRole('link', { name: 'Log In', exact: true }).getAttribute('href'), '/login')
    assert.deepEqual(errors, [])
    console.log('PASS direct chapter entry, existing account routes, and no browser errors')
  } finally { await browser.close() }
}
check().catch(error => { console.error(error); process.exitCode = 1 })
