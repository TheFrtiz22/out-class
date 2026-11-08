// Screenshots for the persistent shell / header / dashboard split (disposable onboarding stack only).
// node scripts/shell-dashboard-screens.cjs <part> [config.json]   → docs/shell-dashboard-split/<part>/
const fs = require('node:fs'), path = require('node:path')
const { chromium } = require('playwright')
const h = require('../tests/helpers/workspace-shell-e2e.cjs')
const part = process.argv[2] || 'part1', configFile = process.argv[3] || '/tmp/outclass-onboarding-e2e/config.json'
const out = path.resolve('docs/shell-dashboard-split', part)

async function shot(page, name) {
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(out, `${name}.png`) })
  console.log('saved', name)
}

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const account = await h.shellAccount(configFile)
  const browser = await chromium.launch()
  const personal = 'Personal workspace', club = `${account.clubName} club workspace`, admin = 'Admin workspace'
  try {
    if (part === 'part1') {
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        const context = await h.signedInContext(browser, account, { viewport: { width, height }, deviceScaleFactor: 2 })
        const page = await context.newPage()
        await page.goto(account.config.appUrl + '/home'); await h.contentPainted(page, personal)
        await shot(page, `${width}-personal`)
        if (width > 760) {
          // One frame mid-slide: the indicator moves before the club workspace has loaded.
          await page.locator(`a[data-workspace-option][aria-label="${club}"]`).click(); await page.waitForTimeout(140)
          await page.screenshot({ path: path.join(out, `${width}-switching.png`), clip: { x: 0, y: 0, width, height: 140 } }); console.log('saved switching')
          await h.contentPainted(page, club); await shot(page, `${width}-club`)
          await page.locator(`a[data-workspace-option][aria-label="${admin}"]`).click(); await h.contentPainted(page, admin); await shot(page, `${width}-admin`)
        } else {
          await page.goto(account.config.appUrl + `/club/${account.clubId}/workspace?section=overview`); await page.locator('main h1').first().waitFor(); await shot(page, `${width}-club`)
        }
        await context.close()
      }
    }
  } finally { await browser.close(); await account.db.$disconnect() }
})().catch(error => { console.error(error); process.exit(1) })
