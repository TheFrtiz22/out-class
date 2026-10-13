const assert = require('node:assert/strict'), path = require('node:path')
const { chromium, devices } = require('playwright'), { createServerClient } = require('@supabase/ssr'), { PrismaClient } = require('@prisma/client')
const { Actor } = require('./helpers/onboarding-e2e.cjs')
async function verify(config, root) {
  assert.equal(config.projectId, 'outclass-availability-e2e')
  assert.equal(config.appUrl, 'http://127.0.0.1:3126'); assert.equal(new URL(config.status.DB_URL).port, '57322')
  const browser = await chromium.launch({ ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}) })
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL }), errors = []
  async function context(role, mobile = false) {
    const cookies = new Map(), client = createServerClient(config.status.API_URL, config.status.PUBLISHABLE_KEY, { cookies: { getAll: () => [...cookies.values()], setAll: values => values.forEach(value => cookies.set(value.name, value)) } })
    const { error } = await client.auth.signInWithPassword(config.actors[role]); if (error) throw Error('Local fixture sign-in failed')
    const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'], defaultBrowserType: undefined } : { viewport: { width: 1440, height: 1000 }, timezoneId: 'America/New_York' })
    await ctx.addCookies([...cookies.values()].map(({ name, value }) => ({ name, value, url: config.appUrl, sameSite: 'Lax' })))
    const page = await ctx.newPage(); page.on('pageerror', error => errors.push(error.message)); return { ctx, page }
  }
  async function saved(page, section = page.locator('.oc-availability').first()) { await page.waitForTimeout(750); await section.locator('[role="status"]').filter({ hasText: 'All changes saved' }).waitFor() }
  async function cell(page, day, slot, section = page.locator('.oc-availability').first()) { const item = section.locator(`[data-av-cell="${day}:${slot}"]`); await item.scrollIntoViewIfNeeded(); return item }
  async function drag(page, day, from, to, section) {
    const first = await cell(page, day, from, section), last = await cell(page, day, to, section)
    const a = await first.boundingBox(), b = await last.boundingBox(); await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 }); await page.mouse.up()
  }
  try {
    // A retained fixture can be rerun after a UI fix; reset only its own declarations.
    await db.interviewRoundParticipation.deleteMany({ where: { clubId: { in: config.clubs.map(c => c.id) } } })
    await db.userAvailability.deleteMany({ where: { userId: { in: Object.values(config.actors).map(actor => actor.id) } } })
    await db.clubMember.updateMany({ where: { id: { in: config.clubs.map(c => c.memberId) } }, data: { interviewerEligible: null } })
    const { page } = await context('interviewer'); let posts = 0
    page.on('request', request => { if (request.method() === 'POST' && request.headers()['next-action']) posts++ })
    await page.goto(config.appUrl + '/settings/availability'); await page.getByRole('heading', { name: 'My Availability', exact: true }).waitFor()
    await drag(page, 0, 36, 39); await saved(page)
    assert.deepEqual((await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })).schedule.weekly[0], [[540, 600]])
    assert.equal(posts, 1, 'A drag autosaves once, not per cell')
    await drag(page, 0, 37, 38); await saved(page)
    assert.deepEqual((await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })).schedule.weekly[0], [[540, 555], [585, 600]])
    const keyboard = await cell(page, 0, 37); await keyboard.focus(); await keyboard.press('Space'); await keyboard.press('Shift+ArrowDown'); await saved(page)
    assert.deepEqual((await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })).schedule.weekly[0], [[540, 600]])
    await page.getByRole('button', { name: 'Specific dates', exact: true }).click(); await page.getByLabel('Week of', { exact: true }).fill('2026-10-12')
    await page.getByRole('button', { name: 'Clear Mon', exact: true }).click(); await saved(page)
    assert.deepEqual((await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })).schedule.exceptions['2026-10-12'], [])
    await page.getByRole('button', { name: 'Restore recurring availability on Monday' }).click(); await saved(page)
    await page.getByRole('button', { name: 'Copy day', exact: true }).click(); await saved(page)
    assert.deepEqual((await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })).schedule.exceptions['2026-10-13'], [[540, 600]])
    await page.getByLabel('Week of', { exact: true }).fill('2026-10-19'); await page.getByRole('button', { name: 'Copy previous week', exact: true }).click(); await saved(page)
    assert.deepEqual((await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })).schedule.exceptions['2026-10-20'], [[540, 600]])
    await page.screenshot({ path: path.join(root, 'desktop.png'), fullPage: false })
    const club = config.clubs[0]
    await page.getByRole('combobox', { name: 'Choose an interview round' }).selectOption(club.roundId)
    const round = page.locator('.oc-availability').nth(1); await round.getByRole('button', { name: 'Confirm participation', exact: true }).click()
    await round.getByText('Participation confirmed.', { exact: false }).waitFor()
    let participation = await db.interviewRoundParticipation.findUniqueOrThrow({ where: { memberId_roundId: { memberId: club.memberId, roundId: club.roundId } } }); assert.ok(participation.confirmedAt)
    const original = await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })
    await round.getByRole('button', { name: 'Clear Mon', exact: true }).click(); await saved(page, round)
    participation = await db.interviewRoundParticipation.findUniqueOrThrow({ where: { memberId_roundId: { memberId: club.memberId, roundId: club.roundId } } }); assert.equal(participation.confirmedAt, null)
    assert.deepEqual((await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })).schedule, original.schedule)
    await round.getByRole('button', { name: 'Confirm participation', exact: true }).click(); await round.getByText('Participation confirmed.', { exact: false }).waitFor()
    const mobile = await context('interviewer', true); await mobile.page.goto(config.appUrl + '/settings/availability')
    await mobile.page.getByRole('button', { name: 'Tue', exact: true }).tap()
    const tap = await cell(mobile.page, 1, 40); await tap.tap(); await saved(mobile.page)
    assert.deepEqual((await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })).schedule.weekly[1], [[600, 615]])
    await mobile.page.getByLabel('Enable touch dragging').check()
    const first = await cell(mobile.page, 1, 41), last = await cell(mobile.page, 1, 43), a = await first.boundingBox(), b = await last.boundingBox(), cdp = await mobile.ctx.newCDPSession(mobile.page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await saved(mobile.page)
    assert.deepEqual((await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })).schedule.weekly[1], [[600, 660]])
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await mobile.page.screenshot({ path: path.join(root, 'mobile.png'), fullPage: false })
    const actors = {}
    for (const role of ['owner', 'interviewer', 'outsider']) { actors[role] = new Actor(config); await actors[role].signIn(config.actors[role].email, config.actors[role].password) }
    const my = await actors.interviewer.action('actions/availability.ts', 'getMyAvailability', [])
    const concurrent = await Promise.allSettled([600, 615].map(end => actors.interviewer.action('actions/availability.ts', 'saveMyAvailability', [{ ...my.document, schedule: { ...my.document.schedule, weekly: [[[540, end]], ...my.document.schedule.weekly.slice(1)] } }])))
    assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal((await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })).revision, my.document.revision + 1)
    for (const role of ['interviewer', 'outsider']) await assert.rejects(actors[role].action('actions/availability.ts', 'getAvailabilityOverview', [{ clubId: club.id, roundId: club.roundId, week: '2026-10-12', timezone: 'UTC' }]))
    await assert.rejects(actors.interviewer.action('actions/availability.ts', 'setInterviewerEligibility', [{ clubId: club.id, revision: 0, targets: [{ memberId: club.memberId, eligible: true }] }]))
    await assert.rejects(actors.outsider.action('actions/availability.ts', 'getMyRoundAvailability', [{ clubId: club.id, roundId: club.roundId }]))
    await assert.rejects(actors.owner.action('actions/availability.ts', 'getAvailabilityOverview', [{ clubId: club.id, roundId: config.clubs[1].roundId, week: '2026-10-12', timezone: 'UTC' }]))
    assert.deepEqual(await actors.owner.action('actions/availability.ts', 'getEligibleInterviewerPool', [{ clubId: club.id, roundId: club.roundId, start: '2026-10-12T13:00:00Z', end: '2026-10-12T13:20:00Z' }]), [])
    console.log('Native concurrent saves and authenticated permission boundaries: PASS')
    const owner = await context('owner'); await owner.page.goto(`${config.appUrl}/club/${club.id}/workspace?section=recruitment&tool=interviews`)
    await owner.page.getByRole('tab', { name: 'Availability overview' }).click()
    await owner.page.getByLabel('Interview round', { exact: true }).selectOption(club.roundId)
    await owner.page.getByLabel('Week of', { exact: true }).fill('2026-10-12')
    await owner.page.getByRole('heading', { name: 'Existing interview session coverage' }).waitFor()
    await owner.page.getByText('No confirmed availability', { exact: true }).waitFor()
    await owner.page.screenshot({ path: path.join(root, 'overview.png'), fullPage: false })
    await owner.page.goto(`${config.appUrl}/club/${club.id}/workspace?section=members`)
    await owner.page.getByRole('heading', { name: 'Interviewer eligibility', exact: true }).waitFor()
    await owner.page.getByRole('checkbox', { name: 'Select Test Interviewer', exact: true }).check()
    await owner.page.getByRole('button', { name: 'Exclude from interviewing', exact: true }).click()
    await owner.page.getByText('Eligibility saved.', { exact: false }).waitFor()
    const member = await db.clubMember.findUniqueOrThrow({ where: { id: club.memberId } }); assert.equal(member.interviewerEligible, false); assert.deepEqual(member.permissions, ['applications.review', 'applicants.identify'])
    assert.equal((await db.clubMember.findUniqueOrThrow({ where: { id: config.clubs[1].memberId } })).interviewerEligible, null)
    assert.equal(await db.interviewPanelAssignment.count(), 0); assert.equal(await db.interviewBooking.count(), 0)
    assert.deepEqual(errors, []); console.log('Desktop drag/remove, keyboard, copy, overrides, confirmation, mobile tap/drag, overview and bulk eligibility: PASS')
  } finally { await browser.close(); await db.$disconnect() }
}
module.exports = { verify }
if (require.main === module) { const fs = require('node:fs'); const root = path.dirname(process.argv[2]); verify(JSON.parse(fs.readFileSync(process.argv[2])), root).catch(error => { console.error(error); process.exitCode = 1 }) }
