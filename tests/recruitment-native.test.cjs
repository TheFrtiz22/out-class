// Actual production actions and Prisma transactions; synthetic authentication only.
// This never inherits DATABASE_URL or connects to staging/production.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { randomUUID } = require('node:crypto');
const databaseUrl = process.env.OUTCLASS_RECRUITMENT_TEST_DATABASE_URL;
function actions(prisma, userId, onAuthorized = () => {}) {
  const cache = {};
  function load(file) {
    file = path.resolve(file); if (cache[file]) return cache[file].exports;
    const mod = { exports: {} }; cache[file] = mod;
    const mocks = {
      '@/utils/prisma': { prisma },
      '@/utils/auth': { requireClubPermission: async (clubId, permissions) => {
        const membership = await prisma.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } } });
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.disabledAt || !membership || membership.status !== 'ACTIVE'
          || !permissions.every(p => membership.isOwner || membership.permissions.includes(p))) throw Error('Denied');
        onAuthorized(); return { user, membership };
      } },
      'next/cache': { revalidatePath() {}, revalidateTag() {} },
    };
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(n => n in mocks ? mocks[n] : n.startsWith('@/') ? load(n.slice(2) + '.ts') : require(n), mod, mod.exports);
    return mod.exports;
  }
  return { crm: load('actions/crm.ts'), settings: load('actions/club-settings.ts'), display: load('actions/applicant-intelligence.ts'), photo: load('lib/crm-photo-authorization.ts') };
}
test('native recruitment authorization races, immutable round rename, feedback and narrow photos', { skip: !databaseUrl, timeout: 120000 }, async t => {
  const url = new URL(databaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/outclass_recruitment_test', 'Requires disposable local outclass_recruitment_test');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl }); t.after(() => prisma.$disconnect());
  assert.equal((await prisma.$queryRaw`SELECT current_database() AS name`)[0].name, 'outclass_recruitment_test');
  const [actor, student] = await Promise.all([0, 1].map(() => prisma.user.create({ data: { email: `recruitment-${randomUUID()}@virginia.edu` } })));
  const club = await prisma.club.create({ data: { name: 'Synthetic recruitment', slug: randomUUID(), tagline: '', description: '', color: '#fff', category: 'Other' } });
  const permissions = ['recruitment.manage', 'decisions.manage', 'applicants.identify', 'applications.review', 'interviews.manage'];
  const member = await prisma.clubMember.create({ data: { clubId: club.id, userId: actor.id, permissions, interviewOffices: ['BOARD'] } });
  const first = await prisma.pipelineRound.create({ data: { clubId: club.id, name: 'Applied', type: 'APPLICATION_REVIEW', order: 0 } });
  const interview = await prisma.pipelineRound.create({ data: { clubId: club.id, name: 'Interview', type: 'INTERVIEW', order: 1 } });
  const app = await prisma.application.create({ data: { clubId: club.id, studentId: student.id, roundId: first.id, status: 'SUBMITTED' } });
  const scope = { clubId: club.id, applicationId: app.id };
  const api = actions(prisma, actor.id);
  // Wait for an actual blocked PostgreSQL backend, not a timing-based approximation.
  async function blocked() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%SELECT id FROM "Club"%'`;
      if (rows.length) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error('Mutation did not demonstrably wait on the club lock');
  }
  for (const method of ['move', 'decision']) for (const revocation of ['permission', 'suspended-member', 'left-member', 'deleted-member', 'disabled-user', 'suspended-club']) {
    await t.test(`${method} rejects ${revocation} committed while waiting`, async () => {
      await prisma.user.update({ where: { id: actor.id }, data: { disabledAt: null } });
      await prisma.club.update({ where: { id: club.id }, data: { suspendedAt: null } });
      await prisma.clubMember.upsert({ where: { userId_clubId: { userId: actor.id, clubId: club.id } }, create: { id: member.id, userId: actor.id, clubId: club.id, permissions }, update: { status: 'ACTIVE', permissions } });
      let release, signalLocked, signalAuthorized;
      const hold = new Promise(resolve => release = resolve), locked = new Promise(resolve => signalLocked = resolve), authorized = new Promise(resolve => signalAuthorized = resolve);
      const revoke = prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${club.id} FOR UPDATE`; signalLocked(); await hold;
        if (revocation === 'permission') await tx.clubMember.update({ where: { id: member.id }, data: { permissions: permissions.filter(p => p !== (method === 'move' ? 'recruitment.manage' : 'decisions.manage')) } });
        else if (revocation === 'deleted-member') await tx.clubMember.delete({ where: { id: member.id } });
        else if (revocation === 'disabled-user') await tx.user.update({ where: { id: actor.id }, data: { disabledAt: new Date() } });
        else if (revocation === 'suspended-club') await tx.club.update({ where: { id: club.id }, data: { suspendedAt: new Date() } });
        else await tx.clubMember.update({ where: { id: member.id }, data: { status: revocation === 'left-member' ? 'LEFT' : 'SUSPENDED', permissions: [], interviewOffices: [], isOwner: false } });
      }, { timeout: 20000 });
      await locked;
      const current = actions(prisma, actor.id, signalAuthorized).crm;
      const pending = method === 'move' ? current.moveApplicantRound({ ...scope, newRoundId: interview.id }) : current.setApplicationStatus({ ...scope, status: 'ACCEPTED' });
      // Attach rejection handling before releasing the blocker.
      const denied = assert.rejects(pending, /denied|suspended/i);
      try { await authorized; await blocked(); } finally { release(); }
      await revoke; await denied;
      const unchanged = await prisma.application.findUnique({ where: { id: app.id } });
      assert.equal(unchanged.roundId, first.id); assert.equal(unchanged.status, 'SUBMITTED');
      assert.equal(await prisma.auditLog.count({ where: { clubId: club.id } }), 0);
    });
  }
  await prisma.club.update({ where: { id: club.id }, data: { suspendedAt: null } });
  await prisma.clubMember.update({ where: { id: member.id }, data: { status: 'ACTIVE', permissions, interviewOffices: ['BOARD'] } });
  await prisma.user.update({ where: { id: actor.id }, data: { disabledAt: null } });
  await api.crm.moveApplicantRound({ ...scope, newRoundId: interview.id });
  await api.crm.setApplicationStatus({ ...scope, status: 'INTERVIEWING' });
  const evaluation = await prisma.evaluation.create({ data: { applicationId: app.id, interviewerId: member.id, roundId: interview.id, round: 'Interview', score: 8.5, notes: 'Final feedback only', submittedAt: new Date() } });
  await t.test('pipeline rename succeeds against deployed immutable submitted evaluation constraints', async () => {
    await assert.rejects(prisma.evaluation.update({ where: { id: evaluation.id }, data: { round: 'Panel' } }), /immutable/);
    await api.settings.savePipelineSettings({ clubId: club.id, version: 0, rounds: [
      { id: first.id, name: 'Applied', type: 'APPLICATION_REVIEW', configuration: {} },
      { id: interview.id, name: 'Panel', type: 'INTERVIEW', configuration: {} },
    ] });
    assert.deepEqual(await prisma.evaluation.findUnique({ where: { id: evaluation.id } }), evaluation);
    assert.equal((await prisma.pipelineRound.findUnique({ where: { id: interview.id } })).name, 'Panel');
    assert.equal((await prisma.application.findUnique({ where: { id: app.id } })).roundId, interview.id);
    await assert.rejects(api.settings.savePipelineSettings({ clubId: club.id, version: 1, rounds: [
      { id: first.id, name: 'Interview', type: 'APPLICATION_REVIEW', configuration: {} },
      { id: interview.id, name: 'Panel', type: 'INTERVIEW', configuration: {} },
    ] }), /existing review history/);
    await api.settings.savePipelineSettings({ clubId: club.id, version: 1, rounds: [
      { id: first.id, name: 'Applied', type: 'APPLICATION_REVIEW', configuration: {} },
      { id: interview.id, name: 'Interview', type: 'INTERVIEW', configuration: {} },
    ] });
    assert.equal((await prisma.pipelineRound.findUnique({ where: { id: interview.id } })).name, 'Interview');
    assert.deepEqual(await prisma.evaluation.findUnique({ where: { id: evaluation.id } }), evaluation);
    await assert.rejects(prisma.evaluation.update({ where: { id: evaluation.id }, data: { notes: 'Rewritten' } }), /immutable/);
    await assert.rejects(prisma.evaluation.delete({ where: { id: evaluation.id } }), /immutable/);
  });
  await t.test('configured feedback reaches leadership, stays out of CRM, and historical/current anonymous contexts withhold it', async () => {
    assert.match(JSON.stringify(await api.display.getApplicantDisplay(scope)), /Final feedback only/);
    assert.doesNotMatch(JSON.stringify(await api.crm.getClubPipeline(club.id)), /Final feedback only/);
    await prisma.clubMember.update({ where: { id: member.id }, data: { interviewOffices: [] } });
    let display = await api.display.getApplicantDisplay(scope);
    assert.ok(display.withheld.includes('feedback')); assert.doesNotMatch(JSON.stringify(display), /Final feedback only/);
    await prisma.clubMember.update({ where: { id: member.id }, data: { interviewOffices: ['BOARD'] } });
    await prisma.pipelineRound.update({ where: { id: interview.id }, data: { anonymousReview: true } });
    display = await api.display.getApplicantDisplay(scope); assert.ok(display.anonymous); assert.doesNotMatch(JSON.stringify(display), /Final feedback only/);
    await prisma.application.update({ where: { id: app.id }, data: { roundId: first.id } });
    display = await api.display.getApplicantDisplay(scope); assert.equal(display.anonymous, false); assert.ok(display.withheld.includes('feedback')); assert.doesNotMatch(JSON.stringify(display), /Final feedback only/);
    await prisma.pipelineRound.update({ where: { id: interview.id }, data: { anonymousReview: false } });
  });
  await t.test('narrow photo read uses current grants, exact application and exact path', async () => {
    const photo = `${student.id}/photo.png`;
    await prisma.studentProfile.create({ data: { userId: student.id, firstName: 'Synthetic', lastName: 'Applicant', computingId: randomUUID(), major: 'Math', gradYear: 2028, headshotUrl: photo } });
    const check = (path = photo, applicationId = app.id) => prisma.$transaction(tx => api.photo.authorizeCrmPhoto(tx, actor.id, club.id, applicationId, path));
    assert.equal(await check(), true); assert.equal(await check(`${student.id}/stale.png`), false); assert.equal(await check(photo, randomUUID()), false);
    await prisma.pipelineRound.update({ where: { id: first.id }, data: { anonymousReview: true } }); assert.equal(await check(), false);
    await prisma.pipelineRound.update({ where: { id: first.id }, data: { anonymousReview: false } });
    await prisma.clubMember.update({ where: { id: member.id }, data: { permissions: [] } }); await assert.rejects(check(), /denied/);
  });
});
