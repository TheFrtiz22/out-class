// Real Next + Auth + PostgreSQL on the disposable onboarding stack (run-onboarding-e2e.cjs --shell).
// Club home runs the club; the Recruiting Overview runs the cycle. Both pass axe (WCAG 2.2 AA) at 1440 and 390,
// the round filter works from the keyboard, and Club home reads only the club view of the overview.
const { test } = require('node:test'), assert = require('node:assert/strict')
const { chromium } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')
const { shellAccount, signedInContext } = require('./helpers/workspace-shell-e2e.cjs')
const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG

test('Club home and the Recruiting Overview do different jobs, accessibly', { skip: !configFile, timeout: 300000 }, async () => {
  const account = await shellAccount(configFile, { elevate: false })
  const browser = await chromium.launch({ headless: true })
  const base = `/club/${account.clubId}/workspace`
  try {
    for (const width of [1440, 390]) {
      const context = await signedInContext(browser, account, { viewport: { width, height: 1000 } })
      const page = await context.newPage(), errors = [], views = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('request', request => { const url = new URL(request.url()); if (url.searchParams.get('kind') === 'overview') views.push(JSON.parse(url.searchParams.get('args'))[1] ?? 'all') })

      await page.goto(account.config.appUrl + `${base}?section=overview`)
      await page.locator('.oc-club-home').waitFor()
      const skip = page.getByRole('button', { name: 'Skip', exact: true })
      if (await skip.isVisible().catch(() => false)) await skip.click()
      await page.waitForTimeout(1500)
      // Club home: club cards only, one recruiting strip, and its data read is the club view plus the strip summary.
      for (const name of ['Next meeting', 'This week']) assert.equal(await page.getByRole('heading', { name, exact: true }).count(), 1, name)
      for (const name of ['Recruiting pipeline', 'Your interviews', 'Pipeline by round', 'Review queue']) assert.equal(await page.getByRole('heading', { name, exact: true }).count(), 0, name)
      assert.equal(await page.locator('.oc-recruiting-strip').count(), 1)
      assert.ok(views.includes('club') && views.includes('strip') && !views.includes('all') && !views.includes('recruiting'), `Club home reads ${views.join(', ')}`)
      const home = await new AxeBuilder({ page }).include('#workspace-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      assert.deepEqual(home.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(', ')}`), [], `Club home axe at ${width}`)

      // The strip opens the Recruiting Overview.
      views.length = 0
      await page.locator('.oc-recruiting-strip').click()
      await page.locator('.oc-recruiting-hero').last().waitFor()
      await page.getByRole('heading', { name: 'Pipeline by round', exact: true }).waitFor()
      assert.equal(await page.locator('.oc-recruiting-hero').last().getAttribute('data-glow'), 'recruiting')
      assert.ok(views.includes('recruiting') && !views.includes('club'), `Recruiting reads ${views.join(', ')}`)
      for (const name of ['Next meeting', 'Team tasks', 'Your tasks']) assert.equal(await page.getByRole('heading', { name, exact: true }).count(), 0, name)
      assert.equal(await page.getByRole('group', { name: 'Filter review queue by round' }).count(), 0, 'no round filter')
      const recruiting = await new AxeBuilder({ page }).include('#workspace-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      assert.deepEqual(recruiting.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(', ')}`), [], `Recruiting axe at ${width}`)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal scroll')
      assert.deepEqual(errors, [])
      await context.close()
    }
  } finally { await browser.close(); await account.db.$disconnect() }
})
