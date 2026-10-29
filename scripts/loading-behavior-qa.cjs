// Pending → network error → keyboard retry, and warm refresh against the real app.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const { chromium } = require('playwright'), { Actor, readConfig } = require('../tests/helpers/onboarding-e2e.cjs')
async function main() {
  const root = path.join(os.tmpdir(), 'outclass-loading-e2e'), config = readConfig(path.join(root, 'config.json'))
  assert.equal(config.suite, 'loading')
  const fixture = JSON.parse(fs.readFileSync(path.join(root, 'navigation-fixture.json'))), actor = new Actor(config)
  await actor.signIn(fixture.email, fixture.password)
  const browser = await chromium.launch({ headless: true }), output = 'docs/loading-experience/evidence'
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, storageState: { cookies: [...actor.cookies].map(([name, value]) => ({ name, value, domain: '127.0.0.1', path: '/' })), origins: [] } })
  const page = await context.newPage(), errors = [], results = {}
  page.on('pageerror', e => errors.push(e.message))
  let release
  try {
    await page.goto(`${config.appUrl}/club/${fixture.clubIds[0]}/workspace?section=overview`)
    const overview = page.locator('.oc-command-club').filter({ visible: true }).first()
    await overview.getByRole('button', { name: 'Refresh overview', exact: true }).waitFor()
    await page.evaluate(() => { window.__loadingNav = document.querySelector('nav') })
    let arrived; const pending = new Promise(resolve => { arrived = resolve })
    await page.route('**/api/workspace?**', async route => {
      if (new URL(route.request().url()).searchParams.get('kind') !== 'overview') return route.continue()
      const response = await route.fetch(); arrived()
      await new Promise(resolve => { release = resolve }); await route.fulfill({ response })
    })
    await overview.getByRole('button', { name: 'Refresh overview', exact: true }).click(); await pending
    assert.equal(await overview.isVisible(), true)
    assert.equal(await page.locator('.oc-dashboard-loading').count(), 0)
    assert.equal(await overview.getByRole('button', { name: 'Refreshing…', exact: true }).isDisabled(), true)
    await page.screenshot({ path: `${output}/refresh-390.png`, animations: 'disabled' })
    release(); await overview.getByRole('button', { name: 'Refresh overview', exact: true }).waitFor()
    await page.unroute('**/api/workspace?**')
    results.refresh = 'Current authorized content and navigation stay mounted; localized pending button prevents duplicates.'
    let fail = true, reads = 0
    await page.route('**/api/workspace?**', route => {
      if (new URL(route.request().url()).searchParams.get('kind') !== 'members') return route.continue()
      reads++; return fail ? route.abort('connectionfailed') : route.continue()
    })
    const members = page.getByRole('navigation', { name: 'Primary mobile navigation' }).getByRole('link', { name: 'Members', exact: true })
    await members.focus(); await page.keyboard.press('Enter')
    const retry = page.getByRole('button', { name: 'Retry workspace', exact: true })
    await retry.waitFor()
    assert.equal(await page.locator('[data-slot="loading-state"]').filter({ visible: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Member details · Audit Student 000', exact: true }).count(), 0)
    await page.screenshot({ path: `${output}/failure-390.png`, animations: 'disabled' })
    fail = false; await retry.focus(); await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Member details · Audit Student 000', exact: true }).waitFor()
    assert.equal(reads, 2)
    assert.equal(await page.evaluate(() => window.__loadingNav.isConnected && window.__loadingNav === document.querySelector('nav')), true)
    results.failureRetry = 'Failed read releases skeleton, reveals no member records, exposes Retry; Enter retries one fresh authorized read without replacing navigation.'
    await page.screenshot({ path: `${output}/retry-390.png`, animations: 'disabled' })
    assert.deepEqual(errors, [])
    fs.writeFileSync(`${output}/behavior-results.json`, JSON.stringify(results, null, 2) + '\n')
    console.log('PASS: warm refresh, duplicate protection, network failure, keyboard retry, shell identity, no stale records or JS errors')
  } finally { release?.(); await context.close(); await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
