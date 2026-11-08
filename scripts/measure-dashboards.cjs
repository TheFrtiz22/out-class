// Club home and Recruiting Overview load, cold and warm (disposable onboarding stack, local, synthetic).
// node scripts/measure-dashboards.cjs <label> [runs] → test-results/workspace-shell/dashboards-<label>.json
const fs = require('node:fs'), path = require('node:path')
const { chromium } = require('playwright')
const h = require('../tests/helpers/workspace-shell-e2e.cjs')
const label = process.argv[2] || 'run', runs = +(process.argv[3] || 5)
const median = values => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

;(async () => {
  const account = await h.shellAccount('/tmp/outclass-onboarding-e2e/config.json', { elevate: false })
  const browser = await chromium.launch(), base = `/club/${account.clubId}/workspace`
  const pages = { club: { url: `${base}?section=overview`, ready: '.oc-club-home' }, recruiting: { url: `${base}?section=recruitment&tool=overview`, ready: '.oc-command-recruiting .oc-dashboard-card, .oc-command-recruiting .oc-recruiting-empty' } }
  const out = { label, runs, cold: {}, warm: {} }
  try {
    for (const [name, target] of Object.entries(pages)) {
      const cold = [], api = [], warm = []
      for (let i = 0; i < runs; i++) {
        const context = await h.signedInContext(browser, account), page = await context.newPage(), reads = []
        page.on('requestfinished', request => { if (request.url().includes('kind=overview')) { const t = request.timing(); reads.push(t.responseEnd - t.requestStart) } })
        await page.goto(account.config.appUrl + target.url, { waitUntil: 'commit' })
        await page.locator(target.ready).first().waitFor({ timeout: 60000 })
        cold.push(Math.round(await page.evaluate(() => performance.now())))
        await page.waitForTimeout(800); api.push(...reads.map(Math.round))
        // Warm: leave to Personal home through the pill, then come back with the rail.
        await page.locator('a[data-workspace-option][aria-label="Personal workspace"]').click(); await page.locator('main h1').first().waitFor()
        await page.goto(account.config.appUrl + target.url.replace(/section=.*/, 'section=meetings'), { waitUntil: 'commit' }); await page.locator('main h1').first().waitFor()
        await page.waitForTimeout(500)
        const started = await page.evaluate(() => performance.now())
        await page.locator(`.oc-dock-rail [data-tour="nav-${name === 'club' ? 'club-home' : 'overview'}"]`).click()
        await page.locator(target.ready).first().waitFor({ timeout: 60000 })
        warm.push(Math.round(await page.evaluate(() => performance.now()) - started))
        await context.close()
      }
      out.cold[name] = { ms: cold, median: median(cold), overviewReadMs: api, overviewReadMedian: api.length ? median(api) : null }
      out.warm[name] = { ms: warm, median: median(warm) }
      console.log(label, name, 'cold median', median(cold), 'ms · overview read median', api.length ? median(api) : '-', 'ms · warm (rail) median', median(warm), 'ms')
    }
  } finally { await browser.close(); await account.db.$disconnect() }
  const dir = path.resolve('test-results/workspace-shell'); fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `dashboards-${label}.json`), JSON.stringify(out, null, 2))
})().catch(error => { console.error(error); process.exit(1) })
