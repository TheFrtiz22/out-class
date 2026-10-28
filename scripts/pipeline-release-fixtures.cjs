// Additive, repeatable synthetic cohorts. No .env or hosted target is accepted.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), { randomUUID, createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { readConfig } = require('../tests/helpers/onboarding-e2e.cjs');
const { scaleFixture } = require('./pipeline-scale-fixture.cjs');
async function backupOwners(db, actor) {
  const clubs = await db.clubMember.findMany({ where: { userId: actor, isOwner: true }, select: { clubId: true } });
  for (const { clubId } of clubs) {
    if (!await db.clubMember.count({ where: { clubId, userId: { not: actor }, isOwner: true, status: 'ACTIVE' } })) {
      const backup = await db.clubMember.findFirstOrThrow({ where: { clubId, userId: { not: actor }, status: 'ACTIVE' } });
      await db.clubMember.update({ where: { id: backup.id }, data: { isOwner: true, accessRole: 'OWNER' } });
    }
  }
}
async function prepare() {
  const root = path.join(os.tmpdir(), 'outclass-onboarding-e2e');
  const config = readConfig(path.join(root, 'config.json'));
  const file = path.join(root, 'navigation-fixture.json');
  const original = JSON.parse(fs.readFileSync(file));
  const manifest = path.join(root, 'pipeline-release-fixtures.json');
  if (fs.existsSync(manifest)) {
    const existing = JSON.parse(fs.readFileSync(manifest));
    assert.deepEqual(existing.sizes, [1, 100, 1000, 5000]);
    const db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
    try { await backupOwners(db, original.userId); for (const size of [1,1000,5000]) { const cohort=JSON.parse(fs.readFileSync(path.join(root,'pipeline-release-'+size+'.json'))); await db.club.update({where:{id:cohort.clubIds[0]},data:{name:'Navigation Audit Club 1'}}); } } finally { await db.$disconnect(); }
    return existing;
  }
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL });
  try {
    const template = original.clubIds[0];
    assert.equal(await db.application.count({ where: { clubId: template } }), 100);
    const members = await db.clubMember.findMany({ where: { clubId: template } });
    assert.equal(members.length, 61);
    const students = await db.application.findMany({ where: { clubId: template }, select: { studentId: true }, orderBy: { student: { studentProfile: { lastName: 'asc' } } } });
    const files = [];
    for (const size of [1, 100, 1000, 5000]) {
      let clubId = template;
      if (size !== 100) {
        clubId = randomUUID();
        // New IDs instead of deleting submitted reviews or disabling triggers.
        await db.$transaction(async tx => {
          await tx.club.create({ data: { id: clubId, slug: 'repair-' + clubId, name: 'Navigation Audit Club 1', tagline: 'Synthetic local fixture', description: 'Disposable release validation', claimedAt: new Date(), category: 'Academic', color: '#234567' } });
          await tx.clubMember.createMany({ data: members.map(({ id, createdAt, updatedAt, clubId: oldClub, ...member }) => ({ ...member, id: randomUUID(), clubId })) });
          const applied = await tx.pipelineRound.create({ data: { clubId, name: 'Applied', order: 0, type: 'APPLICATION_REVIEW' } });
          await tx.pipelineRound.create({ data: { clubId, name: 'Interview', order: 1, type: 'INTERVIEW' } });
          await tx.application.createMany({ data: students.slice(0, Math.min(100, size)).map(student => ({ id: randomUUID(), clubId, studentId: student.studentId, roundId: applied.id, status: 'SUBMITTED', submittedAt: new Date('2026-10-01T12:00:00Z') })) });
          await tx.meeting.create({ data: { clubId, title: 'Audit Weekly Meeting', date: new Date(Date.now() + 604800000), location: 'Synthetic room', audience: 'MEMBERS', isPublic: false } });
        });
      }
      const fixture = { ...original, clubIds: [clubId, ...original.clubIds.filter(id => id !== clubId)] };
      fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
      // Marker is diagnostic only; row identities/answers determine enrichment.
      fs.writeFileSync(path.join(root, 'phase3-enriched-count.json'), '{"count":0}', { mode: 0o600 });
      await scaleFixture(size);
      const enriched = JSON.parse(fs.readFileSync(file));
      assert.equal(await db.application.count({ where: { clubId } }), size);
      assert.equal(await db.pipelineRound.count({ where: { clubId } }), 2);
      assert.equal(await db.clubMember.count({ where: { clubId } }), 61);
      assert.equal(await db.applicationAnswer.count({ where: { application: { clubId } } }), size * 3);
      assert.equal(await db.evaluation.count({ where: { application: { clubId } } }), size * 2);
      const output = path.join(root, 'pipeline-release-' + size + '.json');
      fs.writeFileSync(output, JSON.stringify(enriched), { mode: 0o600 });
      files.push({ size, file: path.basename(output), sha256: createHash('sha256').update(fs.readFileSync(output)).digest('hex'), counts: enriched.counts });
    }
    await backupOwners(db, original.userId);
    const result = { secondaryOwner: true, sizes: [1, 100, 1000, 5000], files, additive: true, bookings: false, ballots: false };
    fs.writeFileSync(manifest, JSON.stringify(result, null, 2), { mode: 0o600 });
    fs.copyFileSync(path.join(root, 'pipeline-release-100.json'), file);
    return result;
  } finally { await db.$disconnect(); }
}
module.exports = { prepare };
if (require.main === module) prepare().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.name + ': ' + error.message); process.exitCode = 1; });
