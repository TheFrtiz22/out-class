// Workspace switch timing, loader and header persistence on the disposable stack (any build).
// node scripts/measure-workspace-switch.cjs <label> [config.json] → test-results/workspace-shell/measure-<label>.json
const fs = require('node:fs'), path = require('node:path')
const { chromium } = require('playwright')
const h = require('../tests/helpers/workspace-shell-e2e.cjs')
const { measureHeaderGap } = require('../tests/helpers/header-gap.cjs')
const label = process.argv[2] || 'run', configFile = process.argv[3] || '/tmp/outclass-onboarding-e2e/config.json'

;(async () => {
  const account = await h.shellAccount(configFile)
  const browser = await chromium.launch()
  const result = { label, switches: [], header: [] }
  try {
    const context = await h.signedInContext(browser, account)
    const page = await context.newPage()
    const personal = 'Personal workspace', club = `${account.clubName} club workspace`, admin = 'Admin workspace'
    await page.goto(account.config.appUrl + '/home'); await h.contentPainted(page, personal)
    // Three rounds: the first is cold for each destination, the rest warm.
    for (let round = 0; round < 3; round++) for (const [to, from] of [[club, 'personal'], [admin, 'club'], [personal, 'admin']]) {
      await h.watchShell(page)
      const started = await page.evaluate(() => performance.now())
      await page.locator(`a[data-workspace-option][aria-label$="${to}"]`).click()
      await h.contentPainted(page, to)
      const painted = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(performance.now()))))
      const state = await page.evaluate(() => ({ sameHeader: window.__shellHeader === document.querySelector('.oc-product-header'), loader: window.__loaderSeen }))
      result.switches.push({ round, from, to: to.replace(account.clubName, 'club'), ms: Math.round(painted - started), ...state })
      await page.waitForTimeout(800)
    }
    await context.close()
    const routes = ['/home', '/saved-clubs', `/club/${account.clubId}/workspace?section=overview`, '/platform']
    for (const width of [1024, 1100, 1180, 1280, 1440, 1920, 2560, 390]) {
      const ctx = await h.signedInContext(browser, account, { viewport: { width, height: 900 } }), p = await ctx.newPage()
      for (const route of routes) { await p.goto(account.config.appUrl + route); await p.waitForTimeout(2500); result.header.push({ width, route: route.replace(account.clubId, ':club'), ...(await p.evaluate(measureHeaderGap)) }) }
      await ctx.close()
    }
  } finally { await browser.close(); await account.db.$disconnect() }
  const out = path.resolve('test-results/workspace-shell'); fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, `measure-${label}.json`), JSON.stringify(result, null, 2))
  for (const s of result.switches) console.log(s.round, s.from, '→', s.to, s.ms + 'ms', 'sameHeader', s.sameHeader, 'loader', s.loader)
  for (const r of result.header) console.log(r.width, r.route, 'header', r.headerHeight, 'gap', r.gap, r.text)
})().catch(error => { console.error(error); process.exit(1) })
