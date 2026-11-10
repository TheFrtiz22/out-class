// Starting the next recruitment cycle from the last one on isolated native
// PostgreSQL: real Prisma, the club row lock, unique constraints and rollback.
// Only request authentication is synthetic. Run: node scripts/run-contention-benchmark.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
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

// Applicant-side and dated operational tables; none may gain rows when a cycle starts.
const applicantTables = ['Application', 'ApplicationAnswer', 'Evaluation', 'ApplicantObservation', 'InterviewRecord', 'InterviewBooking', 'InterviewSlot', 'InterviewRoom', 'VotingSession', 'VotingBallot', 'VotingBallotRule', 'DecisionLetter', 'ClubInvitation', 'RecruitingRuleFlag'];
const configTables = ['ApplicationQuestion', 'PipelineRound', 'RecruitingRule', 'VotingRuleDefault'];

test('starting the next cycle from the last one on native PostgreSQL', { skip: !databaseUrl, timeout: 240000 }, async t => {
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
  const recruitment = loader(mocks)('actions/recruitment-management.ts');
  const as = (user, fn) => request.run(user, fn);
  const counts = async (tables, clubIds) => Object.fromEntries(await Promise.all(tables.map(async table => {
    const where = ['Application', 'ApplicantObservation', 'InterviewRoom', 'InterviewSlot', 'VotingSession', 'DecisionLetter', 'ClubInvitation', 'ApplicationQuestion', 'PipelineRound', 'VotingRuleDefault'].includes(table) ? `WHERE "clubId" = ANY($1::text[])` : '';
    const rows = where ? await operator.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}" ${where}`, clubIds) : await operator.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}"`);
    return [table, rows[0].n];
  })));

  async function fixture() {
    const past = new Date(Date.now() - 30 * 86400000);
    const club = await operator.club.create({ data: { slug: `cycle-start-${randomUUID()}`, name: 'Cycle Club', tagline: '', description: '', color: '#142d4e', category: 'Academic', applicationOpen: true, applicationDeadline: past, decisionLetterTemplates: { ACCEPTED: { subject: 'Welcome' } } } });
    const other = await operator.club.create({ data: { slug: `cycle-other-${randomUUID()}`, name: 'Other Club', tagline: '', description: '', color: '#142d4e', category: 'Academic' } });
    const applied = await operator.pipelineRound.create({ data: { clubId: club.id, name: 'Applied', order: 0 } });
    await operator.pipelineRound.create({ data: { clubId: club.id, name: 'Interview', order: 1, type: 'INTERVIEW', interviewKit: [{ prompt: 'Tell us about a project' }] } });
    await operator.recruitingRule.create({ data: { roundId: applied.id, minGpa: 3 } });
    const question = await operator.applicationQuestion.create({ data: { clubId: club.id, prompt: 'Why?', type: 'ESSAY', required: true, order: 0 } });
    const fall = await operator.recruitmentCycle.create({ data: { clubId: club.id, name: 'Fall 2026' } });
    const otherFall = await operator.recruitmentCycle.create({ data: { clubId: other.id, name: 'Fall 2026' } });
    const leader = await operator.user.create({ data: { email: `${randomUUID()}@virginia.edu` } });
    const reviewer = await operator.user.create({ data: { email: `${randomUUID()}@virginia.edu` } });
    const student = await operator.user.create({ data: { email: `${randomUUID()}@virginia.edu` } });
    await operator.clubMember.create({ data: { userId: leader.id, clubId: club.id, isOwner: true, accessRole: 'OWNER' } });
    await operator.clubMember.create({ data: { userId: reviewer.id, clubId: club.id, permissions: ['applications.review', 'applicants.identify'] } });
    await operator.votingRuleDefault.create({ data: { clubId: club.id, rules: { threshold: 0.5 }, updatedBy: leader.id } });
    const app = await operator.application.create({ data: { studentId: student.id, clubId: club.id, roundId: applied.id, recruitmentCycleId: fall.id, status: 'ACCEPTED', submittedAt: past } });
    await operator.applicationAnswer.create({ data: { applicationId: app.id, questionId: question.id, response: 'Fall answer' } });
    await operator.decisionLetter.create({ data: { applicationId: app.id, clubId: club.id, version: 1, decision: 'ACCEPTED', content: { body: 'Welcome' } } });
    return { club, other, fall, otherFall, leader, reviewer, app };
  }
  const input = (f, extra = {}) => ({ id: randomUUID(), clubId: f.club.id, sourceCycleId: f.fall.id, name: 'Spring 2027', ...extra });

  await t.test('keeps configuration, archives the source, unsets a passed deadline and copies zero applicant rows', async () => {
    const f = await fixture(), scope = [f.club.id, f.other.id];
    const applicantBefore = await counts(applicantTables, scope), configBefore = await counts(configTables, scope);
    const d = input(f);
    const result = await as(f.leader, () => recruitment.startRecruitmentCycleFromPrevious(d));
    assert.deepEqual(result.carriedForward, { questions: 1, rounds: 2, interviewKits: 1, screeningRules: 1, votingRuleDefaults: 1, decisionLetterTemplates: true });
    assert.deepEqual(await counts(applicantTables, scope), applicantBefore, 'no applicant-side rows created or removed');
    assert.deepEqual(await counts(configTables, scope), configBefore, 'configuration is kept in place, not duplicated');
    const cycles = await operator.recruitmentCycle.findMany({ where: { clubId: f.club.id }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(cycles.map(c => [c.name, !!c.archivedAt]), [['Fall 2026', true], ['Spring 2027', false]]);
    assert.equal((await operator.recruitmentCycle.findUniqueOrThrow({ where: { id: f.otherFall.id } })).archivedAt, null);
    const club = await operator.club.findUniqueOrThrow({ where: { id: f.club.id } });
    assert.equal(club.applicationDeadline, null);
    assert.equal((await operator.application.findUniqueOrThrow({ where: { id: f.app.id } })).recruitmentCycleId, f.fall.id);
    const audit = await operator.auditLog.findMany({ where: { clubId: f.club.id, targetId: d.id } });
    assert.equal(audit.length, 1); assert.equal(audit[0].action, 'recruitment.cycle.started_from_previous'); assert.equal(audit[0].details.sourceCycleId, f.fall.id);
  });

  await t.test('concurrent double submit creates one cycle', async () => {
    const f = await fixture(), d = input(f);
    const results = await Promise.all([as(f.leader, () => recruitment.startRecruitmentCycleFromPrevious(d)), as(f.leader, () => recruitment.startRecruitmentCycleFromPrevious(d))]);
    assert.deepEqual(results.map(r => r.replayed).sort(), [false, true]);
    assert.equal(await operator.recruitmentCycle.count({ where: { clubId: f.club.id, name: 'Spring 2027' } }), 1);
    assert.equal(await operator.auditLog.count({ where: { clubId: f.club.id, action: 'recruitment.cycle.started_from_previous' } }), 1);
    await assert.rejects(as(f.leader, () => recruitment.startRecruitmentCycleFromPrevious(input(f, { name: 'Spring 2027 again' }))), /other open cycles/);
  });

  await t.test('cross-club source and a member without recruitment.manage are denied with no writes', async () => {
    const f = await fixture();
    await assert.rejects(as(f.leader, () => recruitment.startRecruitmentCycleFromPrevious(input(f, { sourceCycleId: f.otherFall.id }))), /Cycle unavailable/);
    await assert.rejects(as(f.reviewer, () => recruitment.startRecruitmentCycleFromPrevious(input(f))), /Club access denied/);
    assert.equal(await operator.recruitmentCycle.count({ where: { clubId: f.club.id } }), 1);
    assert.equal((await operator.recruitmentCycle.findUniqueOrThrow({ where: { id: f.fall.id } })).archivedAt, null);
    assert.notEqual((await operator.club.findUniqueOrThrow({ where: { id: f.club.id } })).applicationDeadline, null);
  });
});
