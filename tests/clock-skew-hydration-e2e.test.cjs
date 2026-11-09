// BUG-1: a device clock on the other side of a deadline or event end than the server must not change the
// first client render (React #418). Runs against the disposable onboarding stack.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const { Actor, readConfig, randomUUID } = require('./helpers/onboarding-e2e.cjs');
const { captureHydration } = require('./helpers/hydration-capture.cjs');

const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
test('server-rendered club profiles hydrate when the device clock is ahead of or behind the server', { skip: !configFile, timeout: 240000 }, async t => {
  const config = readConfig(configFile), db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) });
  t.after(async () => { await browser.close(); await db.$disconnect(); });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8), minute = 60_000, now = Date.now();
  const student = new Actor(config);
  await student.signUp('Clock Student', `clock${suffix}`, 2028);
  await student.profile('Clock Student', 2028);
  const makeClub = async (name, deadline) => {
    const club = await db.club.create({ data: { slug: `clock-${name}-${suffix}`, name: `Clock ${name} ${suffix}`, category: 'Academic', color: '#142D45', tagline: 'Local hydration verification', description: 'Disposable deadline fixture.', claimedAt: new Date(), applicationOpen: true, applicationDeadline: new Date(deadline) } });
    await db.pipelineRound.create({ data: { clubId: club.id, name: 'Application Review', type: 'APPLICATION_REVIEW', order: 0 } });
    return club;
  };
  // Open on the server for 10 more minutes, with a public event ending in 10 minutes.
  const open = await makeClub('open', now + 10 * minute);
  await db.meeting.create({ data: { clubId: open.id, title: `Clock info session ${suffix}`, description: 'Ends soon.', date: new Date(now - 50 * minute), endDate: new Date(now + 10 * minute), location: 'Newcomb Hall', audience: 'RECRUITMENT', isPublic: true, publication: { create: { status: 'PUBLISHED', approvedRevision: 0, rsvpEnabled: false, reviewedAt: new Date(), reviewedBy: student.user.id, publishedAt: new Date() } } } });
  // Closed on the server 10 minutes ago: a device 15 minutes behind would think it is still open.
  const closed = await makeClub('closed', now - 10 * minute);
  await db.clubMember.create({ data: { clubId: open.id, userId: student.user.id, accessRole: 'MEMBER', permissions: [] } });

  const cases = [
    // Each of these threw #418 before the fix (the device clock decided deadline and event state).
    { label: 'open deadline, device +15 min', route: `/club/${open.id}`, skew: 15, expect: [/Closing soon/, new RegExp(`Clock info session ${suffix}`)] },
    { label: 'open deadline, signed in, device +15 min', route: `/club/${open.id}`, skew: 15, signedIn: true, expect: [/Closing soon/] },
    { label: 'passed deadline, device −15 min', route: `/club/${closed.id}`, skew: -15, expect: [/deadline has passed/] },
    // Control: My Clubs has no clock-dependent first render; no #418 was reproduced here before or after.
    { label: 'My Clubs control, device +15 min', route: '/clubs', skew: 15, signedIn: true, expect: [] },
  ];
  const problems = [];
  for (const { label, route, skew, signedIn, expect } of cases) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (signedIn) await context.addCookies([...student.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })));
    const page = await context.newPage(), errors = [];
    captureHydration(page, label);
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setSystemTime(new Date(Date.now() + skew * minute));
    const response = await page.goto(config.appUrl + route, { waitUntil: 'networkidle' });
    assert.ok(response.status() < 400, `${label}: HTTP ${response.status()}`);
    // Hydration errors are reported asynchronously after recovery; give them time to surface.
    await page.waitForLoadState('load'); await page.waitForTimeout(2500);
    const hydration = errors.filter(message => /#418|#423|#425|[Hh]ydrat/.test(message));
    if (hydration.length) problems.push(`${label}: ${hydration[0].slice(0, 60)}`);
    const text = await page.locator('main').innerText();
    for (const pattern of expect) if (!pattern.test(text)) problems.push(`${label}: missing ${pattern}`);
    await context.close();
  }
  assert.deepEqual(problems, [], 'every case hydrates without a mismatch and keeps the server state');
});
