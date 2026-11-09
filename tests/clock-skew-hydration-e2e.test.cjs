// BUG-1: a browser clock a few minutes past a deadline the server still treats as open must not change the
// first client render (React #418). Runs against the disposable onboarding stack.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const { Actor, readConfig, randomUUID } = require('./helpers/onboarding-e2e.cjs');
const { captureHydration } = require('./helpers/hydration-capture.cjs');

const configFile = process.env.OUTCLASS_ONBOARDING_E2E_CONFIG;
test('club profile and My Clubs hydrate with a browser clock past an open deadline', { skip: !configFile, timeout: 180000 }, async t => {
  const config = readConfig(configFile), db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' }) });
  t.after(async () => { await browser.close(); await db.$disconnect(); });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const student = new Actor(config);
  await student.signUp('Clock Student', `clock${suffix}`, 2028);
  await student.profile('Clock Student', 2028);
  // Ten minutes left on the server; the browser runs fifteen minutes ahead.
  const club = await db.club.create({ data: { slug: `clock-skew-${suffix}`, name: `Clock Skew ${suffix}`, category: 'Academic', color: '#142D45', tagline: 'Local hydration verification', description: 'Disposable deadline fixture.', claimedAt: new Date(), applicationOpen: true, applicationDeadline: new Date(Date.now() + 10 * 60_000) } });
  await db.pipelineRound.create({ data: { clubId: club.id, name: 'Application Review', type: 'APPLICATION_REVIEW', order: 0 } });
  await db.clubMember.create({ data: { clubId: club.id, userId: student.user.id, accessRole: 'MEMBER', permissions: [] } });

  for (const [label, signedIn, route] of [['public profile', false, `/club/${club.id}`], ['signed-in profile', true, `/club/${club.id}`], ['My Clubs', true, '/clubs']]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (signedIn) await context.addCookies([...student.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })));
    const page = await context.newPage(), errors = [];
    captureHydration(page, label);
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setSystemTime(new Date(Date.now() + 15 * 60_000));
    const response = await page.goto(config.appUrl + route, { waitUntil: 'networkidle' });
    assert.ok(response.status() < 400, `${label}: HTTP ${response.status()}`);
    await page.waitForTimeout(1000);
    assert.deepEqual(errors.filter(message => /#418|#423|#425|[Hh]ydrat/.test(message)), [], `${label}: no hydration mismatch`);
    if (route.startsWith('/club/')) assert.match(await page.locator('main').innerText(), /Closing soon/, `${label}: the server's open deadline stands`);
    await context.close();
  }
});
