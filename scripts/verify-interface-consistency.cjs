// Read-only visual/interaction verification against the dedicated local Profile environment.
// Run after prepare-profile-e2e.cjs and run-profile-local.cjs build/start.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const { chromium } = require(process.env.OUTCLASS_PLAYWRIGHT_MODULE || 'playwright')
const { createServerClient } = require('@supabase/ssr')
const { PrismaClient } = require('@prisma/client')
const { totp } = require('../tests/helpers/onboarding-e2e.cjs')
const c = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'outclass-profile-p2-e2e/config.json')))
assert.equal(c.projectId, 'outclass-profile-p2-e2e')
for (const [value, port] of [[c.status.DB_URL, '58322'], [c.status.API_URL, '58321']]) {
  const url = new URL(value); assert.ok(['localhost', '127.0.0.1'].includes(url.hostname)); assert.equal(url.port, port)
}
const output = path.join(os.tmpdir(), 'outclass-interface-consistency'); fs.mkdirSync(output, { recursive: true })
const db = new PrismaClient({ datasourceUrl: c.status.DB_URL }); let browser
const results = []
async function contextFor(role, viewport) {
  const context = await browser.newContext({ viewport })
  if (role) {
    let cookies = []
    const auth = createServerClient(c.status.API_URL, c.status.PUBLISHABLE_KEY, { cookies: { getAll: () => cookies, setAll: values => { for (const value of values) { cookies = cookies.filter(cookie => cookie.name !== value.name); cookies.push(value) } } } })
    const { error } = await auth.auth.signInWithPassword(c.identities[role]); if (error) throw error
    if (role === 'admin') {
      // Password sign-in removes unverified fixture factors; enroll and verify a local fixture if needed.
      const factors = await auth.auth.mfa.listFactors(); if (factors.error) throw factors.error
      if (!factors.data.totp.some(f => f.id === c.identities.admin.factorId && f.status === 'verified')) {
        const enrollment = await auth.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Interface local verification' }); if (enrollment.error) throw enrollment.error
        c.identities.admin.factorId = enrollment.data.id; c.identities.admin.totpSecret = enrollment.data.totp.secret
        fs.writeFileSync(path.join(os.tmpdir(), 'outclass-profile-p2-e2e/config.json'), JSON.stringify(c), { mode: 0o600 })
      }
      const verification = await auth.auth.mfa.challengeAndVerify({ factorId: c.identities.admin.factorId, code: totp(c.identities.admin.totpSecret) }); if (verification.error) throw verification.error
    }
    await context.addCookies(cookies.map(cookie => ({ name: cookie.name, value: cookie.value, domain: '127.0.0.1', path: '/' })))
  }
  return context
}
async function capture(page, name) {
  await page.screenshot({ path: path.join(output, `${name}.png`) })
  const geometry = await page.evaluate(() => ({ width: innerWidth, contentWidth: document.documentElement.scrollWidth }))
  assert.ok(geometry.contentWidth <= geometry.width + 1, `${name}: horizontal page overflow ${JSON.stringify(geometry)}`)
  results.push({ page: name, ...geometry })
}
(async () => {
  browser = await chromium.launch({ executablePath: process.env.OUTCLASS_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const membership = await db.clubMember.findFirst({ where: { userId: c.identities.leader.id, isOwner: true }, select: { clubId: true } })
  assert.ok(membership, 'Prepared local owner required')
  for (const [surface, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await contextFor(null, viewport), page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(30000)
    for (const [name, route] of [['landing', '/?view=landing'], ['auth', '/?view=auth'], ['reference', '/design-system']]) {
      await page.goto(`http://127.0.0.1:3110${route}`); await page.locator('h1').first().waitFor(); await page.waitForTimeout(400)
      await capture(page, `${surface}-${name}`)
    }
    await page.locator('#controls').scrollIntoViewIfNeeded(); await capture(page, `${surface}-controls`)
    const metrics = await page.locator('#ds-native').evaluate(element => { const style = getComputedStyle(element); return { height: element.getBoundingClientRect().height, fontSize: parseFloat(style.fontSize), shadow: style.boxShadow } })
    const actionHeights = await page.getByRole('button', { name: /^(Continue|Compact action)$/ }).evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))
    assert.deepEqual(actionHeights, surface === 'mobile' ? [44, 44] : [40, 36])
    assert.ok(metrics.height >= (surface === 'mobile' ? 44 : 40)); assert.equal(metrics.shadow, 'none'); if (surface === 'mobile') assert.ok(metrics.fontSize >= 16)
    await page.getByLabel('Application status', { exact: true }).selectOption('review'); assert.equal(await page.locator('#ds-native').inputValue(), 'review')
    await page.getByRole('combobox', { name: 'Recruitment term' }).click(); await page.getByRole('option', { name: 'Spring semester' }).click()
    await page.getByRole('button', { name: 'Open dialog', exact: true }).click(); await page.getByRole('dialog').waitFor(); await capture(page, `${surface}-dialog`)
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(await page.getByRole('button', { name: 'Open dialog', exact: true }).evaluate(element => element === document.activeElement), true)
    await page.emulateMedia({ reducedMotion: 'reduce' }); const duration = await page.locator('[data-layout="inline"] svg').evaluate(element => getComputedStyle(element).animationDuration); assert.ok(parseFloat(duration) <= .001)
    if (process.env.OUTCLASS_AXE_MODULE) {
      await page.addScriptTag({ path: require.resolve(`${process.env.OUTCLASS_AXE_MODULE}/axe.min.js`) })
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.length })))
      assert.deepEqual(violations, [], `${surface} reference accessibility`)
    }
    assert.deepEqual(errors, []); await context.close()
    const leader = await contextFor('leader', viewport), lp = await leader.newPage()
    lp.on('pageerror', error => errors.push(error.message))
    for (const [name, query] of [['leader-applicants', '?section=recruitment&tool=applicants'], ['leader-application-settings', '?section=settings&setting=application'], ['leader-tasks', '?section=tasks']]) {
      await lp.goto(`http://127.0.0.1:3110/club/${membership.clubId}/workspace${query}`); await lp.locator('[data-product-shell]').last().waitFor(); await lp.waitForTimeout(1000); if (await lp.getByRole('button', { name: 'Skip', exact: true }).isVisible()) await lp.getByRole('button', { name: 'Skip', exact: true }).click(); await capture(lp, `${surface}-${name}`)
    }
    assert.deepEqual(errors, []); await leader.close()
    const admin = await contextFor('admin', viewport), ap = await admin.newPage()
    ap.on('pageerror', error => errors.push(error.message))
    await ap.goto('http://127.0.0.1:3110/platform/login'); await ap.getByLabel('Password', { exact: true }).fill(c.identities.admin.password); await ap.getByRole('button', { name: 'Continue securely' }).click()
    await ap.getByLabel('Authenticator code').fill(totp(c.identities.admin.totpSecret)); await ap.getByRole('button', { name: 'Verify and enter' }).click(); await ap.waitForURL('**/platform')
    for (const section of ['users', 'reports']) { await ap.goto(`http://127.0.0.1:3110/platform/${section}`); await ap.locator('[data-product-shell]').last().waitFor(); await ap.waitForTimeout(600); await capture(ap, `${surface}-admin-${section}`) }
    assert.deepEqual(errors, []); await admin.close(); console.log(`PASS: ${surface} public, reference controls/dialog, leader tools, elevated admin; no horizontal overflow or page errors`)
  }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); await browser.close(); await db.$disconnect()
})().catch(async error => { console.error(error); if (browser) await browser.close(); await db.$disconnect(); process.exitCode = 1 })
