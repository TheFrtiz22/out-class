// Applicants toolbar between phone and desktop (landscape phones, small tablets, narrow windows), on the isolated
// leader-screens fixture (fictional data, server calls stubbed). Found live at 812×375: the one-row layout held until
// 760px but needs about 820px, so search was cut to "Name, ID or r", the sort arrow sat under Filters and More
// spilled past the toolbar. Every control must sit inside the toolbar without overlapping another.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { chromium } = require('playwright')
const { startLeaderScreens } = require('./helpers/leader-screens-fixture.cjs')

test('browser: from 700 to 1280px the applicants toolbar controls never overlap or spill out', { timeout: 300000 }, async t => {
  const fixture = await startLeaderScreens(); t.after(() => fixture.close())
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close())
  for (const [width, height] of [[700, 900], [812, 375], [844, 390], [900, 700], [1024, 768], [1126, 764], [1280, 800]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
    await context.clock.setFixedTime(new Date('2026-11-09T15:00:00-05:00'))
    const page = await context.newPage()
    await page.goto(fixture.url('section=recruitment&tool=applicants')); await page.locator('main h1').first().waitFor(); await page.waitForTimeout(300)
    const m = await page.evaluate(() => {
      const bar = document.querySelector('main .oc-applicants-toolbar'), b = bar.getBoundingClientRect()
      const parts = [...bar.querySelectorAll('.oc-view-switch, .oc-status-select, .oc-toolbar-search, [data-sort-control] .oc-pill-select-trigger, .oc-sort-direction, .oc-toolbar-tools > *')]
        .filter(el => el.getBoundingClientRect().width > 0)
        .map(el => { const r = el.getBoundingClientRect(); return { name: (el.className || '').toString().split(' ').find(c => c.startsWith('oc-')) || el.tagName, l: r.left, r: r.right, t: r.top, b: r.bottom } })
      const overlaps = []
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i], c = parts[j]
        if (a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5) overlaps.push(`${a.name} × ${c.name}`)
      }
      const outside = parts.filter(p => p.l < b.left - 0.5 || p.r > b.right + 0.5).map(p => p.name)
      const search = bar.querySelector('.oc-toolbar-search input')
      return { overlaps, outside, searchWidth: search ? search.getBoundingClientRect().width : 0 }
    })
    const at = `at ${width}×${height}`
    assert.deepEqual(m.overlaps, [], `${at}: no toolbar control overlaps another`)
    assert.deepEqual(m.outside, [], `${at}: every control stays inside the toolbar`)
    assert.ok(m.searchWidth >= 120, `${at}: the search box keeps room for its placeholder (${m.searchWidth}px)`)
    await context.close()
  }
})
