/** Run against a local dev or production server; never submits account or school forms. */
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
    await page.addInitScript(() => {
      window.navigationShifts = []
      if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (entry.sources.some(source => source.node?.closest?.('.oc-public-nav'))) window.navigationShifts.push({ value: entry.value, time: entry.startTime, sources: entry.sources.map(source => ({ className: source.node?.className, previous: source.previousRect.toJSON(), current: source.currentRect.toJSON() })) })
      }).observe({ type: 'layout-shift', buffered: true })
    })
    const response = await page.goto(baseURL, { waitUntil: 'networkidle' })
    assert.equal(response.status(), 200)
    const header = page.locator('.oc-public-nav')
    const desktop = page.getByRole('navigation', { name: 'Main navigation', exact: true })
    const mobile = page.getByRole('navigation', { name: 'Mobile navigation', exact: true })
    const destinations = { 'How It Works': '/#about', 'About OutClass': '/about', FAQ: '/uva#faq', 'Request Your School': '/request-school' }
    for (const [name, href] of Object.entries(destinations)) assert.equal(await desktop.getByRole('link', { name, exact: true }).getAttribute('href'), href)
    assert.equal(await header.getByRole('link', { name: 'Log In', exact: true }).getAttribute('href'), '/login')
    assert.equal(await header.getByRole('link', { name: 'Get Started', exact: true }).getAttribute('href'), '/signup')
    const about = desktop.getByRole('link', { name: 'About OutClass', exact: true })
    const before = await about.boundingBox()
    await about.hover(); await page.waitForTimeout(650)
    assert.notEqual(await about.locator('.oc-public-letter-track').first().evaluate(el => getComputedStyle(el).transform), 'none')
    assert.deepEqual(await about.boundingBox(), before)
    await about.focus()
    assert.equal(await about.evaluate(el => getComputedStyle(el).outlineStyle), 'solid')
    await page.screenshot({ path: '/tmp/outclass-navigation-desktop.png' })
    assert.deepEqual(await page.evaluate(() => window.navigationShifts), [], 'initial render and desktop hover must not shift the header')
    console.log('PASS desktop links, rolling hover, stable metrics, and visible keyboard focus')

    for (const width of [320, 375, 390, 540, 768, 1024, 1099, 1100, 1280, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      assert.equal(await header.evaluate(el => Array.from(el.querySelectorAll('a, button')).filter(item => item.getBoundingClientRect().width && getComputedStyle(item).visibility !== 'hidden' && !item.closest('[inert]')).every(item => { const rect = item.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth + 1 && rect.width >= 40 && rect.height >= 44 })), true, `header fits and touch targets are accessible at ${width}px`)
    }
    console.log('PASS ten viewport sizes from 320px to 1440px')
    await page.setViewportSize({ width: 390, height: 844 })
    // Responsive reflow is intentional; measure interaction shifts at a stable viewport.
    await page.waitForTimeout(650)
    await page.evaluate(() => { window.navigationShifts = [] })
    const toggle = page.getByRole('button', { name: 'Open navigation menu' })
    const heroBefore = await page.locator('#outclass-hero-title').boundingBox()
    await toggle.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(450)
    assert.equal(await mobile.count(), 1)
    for (const [name, href] of Object.entries(destinations)) assert.equal(await mobile.getByRole('link', { name, exact: true }).getAttribute('href'), href)
    assert.equal(await mobile.getByRole('link', { name: 'Log In', exact: true }).getAttribute('href'), '/login')
    assert.deepEqual(await page.locator('#outclass-hero-title').boundingBox(), heroBefore)
    // macOS Safari uses Option-Tab to include links with default keyboard settings.
    await page.keyboard.press(engine === webkit ? 'Alt+Tab' : 'Tab')
    assert.equal(await page.evaluate(() => document.activeElement.closest('a')?.getAttribute('href')), '/#about')
    await page.screenshot({ path: '/tmp/outclass-navigation-mobile.png' })
    await page.keyboard.press('Escape')
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
    assert.equal(await toggle.evaluate(el => el === document.activeElement), true)
    assert.equal(await page.locator('.oc-public-mobile').getAttribute('inert'), '')
    await toggle.click(); await page.mouse.click(385, 500)
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
    await page.waitForTimeout(450)
    assert.deepEqual(await page.evaluate(() => window.navigationShifts), [], 'mobile opening and dismissal must not shift the header')
    await toggle.click(); await mobile.getByRole('link', { name: 'FAQ', exact: true }).focus()
    await page.setViewportSize({ width: 1280, height: 844 })
    await page.waitForFunction(() => document.querySelector('.oc-public-nav').dataset.open === 'false')
    assert.equal(await header.getAttribute('data-open'), 'false')
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'OutClass home')
    console.log('PASS mobile keyboard opening, tab order, Escape, outside dismissal, resizing, and no content shift')

    await page.setViewportSize({ width: 768, height: 460 })
    await toggle.click(); await page.waitForTimeout(450)
    assert.equal(await mobile.getByRole('link', { name: 'Request Your School', exact: true }).isVisible(), true)
    assert.equal(await mobile.evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), true)
    await page.keyboard.press('Escape')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.waitForTimeout(650)
    await page.evaluate(() => { window.navigationShifts = [] })
    await about.hover()
    assert.equal(await about.locator('.oc-public-letter-track').first().evaluate(el => getComputedStyle(el).transform), 'none')
    assert.equal(await about.locator('.oc-public-letter-track').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s')
    await desktop.getByRole('link', { name: 'How It Works', exact: true }).click()
    await page.waitForFunction(() => location.hash === '#about' && scrollY > 32 && document.querySelector('.oc-public-nav').dataset.hero === 'false')
    await page.waitForFunction(() => {
      const header = document.querySelector('.oc-public-nav')
      return getComputedStyle(header.querySelector('.oc-public-link')).color === getComputedStyle(header).color
    })
    assert.equal(await header.getAttribute('data-hero'), 'false')
    assert.equal(await desktop.getByRole('link', { name: 'How It Works', exact: true }).getAttribute('aria-current'), 'location')
    await page.screenshot({ path: '/tmp/outclass-navigation-scrolled.png' })
    const shifts = await page.evaluate(() => window.navigationShifts)
    assert.deepEqual(shifts, [], 'header should not shift during interactions')
    console.log('PASS short tablet layout, reduced motion, native fragments, current link, scroll surface, and zero header layout shifts')

    for (const [name, path] of [['About OutClass', '/about'], ['FAQ', '/uva#faq'], ['Request Your School', '/request-school'], ['Log In', '/login'], ['Get Started', '/signup']]) {
      await page.goto(baseURL, { waitUntil: 'networkidle' })
      await page.locator('.oc-public-nav').getByRole('link', { name, exact: true }).click()
      await page.waitForURL(`${baseURL}${path}`, { waitUntil: 'networkidle' })
      await page.locator('main').first().waitFor({ state: 'visible' })
    }
    assert.deepEqual(errors, [])
    console.log('PASS public destinations and unchanged login/signup routes; no browser errors')
  } finally { await browser.close() }
}
check().catch(error => { console.error(error); process.exitCode = 1 })
