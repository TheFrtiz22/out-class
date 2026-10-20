const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const { Actor, readConfig, randomUUID, totp } = require('./helpers/onboarding-e2e.cjs');

const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
test('settings and authenticated navigation across roles, saves, history and responsive layouts', { skip: !configFile, timeout: 240000 }, async t => {
  const config = readConfig(configFile), db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) });
  t.after(async () => { await browser.close(); await db.$disconnect(); });
  const artifacts = path.join(os.tmpdir(), 'outclass-settings-artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const leader = new Actor(config), student = new Actor(config), interviewer = new Actor(config);
  for (const [actor, name, prefix] of [[leader, 'Settings Leader', 'leader'], [student, 'Settings Student', 'student'], [interviewer, 'Settings Interviewer', 'interviewer']]) {
    await actor.signUp(name, `nav${prefix}${suffix}`, 2028);
    await actor.profile(name, 2028);
  }
  const club = name => db.club.create({ data: { slug: `navigation-${name.toLowerCase()}-${suffix}`, name: `${name} Navigation Club`, tagline: 'Local navigation verification', description: 'Disposable organization for settings navigation checks.', color: '#142d45', category: 'Academic', claimedAt: new Date() } });
  const [first, second, unclaimed] = await Promise.all([club('First'), club('Second'), club('Unclaimed')]);
  await db.club.update({ where: { id: unclaimed.id }, data: { claimedAt: null } });
  const meeting = await db.meeting.create({ data: { clubId: first.id, title: 'Navigation test meeting', date: new Date(Date.now() + 86400000), location: 'Campus', audience: 'MEMBERS', isPublic: false } });
  for (const organization of [first, second]) {
    await db.clubMember.create({ data: { clubId: organization.id, userId: leader.user.id, isOwner: true, accessRole: 'OWNER' } });
    await db.pipelineRound.create({ data: { clubId: organization.id, name: 'Application Review', type: 'APPLICATION_REVIEW', order: 0 } });
  }
  await db.clubMember.create({ data: { clubId: first.id, userId: interviewer.user.id, accessRole: 'INTERVIEWER', permissions: ['applications.review', 'applicants.identify'] } });
  const call = (actor, file, name, ...args) => actor.action(`actions/${file}.ts`, name, args);
  const invitation = await call(leader, 'club-onboarding', 'createClubIdentityInvitation', { clubId: first.id, identifierTypeId: 'school-uva-computing-id', identifier: `navstudent${suffix}`, requestedRole: 'MEMBER' });
  await call(student, 'club-onboarding', 'setOrganizationInvitationDismissed', invitation.id, true);
  for (const actor of [leader, student, interviewer]) await call(actor, 'tutorials', 'saveTutorial', { experience: 'student', action: 'skip', step: 0 });
  for (const actor of [leader, interviewer]) await call(actor, 'tutorials', 'saveTutorial', { experience: 'leader', clubId: first.id, action: 'skip', step: 0 });
  const browserErrors = [];
  async function session(actor, viewport = { width: 1440, height: 1000 }) {
    const context = await browser.newContext({ viewport });
    await context.addCookies([...actor.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })));
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on("pageerror", error => { const entry = { path: new URL(page.url()).pathname, message: error.message }; browserErrors.push(entry); console.log("Browser exception:", JSON.stringify(entry)); });
    return page;
  }
  async function open(page, route) {
    const response = await page.goto(config.appUrl + route);
    assert.ok(response.status() < 400, `${route}: HTTP ${response.status()}`);
    await page.waitForFunction(() => document.querySelectorAll('[data-product-shell]').length === 1 && document.querySelector('[data-product-shell]').getBoundingClientRect().height > 0);
    assert.equal(await page.locator('[data-product-shell]').count(), 1, route);
    assert.equal(await page.locator('main').count(), 1, `one content landmark at ${route}`);
  }
  async function noOverflow(page) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'No horizontal page overflow'); }
  await t.test('anonymous public routes stay public and Settings requires authentication', async () => {
    const visitor = new Actor(config);
    const protectedResponse = await visitor.request('/settings/organizations');
    const body = await protectedResponse.text();
    assert.ok(protectedResponse.status === 307 || body.includes('__next-page-redirect'));
    assert.ok(!body.includes('data-settings-hub'));
    const response = await visitor.request(`/club/${first.id}`);
    assert.equal(response.status, 200); assert.ok(!(await response.text()).includes('data-product-shell'));
  });
  const studentPage = await session(student);
  await t.test('desktop settings keeps one shell, active navigation and state across personal sections', async () => {
    await open(studentPage, '/settings/profile');
    await studentPage.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
    await studentPage.getByRole('heading', { name: 'Education', exact: true }).waitFor();
    const nav = studentPage.getByRole('navigation', { name: 'Personal settings', exact: true });
    assert.ok(await nav.isVisible());
    assert.ok(!(await nav.textContent()).includes('Organization settings'));
    await studentPage.locator('[data-product-shell]').evaluate(node => { node.dataset.persistenceProbe = 'kept'; });
    await nav.getByRole('link', { name: 'Account & Security', exact: true }).click();
    await studentPage.getByRole('heading', { name: 'Account & Security', exact: true }).waitFor();
    assert.equal(await studentPage.locator('[data-product-shell]').getAttribute('data-persistence-probe'), 'kept');
    assert.ok(await studentPage.getByRole('button', { name: 'Send password reset email' }).isVisible());
    assert.equal(await nav.getByRole('link', { name: 'Account & Security', exact: true }).getAttribute('aria-current'), 'page');
    await noOverflow(studentPage);
    await studentPage.screenshot({ path: path.join(artifacts, 'desktop-account.png'), fullPage: true });
  });
  await t.test('notification preferences save through the existing action and survive refresh/history', async () => {
    await studentPage.getByRole('navigation', { name: 'Personal settings', exact: true }).getByRole('link', { name: 'Notifications', exact: true }).click();
    const checkbox = studentPage.getByRole('checkbox', { name: 'Club announcements', exact: true });
    await checkbox.uncheck();
    await studentPage.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await studentPage.getByText('Preferences saved.', { exact: true }).waitFor();
    assert.equal((await db.userNotificationPreference.findUniqueOrThrow({ where: { userId: student.user.id } })).emailAnnouncements, false);
    await studentPage.reload(); await checkbox.waitFor(); assert.equal(await checkbox.isChecked(), false);
    await studentPage.getByRole('navigation', { name: 'Personal settings', exact: true }).getByRole('link', { name: 'Profile', exact: true }).click();
    await studentPage.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
    await studentPage.goBack(); await studentPage.getByRole('heading', { name: 'Notifications', exact: true }).waitFor();
    await studentPage.goForward(); await studentPage.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
    await studentPage.getByRole('button', { name: 'Edit education', exact: true }).click();
    const dialog = studentPage.getByRole('dialog', { name: 'Education', exact: true });
    await dialog.getByLabel('Major / intended major').fill('Computer Science');
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal((await db.studentProfile.findUniqueOrThrow({ where: { userId: student.user.id } })).major, 'Computer Science');
  });
  await t.test('dismissed invitations remain recoverable, accept/decline refresh membership, and claims submit', async () => {
    await open(studentPage, '/settings/organizations');
    const pending = studentPage.getByRole('region', { name: 'Pending organization invitations' });
    await pending.getByRole('button', { name: 'Accept', exact: true }).click();
    await studentPage.getByRole('link', { name: `Open organization · ${first.name}` }).waitFor();
    assert.equal((await db.clubMember.findUniqueOrThrow({ where: { userId_clubId: { userId: student.user.id, clubId: first.id } } })).accessRole, 'MEMBER');
    const decline = await call(leader, 'club-onboarding', 'createClubIdentityInvitation', { clubId: second.id, identifierTypeId: 'school-uva-computing-id', identifier: `navstudent${suffix}`, requestedRole: 'MEMBER' });
    await studentPage.reload(); await pending.getByRole('button', { name: 'Decline', exact: true }).click();
    await pending.getByRole('button', { name: 'Confirm decline', exact: true }).click();
    await studentPage.waitForFunction(() => !document.querySelector('[aria-label="Pending organization invitations"]'));
    assert.equal((await db.clubInvitation.findUniqueOrThrow({ where: { id: decline.id } })).status, 'DECLINED');
    await open(studentPage, `/club-claims/${unclaimed.id}`);
    await studentPage.getByLabel('Your role and supporting evidence').fill('I am the elected president. The university organization directory lists my leadership role.');
    await studentPage.getByRole('button', { name: 'Submit for review', exact: true }).click();
    await studentPage.getByText('Your latest request: pending.', { exact: true }).waitFor();
    assert.equal(await db.clubClaim.count({ where: { clubId: unclaimed.id, userId: student.user.id, status: 'PENDING' } }), 1);
  });
  await t.test('ordinary members cannot see configuration via navigation or direct URLs/actions', async () => {
    await open(studentPage, '/settings/organizations');
    assert.ok(!(await studentPage.getByRole('navigation', { name: 'Personal settings', exact: true }).textContent()).includes('Organization settings'));
    await open(studentPage, `/club/${first.id}/workspace?section=settings&setting=application`);
    await studentPage.getByRole('alert').filter({ hasText: 'This section isn’t available' }).waitFor();
    assert.equal(await studentPage.getByRole('button', { name: 'Publish application changes' }).count(), 0);
    await assert.rejects(call(student, 'club-settings', 'getApplicationSettings', first.id));
  });
  const leaderPage = await session(leader);
  await t.test('organization settings saves use the selected organization and switch context safely', async () => {
    await open(leaderPage, `/club/${first.id}/workspace?section=settings&setting=application`);
    const openApplications = leaderPage.getByLabel('Applications open', { exact: true });
    await openApplications.uncheck();
    await leaderPage.getByRole('button', { name: 'Publish application changes', exact: true }).click();
    await leaderPage.getByText('Application settings saved. Students now see this configuration.', { exact: true }).waitFor();
    assert.equal((await db.club.findUniqueOrThrow({ where: { id: first.id } })).applicationOpen, false);
    assert.equal((await db.club.findUniqueOrThrow({ where: { id: second.id } })).applicationOpen, true);
    await leaderPage.getByRole('button', { name: 'Switch workspace', exact: true }).click();
    await leaderPage.getByRole('menuitem').filter({ hasText: second.name }).click();
    await leaderPage.waitForURL(`**/club/${second.id}/workspace?section=settings&setting=application`);
    await leaderPage.waitForFunction(name => document.querySelector('.oc-workspace-switcher-trigger strong')?.textContent === name, second.name);
    await openApplications.waitFor(); assert.equal(await openApplications.isChecked(), true);
    await leaderPage.reload(); await openApplications.waitFor();
    assert.ok((await leaderPage.getByRole('button', { name: 'Switch workspace', exact: true }).textContent()).includes(second.name));
    await noOverflow(leaderPage);
    await leaderPage.screenshot({ path: path.join(artifacts, 'desktop-organization.png'), fullPage: true });
    await open(leaderPage, `/club/${first.id}/workspace?section=recruitment&tool=cycles`);
    await leaderPage.waitForURL('**/workspace?section=settings&setting=cycles');
    await open(leaderPage, `/club/${first.id}/workspace?section=recruitment&tool=letters`);
    await leaderPage.waitForURL('**/workspace?section=settings&setting=notifications');
    await leaderPage.getByText('Decision Letters', { exact: true }).waitFor();
    await open(leaderPage, `/club/${first.id}/tasks?taskView=mine`);
    assert.ok(new URL(leaderPage.url()).searchParams.get('section') === 'tasks');
    assert.equal(new URL(leaderPage.url()).searchParams.get('taskView'), 'mine');
  });
  await t.test('interviewer settings show only granted sections and deny unauthorized direct sections', async () => {
    const page = await session(interviewer);
    await open(page, `/club/${first.id}/workspace?section=settings&setting=interviews`);
    await page.getByRole('heading', { name: 'Interview configuration', exact: true }).waitFor();
    const nav = page.getByRole('navigation', { name: 'Settings sections', exact: true });
    assert.equal(await nav.getByRole('link').count(), 1);
    await open(page, `/club/${first.id}/workspace?section=settings&setting=general`);
    await page.getByText('This settings section isn’t available with your current access.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Publish profile', exact: true }).count(), 0);
    await db.clubMember.update({ where: { userId_clubId: { userId: interviewer.user.id, clubId: first.id } }, data: { permissions: ['interviews.manage'] } });
    await open(page, `/club/${first.id}/workspace?section=recruitment&tool=interviews&interviewTab=schedule`);
    await page.getByRole('tab', { name: 'Scheduling', exact: true }).waitFor();
  });
  await t.test('remaining detail routes retain shell, while interview schedules stay operational', async () => {
    for (const route of ['/meetings', `/meetings/${meeting.id}`, '/settings/availability', '/settings/interviews', '/corkboard', '/saved-clubs', `/club/${first.id}`, `/invitations/${invitation.id}`]) {
      await open(studentPage, route); await noOverflow(studentPage);
      if (route === '/settings/interviews') {
        assert.equal(await studentPage.locator('[data-settings-hub]').count(), 0);
        assert.equal(await studentPage.locator('aside [aria-current="page"]').textContent(), 'Calendar');
      }
    }
    await open(leaderPage, `/club-access/${first.id}`);
    await leaderPage.getByRole('heading', { name: 'Workspace access', exact: true }).waitFor();
    assert.equal(await leaderPage.locator('[data-product-shell]').getAttribute('data-product-shell'), 'manager');
  });
  await t.test('tablet and mobile keep primary navigation and accessible Settings selectors', async () => {
    for (const width of [820, 390]) {
      await studentPage.setViewportSize({ width, height: 900 });
      await open(studentPage, '/settings/organizations');
      const selector = studentPage.locator('#personal-settings-section');
      await selector.selectOption('/settings/notifications');
      await studentPage.getByRole('heading', { name: 'Notifications', exact: true }).waitFor();
      await noOverflow(studentPage);
      await studentPage.getByRole('button', { name: 'More navigation and workspaces', exact: true }).click();
      const drawer = studentPage.getByRole('dialog', { name: 'Workspace navigation', exact: true });
      await drawer.waitFor();
      assert.ok(await drawer.getByRole('link', { name: 'Settings', exact: true }).isVisible());
      await studentPage.keyboard.press('Escape'); await drawer.waitFor({ state: 'hidden' });
      await studentPage.screenshot({ path: path.join(artifacts, `${width === 390 ? 'mobile' : 'tablet'}-notifications.png`), fullPage: true });
      await leaderPage.setViewportSize({ width, height: 900 });
      await open(leaderPage, `/club/${first.id}/workspace?section=settings&setting=application`);
      await leaderPage.locator('#organization-settings-section').selectOption('interviews');
      await leaderPage.getByRole('heading', { name: 'Interview configuration', exact: true }).waitFor();
      await noOverflow(leaderPage);
    }
  });
  await t.test('superadmin retains its elevated administration shell', async () => {
    const admin = new Actor(config); await admin.signIn(config.admin.email, config.admin.password);
    const elevate = body => admin.request('/api/platform/elevation', { method: 'POST', headers: { origin: config.appUrl, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await elevate({ action: 'password', password: config.admin.password })).status, 200);
    assert.equal((await elevate({ action: 'verify', code: totp(config.admin.totpSecret) })).status, 200);
    const page = await session(admin); await open(page, '/platform');
    assert.equal(await page.locator('[data-product-shell]').getAttribute('data-product-shell'), 'admin');
  });
  assert.deepEqual(browserErrors, [], 'No uncaught browser exceptions');
  console.log(`Settings browser screenshots: ${artifacts}`);
});
