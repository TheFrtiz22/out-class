// Workspace lists and the applicant quick review at real widths, on the isolated fixtures (fictional data,
// live server calls stubbed). Layout follows the list's own width (container queries), not the viewport.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { chromium } = require('playwright')
const { startLeaderScreens } = require('./helpers/leader-screens-fixture.cjs')
const { startListPages } = require('./helpers/list-pages-fixture.cjs')

const widths = [375, 614, 1126, 1280, 1512]
const pages = [['Applicants', 'leader', 'section=recruitment&tool=applicants'], ['Members (Demo)', 'leader', 'section=members'], ['Interviews', 'leader', 'section=recruitment&tool=interviews'], ['Members', 'list', 'page=members'], ['Announcements', 'list', 'page=announcements']]

async function measure(page) {
  return page.evaluate(() => {
    const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const control = document.querySelector('main [data-sort-control]')
    let sortOnScreen = false
    if (control) {
      control.scrollIntoView({ block: 'center' }); const r = control.getBoundingClientRect()
      const hits = [document.elementFromPoint(r.left + 6, r.top + r.height / 2), document.elementFromPoint(r.right - 6, r.top + r.height / 2)]
      sortOnScreen = r.left >= 0 && r.right <= innerWidth && hits.every(hit => hit && control.contains(hit)); window.scrollTo(0, 0)
    }
    const cards = [...document.querySelectorAll('main [data-list-card]')].filter(shown)
    // Wide lists sort from their column headers; the toolbar SortControl beside them is for the card layout only.
    const sortableHeaders = [...document.querySelectorAll('main .oc-dt thead th button')].some(shown)
    const cardsOnlySortShown = [...document.querySelectorAll('main .oc-dt-cards-sort')].some(shown)
    return {
      sortableHeaders, cardsOnlySortShown,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sortOnScreen,
      rows: [...document.querySelectorAll('main .oc-dt tbody tr')].filter(shown).map(r => r.getBoundingClientRect().height),
      cards: cards.map(c => c.getBoundingClientRect().height),
      labelled: cards.some(c => /\b(Select|Member|Year|Role)\s*:/.test(c.innerText)),
    }
  })
}

