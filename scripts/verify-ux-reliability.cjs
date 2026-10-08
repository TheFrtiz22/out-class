// Production-build UX review against the dedicated local Profile project; no production writes.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { chromium } = require(process.env.OUTCLASS_PLAYWRIGHT_MODULE || 'playwright')
const { PrismaClient } = require('@prisma/client')
const { createServerClient } = require('@supabase/ssr')
const c = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'outclass-profile-p2-e2e/config.json')))
assert.equal(c.projectId, 'outclass-profile-p2-e2e')
for (const [value, port] of [[c.status.DB_URL, '58322'], [c.status.API_URL, '58321']]) { const url = new URL(value); assert.ok(['localhost', '127.0.0.1'].includes(url.hostname)); assert.equal(url.port, port) }
const db = new PrismaClient({ datasourceUrl: c.status.DB_URL }), base = 'http://127.0.0.1:3110'
const output = path.join(os.tmpdir(), 'outclass-ux-reliability'); fs.mkdirSync(output, { recursive: true })
let browser; const results = { metadata: [], layouts: [], accessibility: [], events: [] }
async function capture(page, name) {
  // Inspect settled surfaces, rather than a partly transparent entrance-animation frame.
  await page.waitForTimeout(450)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: horizontal overflow`)
  await page.screenshot({ path: path.join(output, `${name}.png`) }); results.layouts.push(name)
}
async function axe(page, name) {
  if (!process.env.OUTCLASS_AXE_MODULE) return
  await page.addScriptTag({ path: require.resolve(`${process.env.OUTCLASS_AXE_MODULE}/axe.min.js`) })
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })))
  results.accessibility.push({ page: name, violations }); assert.deepEqual(violations, [], name)
}
(async () => {
  const stamp = Date.now(), events = []
  for (const name of ['Reliability campus discussion', 'Reliability campus workshop']) events.push(await db.meeting.create({ data: { clubId: c.clubId, title: `${name} ${stamp}`, description: 'A fictional event in the isolated local UX verification environment.', location: 'Local fixture hall', date: new Date(Date.now() + 86400000 * 4), endDate: new Date(Date.now() + 86400000 * 4 + 3600000), isPublic: true, audience: 'RECRUITMENT', publication: { create: { status: 'PUBLISHED', approvedRevision: 0, reviewedAt: new Date(), reviewedBy: c.identities.admin.id, capacity: 20, rsvpEnabled: true, publishedAt: new Date() } } } }))
  browser = await chromium.launch({ executablePath: process.env.OUTCLASS_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  for (const [surface, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport }), page = await context.newPage(), errors = []
    page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message))
    for (const route of ['/', '/about', '/uva']) {
      const response = await page.goto(base + route); assert.equal(response.status(), 200); await page.locator('h1').first().waitFor(); await page.waitForFunction(() => document.querySelectorAll('h1').length === 1)
      const metadata = await page.evaluate(() => ({ title: document.title, canonical: document.querySelector('link[rel=canonical]')?.href, robots: document.querySelector('meta[name=robots]')?.content, image: document.querySelector('meta[property="og:image"]')?.content, h1: document.querySelectorAll('h1').length, schemas: [...document.querySelectorAll('script[type="application/ld+json"]')].map(n => JSON.parse(n.textContent)) }))
      assert.equal(metadata.canonical.replace(/\/$/, ''), ('https://www.out-class.net' + route).replace(/\/$/, '')); assert.match(metadata.robots, /index, follow/); assert.equal(metadata.h1, 1); assert.equal(metadata.image, 'https://www.out-class.net/images/outclass-social.jpg')
      results.metadata.push({ surface, route, ...metadata }); await capture(page, `${surface}-public-${route === '/' ? 'home' : route.slice(1)}`); await axe(page, `${surface}-${route}`)
    }
    const asset = await page.request.get(base + '/images/outclass-social.jpg'); assert.equal(asset.status(), 200); assert.match(asset.headers()['content-type'], /image\/jpeg/)
    const missingResponse = await page.goto(base + '/page-that-does-not-exist'); assert.equal(missingResponse.status(), 404); await page.getByText('Page not found', { exact: true }).waitFor(); await capture(page, `${surface}-missing-page`); await axe(page, `${surface}-404`)
    await page.getByRole('link', { name: 'Return to OutClass', exact: true }).click(); await page.locator('h1').first().waitFor(); await page.waitForFunction(() => document.querySelectorAll('h1').length === 1)
    await page.goto(base + '/corkboard?event=broken-link'); await page.getByText(/This event is no longer available/).waitFor(); assert.equal(await page.getByRole('button', { name: 'Retry event', exact: true }).count(), 0);
    const missing = randomUUID(); await page.goto(`${base}/corkboard?event=${missing}`); await page.getByText(/This event is no longer available/).waitFor(); await capture(page, `${surface}-missing-event`)
    let fail = true
    await page.route('**/corkboard**', route => route.request().method() === 'POST' && route.request().postData()?.includes(events[0].id) && fail ? route.abort('failed') : route.continue())
    await page.goto(`${base}/corkboard?event=${events[0].id}`); await page.getByRole('button', { name: 'Retry event', exact: true }).waitFor(); await capture(page, `${surface}-event-error`)
    fail = false; await page.getByRole('button', { name: 'Retry event', exact: true }).click(); await page.getByRole('dialog').getByRole('heading', { name: events[0].title, exact: true }).waitFor()
    await page.reload(); await page.getByRole('dialog').getByRole('heading', { name: events[0].title, exact: true }).waitFor()
    await page.evaluate(id => history.pushState(null, '', '/corkboard?event=' + id), events[1].id); await page.getByRole('dialog').getByRole('heading', { name: events[1].title, exact: true }).waitFor()
    await page.goBack(); await page.getByRole('dialog').getByRole('heading', { name: events[0].title, exact: true }).waitFor(); await capture(page, `${surface}-event-detail`); await axe(page, `${surface}-event-detail`)
    await page.evaluate(() => history.pushState(null, '', '/corkboard')); await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.getByRole('textbox', { name: 'Search events' }).fill('no-such-event-ux-reliability'); await page.getByText('No events here yet.', { exact: true }).waitFor(); await capture(page, `${surface}-empty-events`)
    assert.deepEqual(errors, []); await context.close()
    let cookies = []
    const auth = createServerClient(c.status.API_URL, c.status.PUBLISHABLE_KEY, { cookies: { getAll: () => cookies, setAll: values => { for (const value of values) { cookies = cookies.filter(cookie => cookie.name !== value.name); cookies.push(value) } } } })
    const login = await auth.auth.signInWithPassword(c.identities.student); if (login.error) throw login.error
    const student = await browser.newContext({ viewport }); await student.addCookies(cookies.map(v => ({ name: v.name, value: v.value, domain: '127.0.0.1', path: '/' })))
    const sp = await student.newPage(); sp.setDefaultTimeout(30000); sp.on('pageerror', error => errors.push(error.message))
    await sp.goto(`${base}/corkboard?event=${events[0].id}`); await sp.getByRole('button', { name: 'RSVP', exact: true }).click(); await sp.getByText('You’re going ✓', { exact: true }).waitFor(); await sp.keyboard.press('Escape'); await sp.getByRole('dialog').waitFor({ state: 'hidden' })
    await sp.getByText(/Your RSVPs/).click(); await sp.getByRole('button', { name: 'Cancel RSVP', exact: true }).first().click(); await sp.getByText('Your RSVP was cancelled.', { exact: true }).waitFor(); assert.equal(await db.eventRsvp.count({ where: { eventId: events[0].id, userId: c.identities.student.id } }), 0)
    await sp.reload(); await sp.getByRole('dialog').getByRole('heading', { name: events[0].title, exact: true }).waitFor(); await sp.keyboard.press('Escape'); await sp.getByRole('dialog').waitFor({ state: 'hidden' }); await sp.getByText(/Your RSVPs/).click(); assert.equal(await sp.getByRole('button', { name: 'Cancel RSVP', exact: true }).count(), 0)
    let unavailable = true
    await sp.route('**/api/workspace?**', route => new URL(route.request().url()).searchParams.get('kind') === 'directory' && unavailable ? route.fulfill({ status: 503, body: '{}' }) : route.continue())
    await sp.goto(base + '/?workspace=student&view=explore'); await sp.getByRole('button', { name: 'Retry directory' }).waitFor(); await capture(sp, `${surface}-directory-error`)
    unavailable = false; await sp.getByRole('button', { name: 'Retry directory' }).click(); await sp.getByRole('textbox', { name: 'Search clubs' }).waitFor(); await sp.getByRole('button', { name: 'Retry directory' }).waitFor({ state: 'hidden' })
    await sp.getByRole('textbox', { name: 'Search clubs' }).fill('no-such-club-ux-reliability'); await sp.getByText('No clubs match this search.', { exact: true }).waitFor(); await capture(sp, `${surface}-empty-directory`); await axe(sp, `${surface}-empty-directory`)
    await sp.getByRole('button', { name: 'Clear search and filters' }).click(); assert.equal(await sp.getByRole('textbox', { name: 'Search clubs' }).inputValue(), '')
    assert.deepEqual(errors, []); await student.close(); results.events.push({ surface, missing: true, retry: true, refresh: true, history: true, cancellationPersisted: true, directoryRecovery: true }); console.log(`PASS: ${surface} public metadata/share asset/404, event failure/retry/history/refresh, real RSVP/cancel/reload, directory failure/retry/empty; accessibility and overflow checks`)
  }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); await browser.close(); await db.$disconnect()
})().catch(async error => { console.error(error); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); if (browser) await browser.close(); await db.$disconnect(); process.exitCode = 1 })
