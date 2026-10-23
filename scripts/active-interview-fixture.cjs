// Synthetic data only, confined by the existing reserved local configuration guard.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { Actor, confirmationMessage } = require('../tests/helpers/onboarding-e2e.cjs');
const { fixtureProfile } = require('./navigation-fixture-config.cjs');

async function activeInterviewFixture(config, navigation) {
  const profile = fixtureProfile(config.projectId === 'outclass-hydration-e2e');
  const filename = path.join(profile.root, 'active-interview-fixture.json');
  // Revalidate even when called from another harness.
  const guarded = profile.readConfig(path.join(path.dirname(filename), 'config.json'));
  assert.equal(config.projectId, profile.projectId);
  assert.equal(config.appUrl, profile.appUrl);
  assert.ok(config.status.DB_URL === guarded.status.DB_URL && config.status.API_URL === guarded.status.API_URL, 'Only the validated local fixture connections are allowed');
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
  try {
    if (fs.existsSync(filename)) {
      const existing = JSON.parse(fs.readFileSync(filename));
      assert.equal(existing.clubId, navigation.clubIds[0]);
      assert.equal(await db.interviewBooking.count({ where: { slot: { clubId: existing.clubId } } }), 24);
      const [grants, approvals] = await Promise.all([
        db.interviewPanelAssignment.count({ where: { application: { clubId: existing.clubId }, bookingManaged: true, revokedAt: null } }),
        db.interviewRoom.count({ where: { clubId: existing.clubId, panelApprovedBy: { not: null } } }),
      ]);
      assert.equal(grants, 96, 'Active workload requires 96 live grants; create a fresh fixture after revocation tests');
      assert.equal(approvals, 3, 'Active workload requires three owner-approved rooms');
      existing.counts.activeClubMembers = await db.clubMember.count({ where: { clubId: existing.clubId } });
      return existing;
    }
    const clubId = navigation.clubIds[0];
    const round = await db.pipelineRound.findFirstOrThrow({ where: { clubId, type: 'INTERVIEW' } });
    const credentials = [{ email: navigation.email, password: navigation.password }];
    const owner = await db.clubMember.findUniqueOrThrow({ where: { userId_clubId: { userId: navigation.userId, clubId } } });
    const members = [owner];
    for (let i = 0; i < 3; i++) {
      const identifier = 'navreview' + randomUUID().replaceAll('-', '').slice(0, 10);
      const email = identifier + '@virginia.edu', password = 'Local-workload-only!' + randomUUID();
      const actor = new Actor(config);
      const signup = await actor.client.auth.signUp({ email, password });
      assert.ok(!signup.error, 'Disposable reviewer signup succeeds');
      const message = await confirmationMessage(config, email);
      const token = message.Text.match(/\b(\d{6})\b/)?.[1];
      assert.ok(token);
      const verified = await actor.client.auth.verifyOtp({ email, token, type: 'email' });
      assert.ok(!verified.error && verified.data.user?.email_confirmed_at);
      const userId = verified.data.user.id;
      await db.user.create({ data: { id: userId, email, studentProfile: { create: { firstName: 'Workload', lastName: 'Reviewer ' + (i + 1), computingId: identifier, major: 'Economics', gradYear: 2028 } } } });
      members.push(await db.clubMember.create({ data: { clubId, userId, accessRole: 'INTERVIEWER', permissions: ['applications.review', 'applicants.identify', 'interviews.manage'] } }));
      credentials.push({ email, password });
    }
    const apps = await db.application.findMany({ where: { clubId }, orderBy: { student: { studentProfile: { lastName: 'desc' } } }, take: 24, include: { student: { include: { studentProfile: true } } } });
    assert.equal(apps.length, 24);
    const start = new Date(Date.now() + 86400000); start.setUTCHours(13, 0, 0, 0);
    // Supported owner-attested room panels, with sequential non-overlapping slots.
    // Existing database guards validate every booking-managed assignment.
    const rooms = [];
    for (let i = 0; i < 3; i++) rooms.push(await db.interviewRoom.create({ data: { clubId, roundId: round.id, name: 'Workload Room ' + (i + 1), location: 'Synthetic room', kind: 'IN_PERSON', timezone: 'America/New_York', duration: 20, buffer: 5, interviewersNeeded: 4, panelMemberIds: members.map(m => m.id), approvedPanelMemberIds: members.map(m => m.id), panelApprovedBy: navigation.userId } }));
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i], room = rooms[i % rooms.length];
      await db.application.update({ where: { id: app.id }, data: { roundId: round.id, status: 'INTERVIEWING' } });
      const slot = await db.interviewSlot.create({ data: { clubId, roomId: room.id, startTime: new Date(+start + i * 25 * 60000), endTime: new Date(+start + (i * 25 + 20) * 60000), location: room.location } });
      const booking = await db.interviewBooking.create({ data: { slotId: slot.id, applicationId: app.id, roundId: round.id } });
      await db.interviewPanelAssignment.createMany({ data: members.map(m => ({ applicationId: app.id, roundId: round.id, memberId: m.id, grantedBy: navigation.userId, bookingManaged: true, bookingId: booking.id })) });
    }
    const fixture = { clubId, credentials, readyText: 'Audit Student 099', counts: { activeClubMembers: navigation.counts.membersPerClub + 3, rooms: 3, bookedCandidates: 24, reviewers: 4, assignmentsPerReviewer: 24, panelAuthority: 'Existing owner-attested room panel path; no published schedule version', sequentialNonOverlappingSlots: true } };
    fs.writeFileSync(filename, JSON.stringify(fixture), { mode: 0o600 });
    return fixture;
  } finally { await db.$disconnect(); }
}

module.exports = { activeInterviewFixture };
