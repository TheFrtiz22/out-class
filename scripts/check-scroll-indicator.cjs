/** Verify the native hero cue against a local development or production server. */
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
      window.indicatorScrolls = []
      window.indicatorShifts = []
      const scrollTo = window.scrollTo.bind(window)
      window.scrollTo = (...args) => { window.indicatorScrolls.push(args[0]); return scrollTo(...args) }
      if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (entry.sources.some(source => source.node?.closest?.('.oc-scroll-indicator'))) window.indicatorShifts.push(entry.value)
      }).observe({ type: 'layout-shift', buffered: true })
    })
    assert.equal((await page.goto(`${baseURL}/?campaign=scroll-cue`, { waitUntil: 'networkidle' })).status(), 200)
    const button = page.locator('.oc-scroll-indicator')
    const motion = button.locator('.oc-scroll-indicator-motion')
    const availability = available => page.waitForFunction(value => document.querySelector('.oc-scroll-indicator').dataset.available === String(value), available)
    const settleCue = async () => {
      await button.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))) })
      await page.locator('.oc-public-nav').evaluate(async el => { await Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))) })
    }
    const scroll = top => page.evaluate(value => window.scrollTo({ top: value, behavior: 'instant' }), top)
    const reached = () => page.waitForFunction(() => {
      const section = document.querySelector('#about'), header = document.querySelector('.oc-public-nav-surface')
      const clearance = Math.max(parseFloat(getComputedStyle(section).scrollMarginTop), header.getBoundingClientRect().bottom + 24)
      return location.hash === '#about' && Math.abs(section.getBoundingClientRect().top - clearance) < 2
    })
    await availability(true)
    assert.equal(await page.getByRole('button', { name: 'Scroll to learn how OutClass works', exact: true }).count(), 1)
    const initialBox = await button.boundingBox()
    assert.equal(initialBox.x + initialBox.width / 2, 720)
    assert.ok(initialBox.width >= 44 && initialBox.height >= 44)
    assert.equal(await button.locator('svg').getAttribute('width'), '26')
    const animation = await motion.evaluate(el => {
      const animation = el.getAnimations()[0]
      return { duration: animation.effect.getTiming().duration, frames: animation.effect.getKeyframes().map(frame => frame.transform), playState: animation.playState }
    })
    assert.equal(animation.duration, 1650)
    assert.equal(animation.playState, 'running')
    assert.ok(animation.frames.includes('translateY(11px)'))
    assert.equal(animation.frames.at(-1), animation.frames.at(-2))
    const positions = []
    for (let i = 0; i < 6; i++) {
      positions.push(await motion.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42))
      await page.waitForTimeout(275)
    }
    assert.ok(Math.max(...positions) > 3 && Math.max(...positions) <= 11.1)
    assert.ok(Math.min(...positions) >= -1.1)
    assert.deepEqual(await button.boundingBox(), initialBox)
    assert.deepEqual(await page.evaluate(() => window.indicatorShifts), [])
    await settleCue(); await page.screenshot({ path: '/tmp/outclass-scroll-cue-desktop.png' })
    console.log('PASS initial placement, accessible size, gentle transform-only bounce, pause, and no layout shifts')

    await button.click(); await reached(); await availability(false)
    assert.equal(await page.evaluate(() => window.indicatorScrolls.at(-1).behavior), 'smooth')
    assert.equal(new URL(page.url()).searchParams.get('campaign'), 'scroll-cue')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'about')
    assert.equal(await page.locator('.oc-how-introduction h2').evaluate(el => el.getBoundingClientRect().top > document.querySelector('.oc-public-nav-surface').getBoundingClientRect().bottom + 16), true)
    assert.equal(await button.getAttribute('disabled'), '')
    assert.equal(await button.getAttribute('tabindex'), '-1')
    assert.equal(await button.getAttribute('aria-hidden'), 'true')
    assert.equal(await motion.evaluate(el => getComputedStyle(el).animationPlayState), 'paused')
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.oc-scroll-indicator')).opacity === '0')
    await page.goBack({ waitUntil: 'networkidle' }); await scroll(0); await availability(true)
    assert.equal(new URL(page.url()).hash, '')
    console.log('PASS smooth click, native fragment/history, preserved query, focus, navbar clearance, fade-out, pause, and return')

    for (const key of ['Enter', 'Space']) {
      await scroll(0); await availability(true)
      await button.focus(); await page.keyboard.press(key); await reached(); await availability(false)
    }
    const historyLength = await page.evaluate(() => history.length)
    await scroll(0); await availability(true); await button.click(); await reached()
    assert.equal(await page.evaluate(() => history.length), historyLength)
    console.log('PASS Enter and Space activation without duplicate history entries')

    for (const [width, height] of [[1440, 1000], [1280, 900], [1100, 900], [1024, 900], [820, 1180], [768, 1024], [540, 900], [390, 844], [375, 812], [320, 568]]) {
      await page.setViewportSize({ width, height }); await scroll(0); await page.waitForTimeout(200)
      const geometry = await button.evaluate(el => {
        const region = el.closest('[data-scroll-indicator-region]'), rect = el.getBoundingClientRect()
        return { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, gap: rect.top - region.querySelector('[data-scroll-indicator-content]').getBoundingClientRect().bottom, heroHeight: region.getBoundingClientRect().height }
      })
      assert.ok(geometry.width >= 44 && geometry.height >= 44)
      if (geometry.gap < 16) {
        await availability(false)
        assert.equal(await button.getAttribute('disabled'), '')
      } else {
        if (geometry.bottom > height) await scroll(geometry.bottom - height + 24)
        await availability(true)
        assert.equal(await button.evaluate(el => {
          const r = el.getBoundingClientRect()
          return Math.abs(r.left + r.width / 2 - innerWidth / 2) < 1 && r.bottom <= innerHeight && r.top >= document.querySelector('.oc-public-nav-surface').getBoundingClientRect().bottom + 8
        }), true)
        assert.equal(await button.evaluate(el => el.getBoundingClientRect().top - el.closest('[data-scroll-indicator-region]').querySelector('[data-scroll-indicator-content]').getBoundingClientRect().bottom >= 16), true)
        if (width === 390) { await settleCue(); await page.screenshot({ path: '/tmp/outclass-scroll-cue-mobile.png' }) }
        await button.click(); await reached(); await availability(false)
      }
    }
    await page.setViewportSize({ width: 844, height: 390 }); await scroll(0); await page.waitForTimeout(200)
    assert.equal(await button.getAttribute('disabled'), '')
    console.log('PASS ten desktop/tablet/mobile sizes, safe spacing, viewport-aware availability, and compact landscape priority')

    await page.setViewportSize({ width: 1440, height: 1000 }); await scroll(0); await availability(true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await motion.evaluate(el => getComputedStyle(el).animationName), 'none')
    await button.focus(); await page.keyboard.press('Space'); await reached()
    assert.equal(await page.evaluate(() => window.indicatorScrolls.at(-1).behavior), 'instant')
    assert.deepEqual(errors, [])
    console.log('PASS reduced motion, immediate scrolling, and no browser errors')
  } finally { await browser.close() }
}
check().catch(error => { console.error(error); process.exitCode = 1 })
