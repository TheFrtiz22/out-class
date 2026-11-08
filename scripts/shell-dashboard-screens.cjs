// Screenshots for the persistent shell / header / dashboard split (disposable onboarding stack only).
// node scripts/shell-dashboard-screens.cjs <part> [config.json]   → docs/shell-dashboard-split/<part>/
const fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto')
const sharp = require('sharp')
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
  const account = await h.shellAccount(configFile, { elevate: part === 'part1' })
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
    if (part === 'part2') {
      // Tightest header: a leader of two clubs (club switcher beside the pill) with Admin. Removed afterwards.
      const second = account.fixture.clubIds[1]
      await account.db.clubMember.upsert({ where: { userId_clubId: { userId: account.config.admin.id, clubId: second } }, update: { status: 'ACTIVE', isOwner: true, accessRole: 'OWNER' }, create: { clubId: second, userId: account.config.admin.id, isOwner: true, accessRole: 'OWNER' } })
      try {
        for (const width of [1024, 1180, 1280, 1920]) {
          const context = await h.signedInContext(browser, account, { viewport: { width, height: 700 }, deviceScaleFactor: 2 })
          const page = await context.newPage()
          await page.goto(account.config.appUrl + `/club/${account.clubId}/workspace?section=overview`); await page.locator('main h1').first().waitFor()
          await page.waitForTimeout(800)
          await page.screenshot({ path: path.join(out, `header-${width}.png`), clip: { x: 0, y: 0, width, height: 260 } }); console.log('saved header', width)
          if (width === 1024 || width === 1920) { await page.goto(account.config.appUrl + '/saved-clubs'); await page.locator('main h1').first().waitFor(); await shot(page, `saved-clubs-${width}`) }
          await context.close()
        }
      } finally { await account.db.clubMember.delete({ where: { userId_clubId: { userId: account.config.admin.id, clubId: second } } }) }
    }
    if (part === 'part3') await dashboards(browser, account, out)
  } finally { await browser.close(); await account.db.$disconnect() }
})().catch(error => { console.error(error); process.exit(1) })

/**
 * Part 3: Club home and the Recruiting Overview side by side, at 1440 and 390, for a club mid-recruiting,
 * a club with no cycle, a new club, a plain member and an interviewer. Fixture clubs and memberships are
 * created on the disposable stack and removed afterwards.
 */
async function dashboards(browser, account, out) {
  const db = account.db, admin = account.config.admin.id, day = 86400000, created = [], memberships = []
  const club = async (name, extra = async () => {}) => {
    const id = randomUUID(); created.push(id)
    await db.club.create({ data: { id, slug: 'shots-' + id.slice(0, 8), name, tagline: 'Disposable screenshot fixture', description: 'Synthetic', color: '#2f5d50', category: 'Academic', claimedAt: new Date() } })
    const member = await db.clubMember.create({ data: { clubId: id, userId: admin, isOwner: true, accessRole: 'OWNER', interviewOffices: ['PRESIDENT'] } })
    await extra(id, member); return id
  }
  const quiet = await club('Quiet Hours Society', async (id, member) => {
    await db.meeting.create({ data: { clubId: id, title: 'Weekly study night', date: new Date(Date.now() + day + 3 * 3600000), location: 'Clemons 3rd floor', agenda: 'Exam check-ins\nRoom bookings for finals week' } })
    await db.meeting.create({ data: { clubId: id, title: 'Officer sync', date: new Date(Date.now() + 9 * day), location: 'Zoom' } })
    const task = await db.clubTask.create({ data: { clubId: id, title: 'Reserve finals-week rooms', dueAt: new Date(Date.now() + 2 * day) } })
    await db.taskAssignment.create({ data: { taskId: task.id, memberId: member.id, userId: admin } })
    await db.clubAnnouncement.create({ data: { clubId: id, authorId: admin, title: 'Finals schedule', body: 'Study nights move to Clemons for the next three weeks.', audience: 'MEMBERS', publishedAt: new Date(Date.now() - day) } })
  })
  const fresh = await club('Fresh Start Collective')
  const second = account.fixture.clubIds[1]
  const scenarios = [
    ['mid-recruiting', account.clubId, null],
    ['no-cycle', quiet, null],
    ['new-club', fresh, null],
    ['plain-member', second, { isOwner: false, accessRole: 'MEMBER', permissions: [], interviewOffices: [] }],
    ['interviewer', second, { isOwner: false, accessRole: 'MEMBER', permissions: ['applications.review', 'applicants.identify'], interviewOffices: ['BOARD'] }],
  ]
  try {
    for (const [name, clubId, access] of scenarios) {
      if (access) { await db.clubMember.upsert({ where: { userId_clubId: { userId: admin, clubId } }, update: { ...access, status: 'ACTIVE' }, create: { clubId, userId: admin, ...access } }); memberships.push(clubId) }
      for (const [width, height] of [[1440, 1100], [390, 844]]) {
        const shots = []
        for (const query of ['section=overview', 'section=recruitment&tool=overview']) {
          const context = await h.signedInContext(browser, account, { viewport: { width, height }, deviceScaleFactor: width > 760 ? 1 : 2 })
          const page = await context.newPage()
          await page.goto(account.config.appUrl + `/club/${clubId}/workspace?${query}`)
          await page.locator('main h1').first().waitFor({ timeout: 30000 })
          await page.waitForFunction(() => !document.querySelector('main .oc-dashboard-loading, main .oc-loading-state'), null, { timeout: 30000 }).catch(() => {})
          const skip = page.getByRole('button', { name: 'Skip', exact: true })
          if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(300) }
          await page.waitForTimeout(1200)
          shots.push(await page.screenshot({ fullPage: true }))
          await context.close()
        }
        const images = await Promise.all(shots.map(buffer => sharp(buffer).metadata().then(meta => ({ buffer, meta }))))
        const gap = 24, height2 = Math.max(...images.map(i => i.meta.height)), width2 = images.reduce((n, i) => n + i.meta.width, 0) + gap
        await sharp({ create: { width: width2, height: height2, channels: 3, background: '#d8d2c6' } })
          .composite([{ input: images[0].buffer, left: 0, top: 0 }, { input: images[1].buffer, left: images[0].meta.width + gap, top: 0 }])
          .png().toFile(path.join(out, `${name}-${width}.png`))
        console.log('saved', name, width, '(Club home | Recruiting Overview)')
      }
    }
  } finally {
    for (const clubId of memberships) await db.clubMember.deleteMany({ where: { clubId, userId: admin } })
    for (const id of created) {
      await db.clubAnnouncement.deleteMany({ where: { clubId: id } }); await db.taskAssignment.deleteMany({ where: { task: { clubId: id } } }); await db.clubTask.deleteMany({ where: { clubId: id } })
      await db.meeting.deleteMany({ where: { clubId: id } })
      // A club always keeps an active owner (database guard): hand it to the fixture's other account, then leave.
      await db.clubMember.upsert({ where: { userId_clubId: { userId: account.fixture.userId, clubId: id } }, update: { isOwner: true, accessRole: 'OWNER', status: 'ACTIVE' }, create: { clubId: id, userId: account.fixture.userId, isOwner: true, accessRole: 'OWNER' } })
      await db.clubMember.deleteMany({ where: { clubId: id, userId: admin } })
    }
  }
}
