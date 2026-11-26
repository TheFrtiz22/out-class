// A sideways-scrolling tab row on phones (Applications: Drafts · In review · Interviews · Decisions). Found live at
// 375px: "Decisions" was cut off at the right edge with nothing to say the row scrolls. The row now fades on the
// side with more tabs, and the selected tab is scrolled fully into view. Isolated student-screens fixture.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { chromium } = require('playwright')
const { startStudentScreens } = require('./helpers/student-screens-fixture.cjs')

test('browser: a tab row that overflows fades on the side with more tabs and shows the selected tab', { timeout: 300000 }, async t => {
  const fixture = await startStudentScreens(); t.after(() => fixture.close())
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close())
  const state = page => page.locator('[role=tablist][aria-label="Applications"]').evaluate(el => {
    const box = el.getBoundingClientRect(), sel = el.querySelector('[aria-selected="true"]').getBoundingClientRect()
    return { overflow: el.dataset.overflow ?? null, mask: getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage, scrolls: el.scrollWidth > el.clientWidth + 1, selectedVisible: sel.left >= box.left - 1 && sel.right <= box.right + 1, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }
  })
  for (const width of [320, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } })
    await page.goto(fixture.url('page=tabs')); await page.getByRole('tablist', { name: 'Applications' }).waitFor()
    let s = await state(page)
    assert.equal(s.scrolls, true, `${width}px: the row is wider than the screen in this fixture`)
    assert.equal(s.overflow, 'end', `${width}px: at the start only the right edge fades`)
    assert.notEqual(s.mask, 'none', `${width}px: a fade is drawn`)
    assert.equal(s.pageOverflow <= 0, true, `${width}px: the page itself never scrolls sideways`)
    await page.locator('[role=tablist][aria-label="Applications"]').evaluate(el => { el.scrollLeft = el.scrollWidth })
    await page.waitForTimeout(100); s = await state(page)
    assert.equal(s.overflow, 'start', `${width}px: scrolled to the end, only the left edge fades`)
    await page.goto(fixture.url('page=tabs&tab=decisions')); await page.getByRole('tablist', { name: 'Applications' }).waitFor(); await page.waitForTimeout(100)
    s = await state(page)
    assert.equal(s.selectedVisible, true, `${width}px: the selected last tab is scrolled fully into view`)
    await page.close()
  }
  const wide = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await wide.goto(fixture.url('page=tabs')); await wide.getByRole('tablist', { name: 'Applications' }).waitFor()
  const s = await state(wide)
  assert.equal(s.scrolls, false); assert.equal(s.overflow, null, 'no fade when every tab fits')
})
