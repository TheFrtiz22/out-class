// Shared setup for the persistent-shell browser tests (disposable onboarding stack only).
const fs = require('node:fs'), path = require('node:path')
const { PrismaClient } = require('@prisma/client')
const { Actor, readConfig, totp } = require('./onboarding-e2e.cjs')

/**
 * The bootstrapped platform administrator (verified signup + TOTP) also owns the first navigation
 * fixture club and has a student profile, so one account sees Personal · club · Admin in the pill.
 */
async function shellAccount(configFile) {
  const config = readConfig(configFile)
  const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(configFile), 'navigation-fixture.json')))
  const admin = config.admin
  if (!admin) throw Error('The onboarding runner bootstraps the administrator; run it with --shell.')
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL })
  try {
    await db.studentProfile.upsert({ where: { userId: admin.id }, update: {}, create: { userId: admin.id, firstName: 'Shell', lastName: 'Admin', computingId: 'shell' + admin.id.slice(0, 6), major: 'Economics', gradYear: 2028 } })
    const clubId = fixture.clubIds[0]
    await db.clubMember.upsert({ where: { userId_clubId: { userId: admin.id, clubId } }, update: { isOwner: true, accessRole: 'OWNER', status: 'ACTIVE' }, create: { clubId, userId: admin.id, isOwner: true, accessRole: 'OWNER', interviewOffices: ['PRESIDENT'] } })
    const club = await db.club.findUniqueOrThrow({ where: { id: clubId }, select: { name: true } })
    const actor = new Actor(config)
    await actor.signIn(admin.email, admin.password)
    const challenge = await actor.client.auth.mfa.challengeAndVerify({ factorId: admin.factor, code: totp(admin.totpSecret) })
    if (challenge.error) throw challenge.error
    // /platform needs a fresh admin verification (password, then authenticator), as on /platform/login.
    const post = body => actor.request('/api/platform/elevation', { method: 'POST', headers: { origin: config.appUrl, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    for (const body of [{ action: 'password', password: admin.password }, { action: 'verify', code: totp(admin.totpSecret) }]) {
      const response = await post(body)
      if (response.status !== 200) throw Error(`Admin elevation ${body.action} failed: ${response.status}`)
    }
    return { config, fixture, clubId, clubName: club.name, actor, db }
  } catch (error) { await db.$disconnect(); throw error }
}

async function signedInContext(browser, account, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options })
  await context.addCookies([...account.actor.cookies].map(([name, value]) => ({ name, value, url: account.config.appUrl })))
  return context
}

/** Records the full-screen loader appearing at any point, and the header node identity. */
async function watchShell(page) {
  await page.evaluate(() => {
    window.__shellHeader = document.querySelector('.oc-product-header')
    window.__loaderSeen = !!document.querySelector('.oc-loading-screen')
    new MutationObserver(() => { if (document.querySelector('.oc-loading-screen')) window.__loaderSeen = true }).observe(document.body, { subtree: true, childList: true })
  })
}

/** Content is painted when the pill shows the target page as current and no placeholder is busy in main. */
async function contentPainted(page, label) {
  await page.waitForFunction(label => {
    const current = document.querySelector('a[data-workspace-option][aria-current="page"]')
    const main = document.querySelector('main#workspace-content')
    return current?.getAttribute('aria-label') === label && main && !main.querySelector('.oc-loading-state, .oc-dashboard-loading, [role="status"][aria-busy="true"]') && !!main.querySelector('h1')
  }, label, { timeout: 30000 })
}

/**
 * Clicks a pill segment and samples the indicator's computed transform every frame.
 * Returns the click-to-content time, the distinct transforms seen, and the final alignment.
 */
async function switchWorkspace(page, label) {
  await page.evaluate(() => {
    window.__transforms = []
    const indicator = document.querySelector('.oc-evolving-indicator')
    const until = performance.now() + 1500
    const sample = () => { window.__transforms.push(getComputedStyle(indicator).transform); if (performance.now() < until) requestAnimationFrame(sample) }
    requestAnimationFrame(sample)
  })
  const started = await page.evaluate(() => performance.now())
  await page.locator(`a[data-workspace-option][aria-label="${label}"]`).click()
  await contentPainted(page, label)
  const painted = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(performance.now()))))
  await page.waitForTimeout(700)
  return page.evaluate(({ started, painted, label }) => {
    const indicator = document.querySelector('.oc-evolving-indicator').getBoundingClientRect()
    const selected = document.querySelector(`a[data-workspace-option][aria-label="${label}"]`).closest('.oc-workspace-segment').getBoundingClientRect()
    return { ms: Math.round(painted - started), transforms: [...new Set(window.__transforms)], offset: Math.abs(indicator.left - selected.left), widthDelta: Math.abs(indicator.width - selected.width) }
  }, { started, painted, label })
}

module.exports = { shellAccount, signedInContext, watchShell, contentPainted, switchWorkspace }
