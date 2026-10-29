// Real built application + existing reserved local Auth fixture. Reads only.
// Start this checkout on 127.0.0.1:3147 against the disposable onboarding stack;
// never point this runner at hosted services. No API responses are fabricated.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const { chromium } = require('playwright')
const { Actor, readConfig } = require('../tests/helpers/onboarding-e2e.cjs')
const root = path.join(os.tmpdir(), 'outclass-loading-e2e')
const config = readConfig(path.join(root, 'config.json'))
assert.equal(config.suite, 'loading'); assert.equal(config.appUrl, 'http://127.0.0.1:3147')
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'navigation-fixture.json')))
const output = path.resolve('docs/loading-experience/evidence')
fs.mkdirSync(output, { recursive: true })
const cases = [
  ['club', 'overview', 'overview', '.oc-dashboard-loading'],
  ['recruiting', 'recruitment&tool=overview', 'overview', '.oc-dashboard-loading'],
  ['members', 'members', 'members', '[data-layout="table"]'],
  ['tasks', 'tasks', 'tasks', '[data-layout="rows"]'],
  ['announcements', 'announcements', 'announcements', '[data-layout="feed"]'],
  ['pipeline', 'recruitment&tool=applicants', 'pipeline', '[data-layout="applicants"]'],
  ['scheduling', 'recruitment&tool=interviews&interviewTab=schedule', 'roomWorkspace', '[data-layout="calendar"]'],
  ['application-settings', 'settings&setting=application', 'applicationSettings', '[data-layout="form"]'],
]
async function main() {
  const actor = new Actor(config); await actor.signIn(fixture.email, fixture.password)
  const browser = await chromium.launch({ headless: true }), results = []
  try {
    for (const width of (process.env.OUTCLASS_LOADING_QA_WIDTHS || '1440,1280,768,390,320').split(',').map(Number)) {
      for (const [name, section, kind, selector] of cases.filter(([name]) => !process.env.OUTCLASS_LOADING_QA_CASES || process.env.OUTCLASS_LOADING_QA_CASES.split(',').includes(name))) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, storageState: { cookies: [...actor.cookies].map(([name, value]) => ({ name, value, domain: '127.0.0.1', path: '/' })), origins: [] } })
        const page = await context.newPage(), errors = [], releases = []
        let requests = 0, arrived
        const requestStarted = new Promise(resolve => { arrived = resolve })
        page.on('pageerror', e => errors.push(e.message))
        await page.route('**/api/workspace?**', async route => {
          if (new URL(route.request().url()).searchParams.get('kind') !== kind) return route.continue()
          const response = await route.fetch({ timeout: 20000 })
          assert.equal(response.status(), 200, `${kind} must return authorized real data`)
          requests++; arrived()
          await new Promise(resolve => releases.push(resolve))
          await route.fulfill({ response })
        })
        try {
          await page.goto(`${config.appUrl}/club/${fixture.clubIds[0]}/workspace?section=${section}`, { waitUntil: 'domcontentloaded' })
          const loader = page.locator(selector).filter({ visible: true }).first()
          await loader.waitFor()
          await requestStarted
          assert.ok(requests > 0, 'The real data request must be pending')
          const before = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, statuses: [...document.querySelectorAll('[role="status"][aria-busy="true"]')].filter(e => e.getClientRects().length).length, nav: [...document.querySelectorAll('nav')].some(e => e.getClientRects().length) }))
          assert.ok(before.scrollWidth <= width, `${name} overflows ${width}px`)
          assert.equal(before.statuses, 1); assert.equal(before.nav, true)
          const loading = `${name}-${width}-loading.png`, ready = `${name}-${width}-ready.png`
          await page.screenshot({ path: path.join(output, loading), animations: 'disabled' })
          await page.emulateMedia({ reducedMotion: 'reduce' })
          const moving = await loader.locator('[data-slot="skeleton"]').evaluateAll(elements => elements.filter(el => getComputedStyle(el, '::after').animationName !== 'none').length)
          assert.equal(moving, 0)
          await page.emulateMedia({ reducedMotion: 'no-preference' })
          releases.splice(0).forEach(resolve => resolve())
          await loader.waitFor({ state: 'hidden', timeout: 30000 })
          const expected = { members: 'Audit Student 000', tasks: 'Audit Task', announcements: 'Audit Announcement', pipeline: 'Audit Student 000' }[name]
          if (expected) await page.getByText(expected, { exact: true }).filter({ visible: true }).first().waitFor()
          assert.equal(await page.getByRole('alert').filter({ hasText: /Could not load this workspace|Couldn.t load this club/ }).count(), 0, 'Real data must replace the skeleton successfully')
          await page.screenshot({ path: path.join(output, ready), animations: 'disabled' })
          const after = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, pending: [...document.querySelectorAll('[role="status"][aria-busy="true"]')].filter(e => e.getClientRects().length).length }))
          assert.ok(after.scrollWidth <= width, `${name} ready content overflows ${width}px`)
          assert.deepEqual(errors, [])
          results.push({ name, width, loading, ready, requests, before, after, reducedMotion: 'static' })
          console.log(`${name} ${width}: pending → ready, one status, shell retained, no overflow`)
        } finally { releases.splice(0).forEach(resolve => resolve()); await context.close() }
      }
    }
  } finally {
    const report = path.join(output, 'browser-results.json'), previous = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report)) : []
    const keys = new Set(results.map(row => `${row.name}:${row.width}`))
    fs.writeFileSync(report, JSON.stringify([...previous.filter(row => !keys.has(`${row.name}:${row.width}`)), ...results], null, 2) + '\n'); await browser.close()
  }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
