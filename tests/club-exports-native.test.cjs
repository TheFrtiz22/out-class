// Leader CSV exports against real PostgreSQL and Prisma relations; synthetic authentication only.
// Runs in the disposable `transactions` CI job (scripts/test-decision-transactions-local.cjs).
// This never inherits DATABASE_URL or connects to staging/production.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { randomUUID } = require('node:crypto');
const databaseUrl = process.env.OUTCLASS_RECRUITMENT_TEST_DATABASE_URL;

function exportRoute(prisma, userId) {
  const cache = {};
  function load(file) {
    file = path.resolve(file); if (cache[file]) return cache[file].exports;
    const mod = { exports: {} }; cache[file] = mod;
    const mocks = {
      '@/utils/prisma': { prisma },
      // Synthetic session; the capability check reads the real membership row.
      '@/utils/auth': { requireClubPermission: async (clubId, permissions) => {
        const membership = await prisma.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } } });
        if (!membership || membership.status !== 'ACTIVE' || !permissions.every(p => membership.isOwner || membership.permissions.includes(p))) throw Error('Denied');
        return { user: { id: userId }, membership };
      } },
      '@/utils/support-audit': { auditSupportAction: async () => {} },
    };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(n => n in mocks ? mocks[n] : n.startsWith('@/') ? load(n.slice(2) + '.ts') : require(n), mod, mod.exports);
    return mod.exports;
  }
  const { GET } = load('app/api/club-exports/route.ts');
  return async query => {
    const res = await GET(new Request(`https://out-class.net/api/club-exports?${query}`));
    return { status: res.status, lines: (await res.text()).replace(/^﻿/, '').trim().split('\r\n') };
  };
}

test('native leader CSV exports: cross-club filters return headers only; anonymous applicants masked', { skip: !databaseUrl, timeout: 120000 }, async () => {
  const url = new URL(databaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/outclass_recruitment_test', 'Requires disposable local outclass_recruitment_test');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    assert.equal((await prisma.$queryRaw`SELECT current_database() AS name`)[0].name, 'outclass_recruitment_test');
    const tag = randomUUID().slice(0, 8);
    const person = async (first, last) => prisma.user.create({ data: { email: `${first.toLowerCase()}-${tag}@virginia.edu`,
      studentProfile: { create: { firstName: first, lastName: last, computingId: `${first.toLowerCase()}${tag}`, major: 'Economics', gradYear: 2028 } } } });
    const [leader, hidden, plain, other] = [await person('Leader', 'A'), await person('Hidden', 'Applicant'), await person('Plain', 'Student'), await person('Other', 'Club')];
    const club = name => prisma.club.create({ data: { name, slug: randomUUID(), tagline: '', description: '', color: '#fff', category: 'Other' } });
    const [clubA, clubB] = [await club(`Export A ${tag}`), await club(`Export B ${tag}`)];
    await prisma.clubMember.create({ data: { clubId: clubA.id, userId: leader.id, isOwner: true, accessRole: 'OWNER' } });
    await prisma.clubMember.create({ data: { clubId: clubB.id, userId: other.id, isOwner: true, accessRole: 'OWNER' } });

    // Club A: an anonymous-review round with one submitted application, a meeting and a published event.
    const anonRound = await prisma.pipelineRound.create({ data: { clubId: clubA.id, name: 'Blind', type: 'APPLICATION_REVIEW', order: 0, anonymousReview: true } });
    await prisma.application.create({ data: { clubId: clubA.id, studentId: hidden.id, roundId: anonRound.id, status: 'SUBMITTED', submittedAt: new Date() } });
    const meetingA = await prisma.meeting.create({ data: { clubId: clubA.id, title: 'GBM', date: new Date('2026-11-03T22:00:00Z'), location: 'Rotunda' } });
    const eventA = await prisma.meeting.create({ data: { clubId: clubA.id, title: 'Info night', date: new Date('2026-11-05T22:00:00Z'), location: 'Newcomb', publication: { create: { status: 'PUBLISHED' } } } });
    for (const s of [hidden, plain]) {
      await prisma.eventAttendance.create({ data: { eventId: meetingA.id, studentId: s.id } });
      await prisma.eventRsvp.create({ data: { eventId: eventA.id, userId: s.id } });
    }

    // Club B has rows behind every id a club-A leader might pass in.
    const roundB = await prisma.pipelineRound.create({ data: { clubId: clubB.id, name: 'Open', type: 'APPLICATION_REVIEW', order: 0 } });
    await prisma.application.create({ data: { clubId: clubB.id, studentId: plain.id, roundId: roundB.id, status: 'SUBMITTED', submittedAt: new Date() } });
    const meetingB = await prisma.meeting.create({ data: { clubId: clubB.id, title: 'B meeting', date: new Date(), location: 'B' } });
    const eventB = await prisma.meeting.create({ data: { clubId: clubB.id, title: 'B event', date: new Date(), location: 'B', publication: { create: { status: 'PUBLISHED' } } } });
    await prisma.eventAttendance.create({ data: { eventId: meetingB.id, studentId: plain.id } });
    await prisma.eventRsvp.create({ data: { eventId: eventB.id, userId: plain.id } });

    const get = exportRoute(prisma, leader.id);
    // A club-A leader passing club-B ids gets a header-only file, never club-B rows.
    for (const [kind, key, id] of [['applicants', 'roundId', roundB.id], ['attendance', 'eventId', meetingB.id], ['rsvps', 'eventId', eventB.id]]) {
      const res = await get(`clubId=${clubA.id}&kind=${kind}&${key}=${id}`);
      assert.equal(res.status, 200, kind);
      assert.equal(res.lines.length, 1, `${kind} with a club-B ${key} must be header-only`);
    }
    // Asking for club B directly is refused.
    assert.equal((await get(`clubId=${clubB.id}&kind=roster`)).status, 403);

    // Anonymous-review applicant is masked in attendance and RSVPs; the plain student is not.
    const attendance = await get(`clubId=${clubA.id}&kind=attendance&eventId=${meetingA.id}`);
    assert.equal(attendance.lines.length, 3);
    assert.ok(attendance.lines.some(line => /^GBM,2026-11-03,Anonymous applicant,,,/.test(line)));
    assert.ok(attendance.lines.some(line => line.includes(`Plain,Student,${plain.email}`)));
    const rsvps = await get(`clubId=${clubA.id}&kind=rsvps&eventId=${eventA.id}`);
    assert.equal(rsvps.lines.length, 3);
    assert.ok(rsvps.lines.some(line => /^Info night,2026-11-05,Anonymous applicant,,,/.test(line)));
    for (const res of [attendance, rsvps]) assert.ok(!res.lines.join('\n').includes('Hidden') && !res.lines.join('\n').includes(hidden.email));

    // The applicant export resolves round.anonymousReview and masks identity, email and computing ID.
    const applicants = await get(`clubId=${clubA.id}&kind=applicants&roundId=${anonRound.id}`);
    assert.equal(applicants.lines.length, 2);
    assert.match(applicants.lines[1], /^Applicant,/);
    assert.ok(!applicants.lines[1].includes(hidden.email) && !applicants.lines[1].includes(`hidden${tag}`));

    // One audit row per successful export, scoped to club A.
    const audits = await prisma.auditLog.findMany({ where: { actorId: leader.id, clubId: clubA.id, action: { startsWith: 'club.export.' } } });
    assert.equal(audits.length, 6);
    assert.equal(await prisma.auditLog.count({ where: { actorId: leader.id, clubId: clubB.id } }), 0);
  } finally {
    await prisma.$disconnect();
  }
});
