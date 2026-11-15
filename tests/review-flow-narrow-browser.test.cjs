// The applicant review dialog never scrolls sideways (operational-dashboards-e2e checks this on Linux CI).
// Linux Chromium's default fonts are wider than Windows', so this forces a wide font everywhere, and gives the bar
// the dashboard's content (title "Applicant review" plus "Next assigned review"), which overflowed at 390px.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright')
const { startLeaderScreens } = require('./helpers/leader-screens-fixture.cjs')

test('review dialog fits every tested width with a wide font and the dashboard bar', { timeout: 300000 }, async t => {
  const fixture = await startLeaderScreens(); t.after(() => fixture.close(), { timeout: 30000 })
  const browser = await chromium.launch({ headless: true, ...(!fs.existsSync(chromium.executablePath()) ? { channel: 'chrome' } : {}) }); t.after(() => browser.close(), { timeout: 30000 })
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })).newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(fixture.url('section=recruitment&tool=decisions&decisionTab=review'))
  await page.getByRole('button', { name: 'Review applicants needing a decision', exact: true }).click({ timeout: 60000 })
  const dialog = page.getByRole('dialog'); await dialog.waitFor()
  await page.addStyleTag({ content: '*{font-family:Verdana,"DejaVu Sans",sans-serif!important}' })
  // The dashboard's bar: its title and the extra outline "Next assigned review" button.
  await dialog.evaluate(el => {
    el.querySelector('.oc-review-flow-title').textContent = 'Applicant review'
    const nav = el.querySelector('nav[aria-label="Applicant navigation"]'), close = nav.lastElementChild, next = close.cloneNode(true)
    // An outline button's classes, not the icon button's fixed square (the real one is <Button variant="outline" size="sm">).
    const outline = [...document.querySelectorAll('button')].find(b => /outline/.test(b.className) || b.getAttribute('data-variant') === 'outline')
    next.removeAttribute('aria-label'); if (outline) next.className = outline.className; next.textContent = 'Next assigned review'; nav.insertBefore(next, close)
  })
  const wide = () => dialog.evaluate(el => [...el.querySelectorAll('*')].filter(n => n.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).slice(0, 4).map(n => `${n.tagName.toLowerCase()}.${String(n.className).slice(0, 50)}`).join(' | '))
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    // Let the open animation and the injected font settle (the CI check first waits for the Overall field).
    await page.waitForTimeout(300)
    const size = await dialog.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }))
    assert.ok(size.scroll <= size.client + 1, `no sideways scroll at ${width}px (${size.scroll} > ${size.client}): ${size.scroll > size.client + 1 ? await wide() : ''}`)
    // Navigation stays reachable: every bar control is inside the dialog.
    const outside = await dialog.evaluate(el => [...el.querySelectorAll('.oc-review-flow-bar button')].filter(b => b.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).length)
    assert.equal(outside, 0, `bar controls inside the dialog at ${width}px`)
  }
  assert.deepEqual(errors, [])
})
