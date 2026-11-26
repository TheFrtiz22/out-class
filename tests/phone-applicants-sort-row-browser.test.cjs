// Applicants toolbar on narrow phones, on the isolated leader-screens fixture (fictional data, server calls stubbed).
// Sort, Filters and More share one row; Sort gives way by truncating its value, so neither Filters nor More is ever
// painted over the sort arrow. PR #662 first shipped a version where the sort control kept its full width inside a
// shrunken slot, so Filters covered the arrow at 375px in CI.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { chromium } = require('playwright')
const { startLeaderScreens } = require('./helpers/leader-screens-fixture.cjs')

test('browser: on 320–390px phones the Sort control is whole, clickable at both ends, and shares one row with Filters and More', { timeout: 300000 }, async t => {
  const fixture = await startLeaderScreens(); t.after(() => fixture.close())
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close())
  for (const width of [320, 360, 375, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 764 }, reducedMotion: 'reduce' })
    await context.clock.setFixedTime(new Date('2026-11-09T15:00:00-05:00'))
    const page = await context.newPage()
    await page.goto(fixture.url('section=recruitment&tool=applicants')); await page.locator('main h1').first().waitFor(); await page.waitForTimeout(300)
    const m = await page.evaluate(() => {
      const control = document.querySelector('main .oc-applicants-toolbar [data-sort-control]')
      control.scrollIntoView({ block: 'center' })
      const r = control.getBoundingClientRect(), y = r.top + r.height / 2
      const slot = control.closest('.oc-toolbar-sort').getBoundingClientRect()
      const tools = [...document.querySelectorAll('main .oc-applicants-toolbar .oc-toolbar-tools > *')].filter(el => el.getBoundingClientRect().width > 0).map(el => el.getBoundingClientRect())
      const hits = [r.left + 6, r.right - 6].map(x => document.elementFromPoint(x, y))
      return {
        right: r.right, slotRight: slot.right, inside: hits.every(hit => hit && control.contains(hit)),
        overlaps: tools.some(b => b.left < r.right - 0.5 && b.right > r.left && b.top < r.bottom && b.bottom > r.top),
        sameRow: tools.every(b => Math.abs((b.top + b.height / 2) - y) < 4), onScreen: r.left >= 0 && tools.every(b => b.right <= innerWidth),
      }
    })
    const at = `at ${width}px`
    assert.ok(m.right <= m.slotRight + 0.5, `${at}: the sort control stays inside its slot (${m.right} > ${m.slotRight})`)
    assert.equal(m.overlaps, false, `${at}: Filters and More do not overlap the sort control`)
    assert.ok(m.inside, `${at}: both ends of the sort control receive clicks`)
    assert.ok(m.sameRow, `${at}: Sort, Filters and More share one row`)
    assert.ok(m.onScreen, `${at}: the row fits the screen`)
    await context.close()
  }
})
