// Existing reserved publication fixture, real production build/Auth/actions/GET/PostgreSQL.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client'), { chromium } = require('playwright');
const { Actor } = require('./helpers/onboarding-e2e.cjs');
const { load } = require('./helpers/voting-harness.cjs');
const { decodeWorkspaceData } = load('lib/workspace-wire.ts');
async function verify(config, root) {
  assert.equal(config.projectId, 'outclass-availability-e2e');
  for (const [value, port] of [[config.appUrl, '3126'], [config.status.API_URL, '57321'], [config.status.DB_URL, '57322']]) { const url = new URL(value); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, port); }
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL }), browser = await chromium.launch({ headless: true });
  const club = config.clubs[0], scope = { clubId: club.id, roundId: club.roundId }, owner = new Actor(config), errors = [];
  try {
    await owner.signIn(config.actors.owner.email, config.actors.owner.password);
    const workspace = await owner.action('actions/panel-proposals.ts', 'generatePanelProposal', [{ ...scope, revision: 0, window: config.panels.window, options: { maxConsecutiveMinutes: null, breakMinutes: 15 }, mode: 'REGENERATE' }]);
    assert.equal(workspace.proposal.validation.filled, 6); assert.equal(await db.interviewPanelScheduleVersion.count(), 0);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.addCookies([...owner.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })));
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${config.appUrl}/club/${club.id}/workspace?section=recruitment&tool=interviews&interviewTab=schedule&schedule=review&roundId=${club.roundId}`);
    const panel = page.getByRole('region', { name: 'Review Panel Assignments' });
    await panel.getByRole('button', { name: 'Confirm interviewers', exact: true }).click();
    const approval = page.getByRole('dialog', { name: 'Final panel approval', exact: true }); await approval.waitFor();
    assert.equal(await db.interviewPanelScheduleVersion.count(), 0, 'Review alone must not publish');
    await approval.getByRole('button', { name: 'Approve interviewers', exact: true }).click(); await approval.waitFor({ state: 'hidden' });
    const version = await db.interviewPanelScheduleVersion.findFirstOrThrow({ where: scope });
    assert.equal(version.version, 1); assert.equal(version.publishedBy, owner.user.id);
    const booking = await db.interviewBooking.findUniqueOrThrow({ where: { applicationId_roundId: { applicationId: config.panels.applicationId, roundId: club.roundId } }, include: { slot: true } });
    assert.equal(booking.slot.panelScheduleVersionId, version.id);
    const grant = await db.interviewPanelAssignment.findFirstOrThrow({ where: { applicationId: booking.applicationId, roundId: club.roundId, revokedAt: null }, include: { member: true } });
    const credentials = Object.values(config.actors).find(actor => actor.id === grant.member.userId); assert.ok(credentials);
    const reviewer = new Actor(config); await reviewer.signIn(credentials.email, credentials.password);
    const read = async () => {
      const response = await reviewer.request('/api/workspace?' + new URLSearchParams({ kind: 'assignedRooms', args: JSON.stringify([club.id]) }));
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.match(response.headers.get('vary'), /Cookie/); assert.match(response.headers.get('server-timing'), /live_session;dur=/);
      return decodeWorkspaceData(await response.json());
    };
    assert.ok((await read()).some(row => row.applicationId === booking.applicationId && row.canOpen));
    await db.interviewRoom.updateMany({ where: { clubId: club.id }, data: { approvedPanelMemberIds: [], panelApprovedBy: null } });
    assert.ok((await read()).some(row => row.applicationId === booking.applicationId && row.canOpen), 'Published authority survives legacy approval removal');
    const reviewerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await reviewerContext.addCookies([...reviewer.cookies].map(([name, value]) => ({ name, value, url: config.appUrl })));
    const rooms = await reviewerContext.newPage(); rooms.on('pageerror', error => errors.push(error.message));
    await rooms.goto(`${config.appUrl}/club/${club.id}/workspace?section=recruitment&tool=interviews`);
    await rooms.getByRole('link', { name: /Open interview|Resume interview/ }).first().waitFor();
    assert.ok(await rooms.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await db.interviewPanelAssignment.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
    assert.ok(!(await read()).some(row => row.applicationId === booking.applicationId));
    await assert.rejects(reviewer.action('actions/interview-entry.ts', 'resolveInterviewRoomEntry', [{ ...scope, applicationId: booking.applicationId, bookingId: booking.id, slotId: booking.slotId, roomId: booking.slot.roomId }]));
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(root, 'published-navigation-acceptance.json'), JSON.stringify({ passed: true, explicitBrowserApproval: true, reviewAloneDoesNotPublish: true, realAuthAndLiveSession: true, publishedVersionAuthority: true, legacyApprovalRemovalSurvives: true, mobileRoomLink: true, immediateGrantRevocation: true, exactOpeningDeniedAfterRevocation: true, browserErrors: 0 }, null, 2));
    console.log('Published panel approval → private GET → mobile room link → live revocation: PASS');
  } finally { await browser.close(); await db.$disconnect(); }
}
module.exports = { verify };
