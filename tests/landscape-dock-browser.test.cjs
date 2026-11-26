// The phone bottom bar held sideways. Found live at 812×375: the bar took about a quarter of the height, and with the
// header and title no list rows showed without scrolling. In landscape on short screens it is a slim, centred strip;
// portrait is unchanged. Isolated student-screens fixture.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { chromium } = require('playwright')
const { startStudentScreens } = require('./helpers/student-screens-fixture.cjs')

test('browser: the phone bottom bar is slim in landscape and unchanged in portrait', { timeout: 300000 }, async t => {
  const fixture = await startStudentScreens(); t.after(() => fixture.close())
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close())
  const bar = async (width, height) => {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true })
    await page.goto(fixture.url('page=explore')); await page.locator('.oc-mobile-navigation').waitFor()
    const m = await page.locator('.oc-mobile-navigation').evaluate(el => { const r = el.getBoundingClientRect(); const links = [...el.querySelectorAll('a,button')].map(a => a.getBoundingClientRect()); return { height: r.height, width: r.width, left: r.left, right: innerWidth - r.right, bottom: innerHeight - r.bottom, minTarget: Math.min(...links.map(l => l.height)) } })
    await page.close(); return m
  }
  for (const [w, h] of [[812, 375], [844, 390], [667, 375]]) {
    const m = await bar(w, h), at = `${w}×${h}`
    assert.ok(m.height <= 52, `${at}: the bar is slim (${m.height}px)`)
    assert.ok(m.minTarget >= 40, `${at}: each destination keeps a 40px touch target (${m.minTarget}px)`)
    assert.ok(Math.abs(m.left - m.right) <= 1, `${at}: the bar is centred`)
    assert.ok(m.width <= 36 * 16 + 1, `${at}: the bar is no wider than 36rem (${m.width}px)`)
  }
  const portrait = await bar(390, 844)
  assert.ok(portrait.height >= 60, `portrait keeps the full bar (${portrait.height}px)`)
  assert.ok(portrait.width >= 390 - 24 - 1, 'portrait bar spans the screen')
})
