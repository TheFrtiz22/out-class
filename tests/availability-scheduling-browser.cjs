const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
const { PrismaClient, Prisma } = require('@prisma/client'), { createServerClient } = require('@supabase/ssr'), { chromium, devices } = require('playwright')
const { Actor } = require('./helpers/onboarding-e2e.cjs')
async function prepare(db, auth, config) {
  await require('./panel-publication-browser.cjs').prepare(db, auth, config)
  const club = config.clubs[0]
  await db.interviewRoundParticipation.update({ where: { memberId_roundId: { memberId: club.memberId, roundId: club.roundId } }, data: { availability: Prisma.DbNull, confirmedAt: null } })
  await db.userAvailability.create({ data: { userId: config.actors.interviewer.id, schedule: { timezone: 'America/New_York', weeklySubmitted: true, weekly: Array.from({ length: 7 }, () => [[0, 1440]]), exceptions: {} } } })
}
async function verify(config, root) {
  assert.equal(config.projectId, 'outclass-availability-e2e'); assert.equal(new URL(config.status.DB_URL).port, '57322')
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL }), browser = await chromium.launch(process.platform === 'darwin' ? { channel: 'chrome' } : {}), errors = [], pages = []
  const club = config.clubs[0], scope = { clubId: club.id, roundId: club.roundId }
  const ownerActor = new Actor(config), memberActor = new Actor(config)
  await ownerActor.signIn(config.actors.owner.email, config.actors.owner.password); await memberActor.signIn(config.actors.interviewer.email, config.actors.interviewer.password)
  async function context(role, mobile = false) {
    const cookies = new Map(), auth = createServerClient(config.status.API_URL, config.status.PUBLISHABLE_KEY, { cookies: { getAll: () => [...cookies.values()], setAll: values => values.forEach(v => cookies.set(v.name, v)) } })
    const { error } = await auth.auth.signInWithPassword(config.actors[role]); if (error) throw error
    const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'], defaultBrowserType: undefined } : { viewport: { width: 1440, height: 1000 }, timezoneId: 'America/New_York' })
    await ctx.addCookies([...cookies.values()].map(({ name, value }) => ({ name, value, url: config.appUrl, sameSite: 'Lax' })))
    const page = await ctx.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message)); return { page, ctx }
  }
  async function dismiss(page) { const skip = page.getByRole('button', { name: 'Skip tutorial', exact: true }); try { await skip.waitFor({ timeout: 2500 }); await skip.click(); await skip.waitFor({ state: 'hidden' }) } catch {} }
  const workflow = page => page.getByRole('navigation', { name: 'Scheduling workflow' })
  try {
    assert.equal(await db.interviewPanelScheduleVersion.count(), 0, 'Rerun collection only on an unpublished disposable fixture')
    await db.userNotification.deleteMany({ where: { clubId: { in: config.clubs.map(c => c.id) }, eventKey: { startsWith: 'availability-request:' } } })
    await db.interviewPanelProposal.deleteMany({ where: { clubId: club.id } })
    await db.interviewRoom.update({ where: { id: config.panels.roomId }, data: { interviewersNeeded: 2 } })
    await db.interviewRoundParticipation.updateMany({ where: { memberId: { in: config.clubs.map(c => c.memberId) } }, data: { confirmedAt: null, requestedAt: null, lastReminderAt: null, reminderSequence: 0, declinedAt: null, availability: Prisma.DbNull } })
    const admin = await context('owner'); await admin.page.goto(`${config.appUrl}/club/${club.id}/workspace?section=recruitment&tool=interviews`); await admin.page.getByRole('tab', { name: 'Scheduling' }).waitFor(); await dismiss(admin.page)
    await admin.page.getByRole('tab', { name: 'Scheduling' }).click(); await admin.page.getByLabel('Select Test Interviewer', { exact: true }).check()
    await admin.page.getByRole('button', { name: 'Request availability from selected' }).click(); await admin.page.getByText('1 request sent.', { exact: false }).waitFor()
    let row = await db.interviewRoundParticipation.findUniqueOrThrow({ where: { memberId_roundId: { memberId: club.memberId, roundId: club.roundId } } }); assert.ok(row.requestedAt); assert.equal(row.confirmedAt, null)
    assert.equal(await db.userNotification.count({ where: { eventKey: { startsWith: `availability-request:${row.id}:` } } }), 1)
    // Real reminders go through the same route/outbox, bounded by server cooldown.
    await db.interviewRoundParticipation.update({ where: { id: row.id }, data: { requestedAt: new Date(Date.now() - 25 * 3600000) } })
    await admin.page.getByRole('button', { name: 'Refresh overview' }).click(); await admin.page.getByRole('button', { name: 'Remind nonresponders' }).click(); await admin.page.getByText('1 reminder sent.', { exact: false }).waitFor()
    const member = await context('interviewer'); await member.page.goto(config.appUrl + '/?workspace=student&view=student-dashboard'); await dismiss(member.page)
    await member.page.getByRole('navigation', { name: 'Availability navigation' }).getByRole('link', { name: 'My Availability' }).waitFor()
    const tasks = member.page.getByRole('region', { name: 'Availability requests' }); await tasks.getByText('Awaiting response', { exact: true }).waitFor(); await tasks.getByRole('link', { name: 'Respond to request' }).click()
    await member.page.getByRole('button', { name: 'Submit round availability', exact: true }).waitFor(); assert.equal(new URL(member.page.url()).searchParams.get('roundId'), club.roundId)
    const gridCell = member.page.locator('[data-av-cell="0:95"]'); await gridCell.scrollIntoViewIfNeeded(); await gridCell.click()
    await member.page.getByText('All changes saved', { exact: true }).waitFor(); row = await db.interviewRoundParticipation.findUniqueOrThrow({ where: { id: row.id } }); assert.equal(row.confirmedAt, null)
    assert.deepEqual((await db.userAvailability.findUniqueOrThrow({ where: { userId: config.actors.interviewer.id } })).schedule.exceptions, {})
    await member.page.getByRole('button', { name: 'Submit round availability', exact: true }).click(); await member.page.getByText('Submitted · Participation confirmed.', { exact: false }).waitFor()
    await member.page.getByRole('link', { name: 'Back to Home' }).click(); await tasks.getByText('Submitted', { exact: true }).waitFor()
    await admin.page.bringToFront(); await admin.page.getByRole('button', { name: 'Refresh overview' }).click(); await admin.page.getByRole('row').filter({ hasText: 'Test Interviewer' }).getByText('Submitted', { exact: true }).waitFor()
    await workflow(admin.page).getByRole('button', { name: 'Rooms', exact: true }).click(); await admin.page.getByLabel('Interviewers needed for Room A', { exact: true }).selectOption('3')
    await admin.page.getByText('Staffing requirement saved.', { exact: false }).waitFor(); await admin.page.waitForFunction(() => document.querySelector('select[aria-label="Interviewers needed for Room A"]').value === '3'); await admin.page.getByLabel('Interviewers needed for Room A', { exact: true }).selectOption('2'); await admin.page.getByText('Staffing requirement saved.', { exact: false }).waitFor()
    // Let the saved requirement's refresh settle, then generate only a private proposal.
    await admin.page.waitForFunction(() => !document.querySelector('select[aria-label="Interviewers needed for Room A"]').disabled)
    const filterDate = config.panels.window.start.slice(0, 10); await admin.page.getByLabel('Filter interview date', { exact: true }).fill(filterDate)
    await admin.page.getByRole('button', { name: 'Auto-Fill Panels', exact: true }).first().click(); const panel = admin.page.getByRole('region', { name: 'Review Panel Assignments' }); await panel.getByText('100% staffed', { exact: false }).waitFor()
    assert.equal(new URL(admin.page.url()).searchParams.get('schedule'), 'review'); assert.equal(await db.interviewPanelScheduleVersion.count(), 0)
    await panel.getByRole('button', { name: /^Lock / }).first().click(); await panel.getByText('Change validated.', { exact: false }).waitFor()
    const locked = await panel.getByRole('button', { name: /^Unlock / }).first().getAttribute('aria-label')
    await workflow(admin.page).getByRole('button', { name: 'Availability', exact: true }).click(); await workflow(admin.page).getByRole('button', { name: 'Review & Publish', exact: true }).click()
    await panel.getByRole('button', { name: locked, exact: true }).waitFor(); assert.equal(await panel.getAttribute('data-unsaved'), 'true'); assert.equal(await admin.page.getByLabel('Filter interview date', { exact: true }).inputValue(), filterDate)
    await admin.page.goBack(); await workflow(admin.page).getByRole('button', { name: 'Availability', exact: true }).waitFor(); await admin.page.goForward(); await panel.getByRole('button', { name: locked, exact: true }).waitFor()
    await panel.getByRole('button', { name: 'Save Draft', exact: true }).click(); await panel.getByText('Draft saved.', { exact: true }).waitFor(); await panel.getByRole('button', { name: 'Discard Draft', exact: true }).click(); await panel.getByText('Draft discarded.', { exact: true }).waitFor()
    // Mobile request deep-link and explicit decline in a different club leave the first response intact.
    const other = config.clubs[1]; await ownerActor.action('actions/availability.ts', 'requestRoundAvailability', [{ clubId: other.id, roundId: other.roundId, memberIds: [other.memberId] }])
    const mobile = await context('interviewer', true); await mobile.page.goto(config.appUrl + '/?workspace=student&view=student-dashboard'); await dismiss(mobile.page)
    await mobile.page.getByRole('button', { name: 'More navigation and workspaces' }).tap(); await mobile.page.getByRole('navigation', { name: 'Availability navigation' }).getByRole('link', { name: 'My Availability' }).waitFor()
    await mobile.page.getByRole('button', { name: 'Close', exact: true }).tap(); await mobile.page.getByRole('region', { name: 'Availability requests' }).getByRole('link', { name: 'Respond to request' }).tap()
    await mobile.page.getByRole('button', { name: 'Decline participation', exact: true }).tap(); await mobile.page.getByText('Declined participation.', { exact: false }).waitFor()
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await mobile.page.screenshot({ path: path.join(root, 'availability-response-mobile.png'), fullPage: false })
    assert.equal((await memberActor.action('actions/availability.ts', 'getMyRoundAvailability', [scope])).confirmed, true)
    assert.deepEqual(errors, [])
    await admin.page.screenshot({ path: path.join(root, 'scheduling-review-desktop.png'), fullPage: false })
    console.log('Request → reminder → dashboard → scoped response; mobile decline; room headcount → private Auto-Fill → unsaved navigation/back → save/discard: PASS')
  } catch (error) {
    console.error("Browser errors:", errors)
    for (let i = 0; i < pages.length; i++) { const page = pages[i]; await page.screenshot({ path: path.join(root, `ux-failure-${i}.png`) }).catch(() => {}); console.error(`Page ${i}:`, page.url(), (await page.locator("main").innerText().catch(() => "")).slice(-5500)) }
    throw error
  } finally { await db.$disconnect(); await browser.close() }
  const regressions = new PrismaClient({ datasourceUrl: config.status.DB_URL })
  try {
    await regressions.clubMember.updateMany({ where: { clubId: club.id, userId: config.actors.fourth.id }, data: { interviewerEligible: false } })
    await require('./panel-proposals-browser.cjs').verify(config, root)
  } finally {
    await regressions.clubMember.updateMany({ where: { clubId: club.id, userId: config.actors.fourth.id }, data: { interviewerEligible: null } }); await regressions.$disconnect()
  }
  await require('./panel-publication-browser.cjs').verify(config, root)
  fs.writeFileSync(path.join(root, 'ux-acceptance.json'), JSON.stringify({ passed: true, collection: true, dashboardDeepLinks: true, desktopMobile: true, unsavedNavigation: true, approvalAndRevisionRegression: true }, null, 2))
}
module.exports = { prepare, verify }
if (require.main === module) { const config = process.argv[2]; verify(JSON.parse(fs.readFileSync(config)), path.dirname(config)).catch(e => { console.error(e); process.exitCode = 1 }) }
