const {unwrapActions,refused}=require('./helpers/action-result.cjs');
// Re-application after rejection and active-cycle assignment on isolated native
// PostgreSQL: real Prisma, transactions, locks and the partial unique index.
// Only request authentication is synthetic. Run: node scripts/run-contention-benchmark.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.OUTCLASS_CONTENTION_TEST_DATABASE_URL;

function loader(mocks) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name), mod, mod.exports);
    return mod.exports;
  }
  return load;
}
const guard = app => createHash('sha256').update(JSON.stringify([app.id, app.roundId, app.status, app.decisionVersion, app.decisionStateRevision])).digest('hex');

test('students can re-apply after rejection in the club\'s next active cycle', { skip: !databaseUrl, timeout: 240000 }, async t => {
  const url = new URL(databaseUrl);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '58455'); assert.equal(url.pathname, '/outclass_contention_test');
  const operator = new PrismaClient({ datasourceUrl: databaseUrl });
  const base = new PrismaClient({ datasourceUrl: databaseUrl.replace('fixture_superuser@', 'outclass_production_app@') });
  t.after(async () => { await base.$disconnect(); await operator.$disconnect(); });
  class Client { constructor() { return base; } }
  const request = new AsyncLocalStorage();
  const mocks = {
    '@prisma/client': { ...require('@prisma/client'), PrismaClient: Client },
    'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }) },
    'next/cache': { revalidatePath() {}, revalidateTag() {}, unstable_cache: fn => fn },
    '@/utils/auth': {
      requireAuth: async () => ({ user: request.getStore() }),
      requireClubPermission: async () => ({ user: request.getStore(), membership: {} }),
    },
  };
  const load = loader(mocks);
  const applications = unwrapActions(load('actions/applications.ts')), directory = load('actions/club-directory.ts'), recruitment = load('actions/recruitment-management.ts');

  async function clubWith(cycles) {
    const club = await operator.club.create({ data: { slug: `reapply-${randomUUID()}`, name: 'Reapply Club', tagline: '', description: '', color: '#142d4e', category: 'Academic', applicationOpen: true } });
    const round = await operator.pipelineRound.create({ data: { clubId: club.id, name: 'Applied', order: 0 } });
    const question = await operator.applicationQuestion.create({ data: { clubId: club.id, prompt: 'Why?', type: 'ESSAY', required: true, order: 0 } });
    const created = [];
    for (const name of cycles) created.push(await operator.recruitmentCycle.create({ data: { clubId: club.id, name } }));
    return { club, round, question, cycles: created, input: text => ({ clubId: club.id, answers: [{ questionId: question.id, response: text }] }) };
  }
  async function student() {
    const user = await operator.user.create({ data: { email: `${randomUUID()}@virginia.edu` } });
    await operator.studentProfile.create({ data: { userId: user.id, firstName: 'Re', lastName: 'Applicant', computingId: randomUUID(), major: 'Economics', gradYear: 2028 } });
    return user;
  }
  const as = (user, fn) => request.run(user, fn);

  await t.test('submission joins the single active cycle; same-cycle re-application is blocked', async () => {
    const f = await clubWith(['Fall 2026']), user = await student();
    const { applicationId } = await as(user, () => applications.submitApplication(f.input('First try')));
    assert.equal((await operator.application.findUniqueOrThrow({ where: { id: applicationId } })).recruitmentCycleId, f.cycles[0].id);
    await operator.application.update({ where: { id: applicationId }, data: { status: 'REJECTED' } });
    assert.deepEqual(await as(user, () => directory.startClubApplication(f.club.id)), { applicationId: null, unavailable: "You can apply to this club again in its next recruitment cycle." });
    await refused(as(user, () => applications.saveApplicationDraft(f.input('Too soon'))), /next recruitment cycle/);
    assert.equal(await operator.application.count({ where: { studentId: user.id, clubId: f.club.id } }), 1);
  });

  await t.test('a new cycle allows a new application; rejected history is untouched and start is idempotent', async () => {
    const f = await clubWith(['Fall 2026']), user = await student();
    const first = await as(user, () => applications.submitApplication(f.input('Fall answer')));
    await operator.application.update({ where: { id: first.applicationId }, data: { status: 'REJECTED' } });
    await operator.recruitmentCycle.update({ where: { id: f.cycles[0].id }, data: { archivedAt: new Date() } });
    const spring = await operator.recruitmentCycle.create({ data: { clubId: f.club.id, name: 'Spring 2027' } });
    const started = await as(user, () => directory.startClubApplication(f.club.id));
    assert.ok(started.applicationId && started.applicationId !== first.applicationId);
    assert.deepEqual(await as(user, () => directory.startClubApplication(f.club.id)), started, 'starting again returns the same new application');
    await as(user, () => applications.saveApplicationDraft(f.input('Spring draft')));
    await as(user, () => applications.submitApplication(f.input('Spring answer')));
    const rows = await operator.application.findMany({ where: { studentId: user.id, clubId: f.club.id }, include: { answers: true }, orderBy: { submittedAt: 'asc' } });
    assert.deepEqual(rows.map(r => [r.status, r.recruitmentCycleId, r.answers[0].response]), [['REJECTED', f.cycles[0].id, 'Fall answer'], ['SUBMITTED', spring.id, 'Spring answer']]);
    await refused(as(user, () => applications.saveApplicationDraft(f.input('Overwrite'))), /already been submitted/);
  });

  await t.test('legacy rejections without a cycle are judged by when they were submitted', async () => {
    const f = await clubWith(['Spring 2027']), before = await student(), after = await student();
    const cycleStart = f.cycles[0].createdAt;
    for (const [user, submittedAt] of [[before, new Date(+cycleStart - 86400000)], [after, new Date(+cycleStart + 60000)]])
      await operator.application.create({ data: { studentId: user.id, clubId: f.club.id, roundId: f.round.id, status: 'REJECTED', submittedAt } });
    assert.ok((await as(before, () => directory.startClubApplication(f.club.id))).applicationId, 'rejected before this cycle began: may re-apply');
    assert.equal((await as(after, () => directory.startClubApplication(f.club.id))).applicationId, null, 'rejected during this cycle: must wait');
  });

  await t.test('with no or several active cycles, nothing is auto-assigned and re-application waits for a cycle', async () => {
    const none = await clubWith([]), several = await clubWith(['A', 'B']), user = await student();
    for (const f of [none, several]) {
      const { applicationId } = await as(user, () => applications.submitApplication(f.input('No cycle')));
      assert.equal((await operator.application.findUniqueOrThrow({ where: { id: applicationId } })).recruitmentCycleId, null);
      await operator.application.update({ where: { id: applicationId }, data: { status: 'REJECTED' } });
      assert.match((await as(user, () => directory.startClubApplication(f.club.id))).unavailable, /next recruitment cycle/);
    }
  });

  await t.test('the database allows only one non-rejected application per student and club', async () => {
    const f = await clubWith(['Fall 2026']), user = await student();
    await operator.application.create({ data: { studentId: user.id, clubId: f.club.id, roundId: f.round.id, status: 'REJECTED' } });
    await operator.application.create({ data: { studentId: user.id, clubId: f.club.id, roundId: f.round.id, status: 'REJECTED' } });
    await operator.application.create({ data: { studentId: user.id, clubId: f.club.id, roundId: f.round.id, status: 'DRAFTING' } });
    await assert.rejects(operator.application.create({ data: { studentId: user.id, clubId: f.club.id, roundId: f.round.id, status: 'SUBMITTED' } }), e => e.code === 'P2002');
  });

  await t.test('a leader cannot reopen a rejection once the student has re-applied', async () => {
    const f = await clubWith(['Fall 2026']), user = await student();
    const leader = await operator.user.create({ data: { email: `${randomUUID()}@virginia.edu` } });
    await operator.clubMember.create({ data: { userId: leader.id, clubId: f.club.id, isOwner: true, accessRole: 'OWNER' } });
    const old = await operator.application.create({ data: { studentId: user.id, clubId: f.club.id, roundId: f.round.id, status: 'REJECTED', submittedAt: new Date(+f.cycles[0].createdAt - 86400000) } });
    await as(user, () => directory.startClubApplication(f.club.id));
    await assert.rejects(as(leader, () => recruitment.reconsiderRejectedApplication({ clubId: f.club.id, applicationId: old.id, expectedGuard: guard(old), reason: 'Reconsidering after review.' })), /has re-applied/);
    assert.equal((await operator.application.findUniqueOrThrow({ where: { id: old.id } })).status, 'REJECTED');
  });
});
