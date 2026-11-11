// Club home in a real browser: the actual shell, greeting and dashboard with fictional overviews.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const sharp = require('sharp')
const { chromium, webkit } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')
const { startClubHome, blurredSurfaces } = require('./helpers/club-home-fixture.cjs')
const engine = process.env.OUTCLASS_NAV_BROWSER === 'webkit' ? webkit : chromium

async function settle(page) {
  await page.evaluate(() => document.fonts.ready)
  await page.locator('.oc-club-home').waitFor()
  await page.waitForTimeout(700)
}
/** Edge energy of what the heading adds to a region: sharp glyph edges survive only if text is legible. */
async function headingEdges(a, b) {
  const [x, y] = await Promise.all([a, b].map(buffer => sharp(buffer).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true })))
  const { width, height } = x.info
  let sum = 0
  for (let row = 0; row < height; row++) for (let col = 1; col < width; col++) {
    const i = row * width + col
    sum += Math.abs((x.data[i] - y.data[i]) - (x.data[i - 1] - y.data[i - 1]))
  }
  return sum / (width * height)
}

test('browser: Club home dashboard, permissions, header glass, blur budget and accessibility', { timeout: 240000 }, async t => {
  const fixture = await startClubHome(); t.after(() => fixture.close())
  const browser = await engine.launch({ headless: true, ...(engine === chromium && !fs.existsSync(chromium.executablePath()) ? { channel: 'chrome' } : {}) }); t.after(() => browser.close())
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await context.newPage()
  const errors = []; page.on('pageerror', error => errors.push(error.message))

  await page.goto(fixture.url('fixture=large&role=owner'), { waitUntil: 'networkidle' }); await settle(page)
  const h1 = page.locator('h1')
  assert.equal(await h1.count(), 1)
  // The title is the club's name (greetings stay on personal Home); the subtitle is club work, never recruiting.
  assert.equal((await h1.textContent()).trim(), 'McIntire Investment Institute')
  assert.equal(await page.locator('.oc-club-home-greeting .oc-eyebrow').count(), 0)
  assert.doesNotMatch(await page.locator('.oc-club-home-greeting .oc-page-description').textContent(), /Applications|interview|review/i)
  assert.deepEqual(await page.locator('.oc-needs-card').evaluateAll(cards => cards.map(card => [card.dataset.needs, card.dataset.variant])), [['overdue', 'glass-navy'], ['team-overdue', 'glass-raised'], ['submissions', 'glass-raised'], ['due-soon', 'glass-raised']])
  for (const name of ['New announcement', 'New meeting']) assert.ok(await page.getByRole('link', { name, exact: true }).first().isVisible(), name)
  // One slim strip is the only link to recruiting.
  assert.equal(await page.locator('.oc-recruiting-strip').count(), 1)
  assert.match(await page.locator('.oc-recruiting-strip').textContent(), /Recruiting is open · 213 applicants · 21 need attention/)
  for (const name of ['Open applicants', 'Open voting', 'Schedule interviews']) assert.equal(await page.getByRole('link', { name, exact: true }).count(), 0, `${name} lives on the Recruiting Overview`)
  assert.equal(await page.getByRole('heading', { name: 'Needs you', exact: true }).count(), 1)
  for (const name of ['Next meeting', 'Team tasks', 'Announcements', 'This week', 'Members', 'Team pulse', 'Your tasks']) assert.equal(await page.getByRole('heading', { name, exact: true }).count(), 1, name)
  for (const name of ['Recruiting pipeline', 'Your interviews', 'Interviews', 'Pipeline by round']) assert.equal(await page.getByRole('heading', { name, exact: true }).count(), 0, name)
  console.log('PASS owner sees every permitted club section and no recruiting cards, most urgent card first in navy glass')

  // Every dashboard link is a rail destination (extra filter parameters allowed), so the rail highlight stays correct.
  const rail = await page.locator('aside nav a').evaluateAll(links => links.map(a => a.getAttribute('href')))
  for (const group of await page.locator('aside nav button[aria-haspopup], aside nav button[aria-expanded]').all()) {
    await group.click(); await page.locator('.oc-dock-flyout').waitFor()
    rail.push(...await page.locator('.oc-dock-flyout a').evaluateAll(links => links.map(a => a.getAttribute('href'))))
    await page.keyboard.press('Escape'); await page.locator('.oc-dock-flyout').waitFor({ state: 'hidden' })
  }
  const links = await page.locator('.oc-club-home-hero a, .oc-club-home a').evaluateAll(links => links.map(a => a.getAttribute('href')))
  assert.ok(links.length >= 8)
  // Club home has no interview room entry any more; interviews live on the Recruiting Overview.
  assert.equal(links.filter(href => href.startsWith('/club/fixture-mii/interview?')).length, 0)
  for (const href of links) assert.ok(rail.some(r => href === r || href.startsWith(`${r}&`)), `${href} is a rail destination`)
  assert.equal(await page.locator('aside nav [aria-current="page"]').textContent(), 'Home')
  console.log('PASS dashboard links resolve to rail destinations; Home stays selected')

  // Blur budget: six on desktop, and nothing on this page blurs.
  const blurred = await page.evaluate(blurredSurfaces)
  assert.ok(blurred.length <= 6, JSON.stringify(blurred))
  assert.equal(blurred.filter(b => b.name.includes('club-home') || b.name.includes('needs')).length, 0)
  assert.ok(!blurred.some(b => b.name.startsWith('header.oc-product-header::before')), 'the header band is frosted, not blurred')
  assert.notEqual(await page.locator('.oc-product-header').evaluate(el => getComputedStyle(el, '::before').backgroundImage), 'none', 'the header band has the frosted material')
  const card = await page.locator('.oc-club-home-meeting').evaluate(el => [getComputedStyle(el).backdropFilter, getComputedStyle(el, '::before').backdropFilter])
  assert.ok(card.every(value => !value || value === 'none'))
  console.log('PASS blur budget', blurred.length, 'surfaces')

  // Segmented tabs: real tabs, sliding indicator, keyboard.
  const tabs = page.getByRole('tablist', { name: 'Your tasks' })
  // The measured indicator (components/ui/tabs.tsx) slides to the selected tab.
  const indicator = el => getComputedStyle(el.querySelector('.oc-tabs-indicator')).transform
  const before = await tabs.evaluate(indicator)
  await tabs.getByRole('tab', { name: /^Overdue/ }).click()
  await page.waitForTimeout(500)
  assert.notEqual(await tabs.evaluate(indicator), before)
  assert.equal(await page.getByRole('tabpanel').locator('li').count(), 1)
  await tabs.getByRole('tab', { name: /^Overdue/ }).focus()
  await page.keyboard.press('ArrowLeft')
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-selected') === 'true' && document.activeElement.textContent === 'Upcoming')
  for (const target of await page.locator('.oc-club-home a, .oc-club-home button, .oc-club-home-hero a').all()) {
    if (!await target.isVisible()) continue
    const box = await target.boundingBox(); assert.ok(box.height >= 43.5, `${await target.textContent()} is at least 44px tall`)
  }
  console.log('PASS segmented tabs, keyboard and 44px targets')

  // Drawers stay in place; Refresh refreshes.
  await page.locator('.oc-needs-card[data-needs="overdue"] .oc-needs-action').click()
  await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Agenda & resources', exact: true }).click()
  await page.getByRole('dialog', { name: 'Portfolio review' }).waitFor(); await page.keyboard.press('Escape')
  // No Refresh button: the workspace reloads the overview after changes and when the person returns.
  assert.equal(await page.getByRole('button', { name: /^Refresh/ }).count(), 0)
  console.log('PASS existing drawers; no refresh button')

  // Audit from the top: the sticky header legitimately covers content wherever the page was left scrolled.
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200)
  const axe = await new AxeBuilder({ page }).include('#workspace-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  assert.deepEqual(axe.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(', ')}`), [])
  console.log('PASS axe (WCAG 2.2 AA) on the dashboard')

  // After scrolling 120px the H1 sits under the header and is not readable through it: compare the
  // glyph edges it adds there with the edges of the same heading when fully visible.
  const edges = async () => {
    const region = await page.evaluate(() => {
      const header = document.querySelector('.oc-product-header').getBoundingClientRect(), title = document.querySelector('h1').getBoundingClientRect()
      const top = Math.max(0, title.top), bottom = title.bottom > header.bottom ? title.bottom : Math.min(header.bottom - 22, title.bottom)
      return { x: Math.round(title.left), y: Math.round(top), width: Math.round(Math.min(title.width, 380)), height: Math.round(bottom - top), covered: title.top < header.bottom - 22 }
    })
    const { covered, ...clip } = region
    const shown = await page.screenshot({ clip })
    await h1.evaluate(el => { el.style.visibility = 'hidden' })
    const hidden = await page.screenshot({ clip })
    await h1.evaluate(el => { el.style.visibility = '' })
    return { covered, clip, value: await headingEdges(shown, hidden) }
  }
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300)
  const visible = await edges()
  await page.evaluate(() => scrollTo(0, 120)); await page.waitForTimeout(300)
  const underHeader = await edges()
  assert.equal(visible.covered, false); assert.equal(underHeader.covered, true)
  assert.ok(underHeader.clip.height >= 12, `the H1 overlaps the header band after scrolling (${JSON.stringify(underHeader.clip)})`)
  assert.ok(underHeader.value < visible.value * .1, `heading edges behind the header ${underHeader.value.toFixed(2)} vs visible ${visible.value.toFixed(2)}`)
  console.log('PASS H1 not legible behind the header after 120px scroll: edge energy', underHeader.value.toFixed(2), 'vs', visible.value.toFixed(2), 'visible')
  await page.evaluate(() => scrollTo(0, 0))

  // Reduced motion and forced colors.
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
  await page.reload({ waitUntil: 'networkidle' }); await settle(page)
  assert.equal(await page.locator('.oc-needs-card').first().evaluate(el => getComputedStyle(el).animationName), 'none')
  assert.equal(await page.locator('.oc-club-home-ambient').evaluate(el => getComputedStyle(el).display), 'none')
  assert.equal(await page.locator('[data-slot="tabs-list"][data-variant="segmented"]').evaluate(el => getComputedStyle(el).borderTopStyle), 'solid')
  // Reduced motion removes the slide, not the position: the indicator still sits under the selected tab.
  const reducedTabs = page.getByRole('tablist', { name: 'Your tasks' })
  await reducedTabs.getByRole('tab', { name: /^Overdue/ }).click()
  assert.notEqual(await reducedTabs.evaluate(el => getComputedStyle(el.querySelector('.oc-tabs-indicator')).transform), 'none')
  assert.equal(await reducedTabs.evaluate(el => getComputedStyle(el.querySelector('.oc-tabs-indicator')).transitionDuration.split(',').every(v => parseFloat(v) === 0)), true)
  await page.emulateMedia({ reducedMotion: null, forcedColors: null })
  console.log('PASS reduced motion and forced colors')

  // Permission subsets: no empty sections.
  const sections = () => page.locator('.oc-club-home-card').evaluateAll(cards => cards.map(c => [c.querySelector('h2').textContent, c.querySelectorAll('li').length + c.querySelectorAll('.oc-dashboard-quiet').length]))
  await page.goto(fixture.url('fixture=large&role=reviewer'), { waitUntil: 'networkidle' }); await settle(page)
  // A reviewer's Club home is club work only: reviews live on the Recruiting Overview (and the strip links there).
  assert.deepEqual(await page.locator('.oc-needs-card').evaluateAll(cards => cards.map(card => card.dataset.needs)), ['overdue', 'due-soon'])
  assert.deepEqual((await sections()).map(s => s[0]), ['Next meeting', 'Tasks', 'Announcements', 'This week'])
  assert.equal(await page.getByRole('link', { name: 'New meeting' }).count(), 0)
  assert.ok((await sections()).every(s => s[1] > 0))
  await page.goto(fixture.url('fixture=large&role=member'), { waitUntil: 'networkidle' }); await settle(page)
  assert.deepEqual(await page.locator('.oc-needs-card').evaluateAll(cards => cards.map(card => card.dataset.needs)), ['overdue', 'due-soon'])
  assert.deepEqual((await sections()).map(s => s[0]), ['Next meeting', 'Tasks', 'Announcements', 'This week'])
  assert.equal(await page.locator('.oc-recruiting-strip').count(), 0, 'no recruiting access, no strip')
  assert.equal(await page.getByRole('link', { name: 'New announcement' }).count(), 0)
  await page.goto(fixture.url('fixture=clear&role=member'), { waitUntil: 'networkidle' }); await settle(page)
  assert.equal(await page.getByText('You’re clear for now.', { exact: true }).count(), 1)
  assert.ok((await sections()).every(s => s[1] > 0))
  console.log('PASS reviewer, member and clear subsets with no empty sections')

  // Phones: one column, only the header blurs, no horizontal scroll.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(fixture.url('fixture=large&role=owner'), { waitUntil: 'networkidle' }); await settle(page)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  // The existing bottom bar is fixed navigation and keeps its own material (unchanged here).
  assert.deepEqual((await page.evaluate(blurredSurfaces)).filter(b => !b.header && !b.overlay && b.name !== 'nav.oc-mobile-navigation'), [])
  assert.equal(await page.locator('.oc-club-home-interviews, .oc-pipeline-compact-counts').count(), 0)
  const order = await page.locator('.oc-club-home-card:visible').evaluateAll(cards => cards.map(c => [c.querySelector('h2').textContent, c.getBoundingClientRect().top]).sort((a, b) => a[1] - b[1]).map(c => c[0]))
  assert.deepEqual(order.slice(0, 3), ['Next meeting', 'Team tasks', 'This week'])
  console.log('PASS phone layout and blur budget')
  assert.deepEqual(errors, [])
})
