// Personal pages at phone width match the OutClass app; desktop keeps its own layout. Real browser on the
// isolated dashboards and student-screens fixtures (fictional data; no sessions or server actions).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('playwright')
const { startDashboards } = require('./helpers/dashboards-fixture.cjs')
const { startStudentScreens } = require('./helpers/student-screens-fixture.cjs')

test('browser: personal phone layout, filters, Events default and reachability; desktop unchanged', async t => {
  const [home, screens] = await Promise.all([startDashboards(), startStudentScreens()]); t.after(() => Promise.all([home.close(), screens.close()]))
  const browser = await chromium.launch({ headless: true, ...(!fs.existsSync(chromium.executablePath()) ? { channel: 'chrome' } : {}) }); t.after(() => browser.close())
  const open = async (url, width, init) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500 }); t.after(() => context.close())
    if (init) await context.addInitScript(init)
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.goto(url); await page.waitForFunction(() => (document.querySelector('main')?.innerText.trim().length || 0) > 0)
    t.after(() => assert.deepEqual(errors, [], `${url} at ${width}: no page errors`))
    return page
  }
  const shown = locator => locator.evaluate(el => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0)
  const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

  // Home: exactly one layout per width; the phone sections lead to Applications and My Clubs.
  const phoneHome = await open(home.url('page=home'), 390)
  await phoneHome.locator('.oc-home-phone').waitFor()
  assert.equal(await shown(phoneHome.locator('.oc-home-dashboard')), false)
  assert.ok(await noOverflow(phoneHome))
  const bar = phoneHome.getByRole('navigation', { name: 'Sections', exact: true })
  assert.deepEqual(await bar.locator('.oc-mobile-destination').evaluateAll(items => items.map(item => item.getAttribute('aria-label'))), ['Home', 'Explore', 'Inbox', 'Calendar', 'Profile'])
  await phoneHome.locator('.oc-home-phone-applications').getByRole('button', { name: 'View all' }).click()
  await phoneHome.locator('.oc-home-phone').getByRole('button', { name: 'All clubs' }).click()
  assert.deepEqual(await phoneHome.evaluate(() => window.fixtureNavigations), ['tracker', 'my-clubs'], 'Applications and My Clubs stay one tap from Home')
  const deskHome = await open(home.url('page=home'), 1440)
  await deskHome.locator('.oc-home-dashboard').waitFor()
  assert.equal(await shown(deskHome.locator('.oc-home-phone')), false)

  // Explore: filters sit behind the Filter button on phones and stay open on desktop.
  const explore = await open(screens.url('page=explore'), 390)
  const toggle = explore.locator('.oc-directory-filter-toggle'), tools = explore.locator('#directory-tools')
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false'); assert.equal(await shown(tools), false)
  await toggle.click()
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true'); assert.equal(await shown(tools), true)
  assert.ok(await noOverflow(explore))
  const deskExplore = await open(screens.url('page=explore'), 1440)
  assert.equal(await shown(deskExplore.locator('.oc-directory-filter-toggle')), false); assert.equal(await shown(deskExplore.locator('#directory-tools')), true)

  // Calendar: the same toggle.
  const calendar = await open(screens.url('page=calendar'), 390)
  const calToggle = calendar.locator('.oc-calendar-filter-toggle')
  await calToggle.waitFor()
  assert.equal(await shown(calendar.locator('#calendar-tools')), false)
  await calToggle.click()
  assert.equal(await calToggle.getAttribute('aria-expanded'), 'true'); assert.equal(await shown(calendar.locator('#calendar-tools')), true)

  // Inbox and Calendar are tabs of their own and show as the current page.
  for (const [page, label] of [['inbox', 'Inbox'], ['calendar', 'Calendar']]) {
    const tab = (await open(screens.url(`page=${page}`), 390)).locator('.oc-mobile-destination[aria-current="page"]')
    assert.equal(await tab.getAttribute('aria-label'), label)
  }

  // Events: list on phones, board on desktop, and a saved choice wins over the phone default.
  const events = await open(screens.url('page=corkboard'), 390)
  await events.locator('.oc-event-list').waitFor(); assert.equal(await events.locator('.oc-physical-board').count(), 0)
  const deskEvents = await open(screens.url('page=corkboard'), 1440)
  await deskEvents.locator('.oc-physical-board').waitFor()
  const saved = await open(screens.url('page=corkboard'), 390, () => { try { localStorage.setItem('outclass:events:view:v1', 'corkboard') } catch {} })
  await saved.locator('.oc-physical-board').waitFor()
})