test('browser: every list keeps a visible sort (control or headers), one-line rows or two-line cards, and no page scroll at five widths; the quick review fits', { timeout: 600000 }, async t => {
  const fixtures = { leader: await startLeaderScreens(), list: await startListPages() }
  t.after(async () => { for (const f of Object.values(fixtures)) await f.close() })
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close())
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 764 }, reducedMotion: 'reduce' })
    // The leader-screens fixture seeds Demo data from 2026-11-09; pin the page clock there so its
    // interviews stay upcoming (a real clock aged them into the past on Nov 13 and the list emptied).
    await context.clock.setFixedTime(new Date('2026-11-09T15:00:00-05:00'))
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message))
    for (const [name, fixture, query] of pages) {
      await page.goto(fixtures[fixture].url(query)); await page.locator('main h1').first().waitFor(); await page.waitForTimeout(500)
      const m = await measure(page), at = `${name} at ${width}px`
      assert.ok(m.pageOverflow <= 0, `${at}: the page never scrolls sideways (${m.pageOverflow}px)`)
      assert.ok(m.sortOnScreen || m.sortableHeaders, `${at}: a Sort control or sortable column headers are on screen`)
      if (m.rows.length && m.sortableHeaders) assert.equal(m.cardsOnlySortShown, false, `${at}: no second sort control beside sortable headers`)
      assert.ok(m.rows.length || m.cards.length, `${at}: renders rows or cards`)
      for (const h of m.rows) assert.ok(h <= 48, `${at}: table rows are 48px or less (${h})`)
      for (const h of m.cards) assert.ok(h <= 72, `${at}: cards are 72px or less (${h})`)
      assert.equal(m.labelled, false, `${at}: cards carry no field labels`)
      if (width < 640) assert.equal(m.rows.length, 0, `${at}: phones get cards`)
    }
    // Filters stays inside the viewport (a bottom sheet below 640px).
    await page.goto(fixtures.leader.url('section=recruitment&tool=applicants')); await page.locator('main h1').first().waitFor()
    await page.getByRole('button', { name: /^Filters/ }).first().click()
    // The popover is placed after it mounts (and the sheet slides in), so wait for it to settle before measuring.
    const fits = box => !!box && box.x >= 0 && box.x + box.width <= width + 0.5 && box.y + box.height <= 764.5
    let panel = null
    for (let tries = 0; tries < 20 && !fits(panel); tries++) { if (tries) await page.waitForTimeout(100); panel = await page.locator('.oc-filter-popover, .oc-filter-sheet').first().boundingBox() }
    assert.ok(fits(panel), `Filters is fully on screen at ${width}px (${JSON.stringify(panel)})`)
    await page.keyboard.press('Escape')
    assert.deepEqual(errors, [], `no page errors at ${width}px`)
    await context.close()
  }

  // The applicant review at 1126×764: responses lead, Advance / Hold / Reject are on screen without scrolling,
  // ←/→ move between applicants, typing does not, and Esc closes.
  const page = await browser.newPage({ viewport: { width: 1126, height: 764 } })
  await page.goto(fixtures.leader.url('section=recruitment&tool=applicants&sort=name&order=asc')); await page.locator('main h1').first().waitFor()
  await page.getByRole('button', { name: 'Open Amara Merritt' }).first().click()
  const dialog = page.getByRole('dialog'); await dialog.waitFor()
  await page.getByRole('heading', { name: 'Amara Merritt', exact: true }).waitFor()
  assert.ok(await page.locator('.oc-quick-answer').count() >= 1, 'responses are the main content')
  await page.locator('.oc-review-decision-buttons').evaluate(el => { const r = el.getBoundingClientRect(); if (r.bottom > innerHeight + 1 || r.top < 0) throw Error('decisions off screen') })
  assert.equal(await dialog.getByText(/Read thoughtfully|Applicant dossier|Jump to review workspace|not a score/).count(), 0, 'no editorial clutter')
  await page.locator('#review-applicant-name').press('ArrowRight'); await page.getByRole('heading', { name: 'Amara Solano', exact: true }).waitFor()
  await page.locator('#review-applicant-name').press('ArrowLeft'); await page.getByRole('heading', { name: 'Amara Merritt', exact: true }).waitFor()
  await page.getByRole('textbox', { name: 'Comment (optional)' }).focus(); await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300); assert.equal(await page.getByRole('heading', { name: 'Amara Merritt', exact: true }).count(), 1, 'arrows are ignored while typing')
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
  // The sort chosen in the URL is still applied after a reload.
  assert.match(page.url(), /sort=name&order=asc|tool=applicants$/)
  await page.goto(fixtures.leader.url('section=recruitment&tool=applicants&sort=score&order=desc')); await page.locator('main h1').first().waitFor()
  assert.equal(await page.getByRole('columnheader', { name: /^Sort by Rating/ }).getAttribute('aria-sort'), 'descending')
  assert.match(await page.getByRole('combobox', { name: 'Sort applicants by' }).innerText(), /Rating/)

  // A rail tooltip that is open when the review opens closes and never sits above the dialog.
  await page.locator('aside.oc-expanding-dock a, aside.oc-expanding-dock button').filter({ visible: true }).nth(2).hover(); await page.waitForTimeout(600)
  await page.locator('[data-applicant-id]').filter({ visible: true }).first().focus(); await page.keyboard.press('Enter'); await dialog.waitFor()
  await page.waitForTimeout(300)
  assert.equal(await page.locator('[data-slot="tooltip-content"][data-state]:not([data-state="closed"])').count(), 0, 'no stuck navigation tooltip over the review')
})
