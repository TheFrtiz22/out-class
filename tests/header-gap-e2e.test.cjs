// Real Next + Auth + PostgreSQL on the reserved disposable onboarding stack (run-onboarding-e2e.cjs --shell).
// One header height at every desktop width (one row, never wrapping) and the same 10px (±2) from the header's
// bottom edge to the first line of text on every signed-in page, desktop and phone.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { chromium } = require('playwright')
const { shellAccount, signedInContext } = require('./helpers/workspace-shell-e2e.cjs')
const { measureHeaderGap } = require('./helpers/header-gap.cjs')
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG

const DESKTOP = [1024, 1100, 1180, 1280, 1440, 1920, 2560], PHONE = 390

test('header height and the gap above page content are the same everywhere', { skip: !configFile, timeout: 900000 }, async () => {
  const account = await shellAccount(configFile)
  const browser = await chromium.launch({ headless: true })
  const club = `/club/${account.clubId}/workspace`
  // Representative routes: every personal page family, every club section, Admin, settings, meetings and the
  // signed-in pages that used to carry a link above their title. (Old Meetings/Announcements URLs redirect to Calendar and to
  // Home scrolled to its announcements, so their new homes are measured instead.)
  const routes = ['/home', '/explore', '/explore/categories', '/corkboard', '/saved-clubs', '/applications', '/clubs', '/calendar', '/inbox', '/profile',
    '/settings', '/settings/account', '/meetings', `/club-access/${account.clubId}`, `/club/${account.clubId}`,
    `${club}?section=overview`, `${club}?section=recruitment&tool=overview`, `${club}?section=recruitment&tool=applicants`, `${club}?section=calendar`,
    `${club}?section=recruitment&tool=decisions`, `${club}?section=tasks`, `${club}?section=members`, `${club}?section=settings`,
    '/platform', '/platform/users', '/platform/events', '/platform/claims']
  const rows = [], failures = []
  try {
    for (const width of [...DESKTOP, PHONE]) {
      const context = await signedInContext(browser, account, { viewport: { width, height: 900 } })
      const page = await context.newPage()
      for (const route of routes) {
        await page.goto(account.config.appUrl + route)
        await page.waitForFunction(() => { const main = document.querySelector('main#workspace-content'); return main && !main.querySelector('.oc-loading-state, .oc-dashboard-loading, [role="status"][aria-busy="true"]') && main.innerText.trim().length > 0 }, null, { timeout: 30000 })
        await page.evaluate(() => document.fonts.ready)
        const result = await page.evaluate(measureHeaderGap)
        const row = { width, route: route.replaceAll(account.clubId, ':club'), ...result }
        rows.push(row)
        if (!result) { failures.push(`${width} ${row.route}: no header or text`); continue }
        if (Math.abs(result.gap - 10) > 2) failures.push(`${width} ${row.route}: gap ${result.gap}px before "${result.text}"`)
        if (result.rows !== 1) failures.push(`${width} ${row.route}: header wraps (${result.rows} rows)`)
      }
      await context.close()
    }
  } finally { await browser.close(); await account.db.$disconnect() }
  const heights = new Set(rows.filter(row => row.width !== PHONE && row.headerHeight).map(row => row.headerHeight))
  const out = path.resolve('test-results/workspace-shell'); fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'header-gap.json'), JSON.stringify(rows, null, 2))
  assert.deepEqual([...heights], [70], `one header height at every desktop width (saw ${[...heights].join(', ')})`)
  assert.deepEqual(failures, [])
})
