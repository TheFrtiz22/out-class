const {unwrapActions,refused}=require('./helpers/action-result.cjs');
// Starting the next recruitment cycle from the last one on isolated native
// PostgreSQL: real Prisma, the club row lock, unique constraints and rollback.
// Only request authentication is synthetic. Run: node scripts/run-disposable-postgres.cjs security
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;

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
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.pathname, '/outclass_security_test');
  const operator = new PrismaClient({ datasourceUrl: databaseUrl });
  const runtime = new URL(databaseUrl); runtime.username = 'outclass_production_app';
  const base = new PrismaClient({ datasourceUrl: runtime.toString() });
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
  const rawRecruitment = load('actions/recruitment-management.ts'), recruitment = unwrapActions(rawRecruitment), offerActions = unwrapActions(load('actions/recruitment-offers.ts')), offers = load('utils/recruitment-offers.ts'), communications = load('utils/decision-communications.ts');
  const as = (user, fn) => request.run(user, fn);
  const counts = async (tables, clubIds) => Object.fromEntries(await Promise.all(tables.map(async table => {
    const where = ['Application', 'ApplicantObservation', 'InterviewRoom', 'InterviewSlot', 'VotingSession', 'DecisionLetter', 'ClubInvitation', 'ApplicationQuestion', 'PipelineRound', 'VotingRuleDefault'].includes(table) ? `WHERE "clubId" = ANY($1::text[])` : '';
    const rows = where ? await operator.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}" ${where}`, clubIds) : await operator.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}"`);
    return [table, rows[0].n];
  })));

  async function fixture({ letter = true } = {}) {
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
    const app = await operator.application.create({ data: { studentId: student.id, clubId: club.id, roundId: applied.id, recruitmentCycleId: fall.id, status: 'ACCEPTED', decisionVersion: 1, submittedAt: past } });
    await operator.applicationAnswer.create({ data: { applicationId: app.id, questionId: question.id, response: 'Fall answer' } });
    if (letter) await operator.decisionLetter.create({ data: { applicationId: app.id, clubId: club.id, version: 1, decision: 'ACCEPTED', content: { body: 'Welcome' } } });
    return { club, other, fall, otherFall, leader, reviewer, student, app, round: applied };
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
  await t.test('an OPEN voting session or a waitlisted application in the source refuses with nothing written', async () => {
    const f = await fixture();
    const session = await operator.votingSession.create({ data: { clubId: f.club.id, roundId: f.round.id, cycleId: f.fall.id, state: 'OPEN', targetSize: 1, createdBy: f.leader.id } });
    await assert.rejects(as(f.leader, () => recruitment.startRecruitmentCycleFromPrevious(input(f))), /1 voting session in progress/);
    await assert.rejects(as(f.leader, () => recruitment.saveRecruitmentCycle({ id: f.fall.id, clubId: f.club.id, name: 'Fall 2026', archived: true })), /voting session in progress/);
    await operator.votingSession.update({ where: { id: session.id }, data: { state: 'COMPLETED', publishedAt: new Date() } });
    const waiting = await operator.user.create({ data: { email: `${randomUUID()}@virginia.edu` } });
    await operator.application.create({ data: { studentId: waiting.id, clubId: f.club.id, roundId: f.round.id, recruitmentCycleId: f.fall.id, status: 'WAITLISTED', submittedAt: new Date() } });
    await assert.rejects(as(f.leader, () => recruitment.startRecruitmentCycleFromPrevious(input(f))), /1 waitlisted application\./);
    // The plain Archive button applies the same rule, returned (not thrown) so production shows the reason.
    await refused(as(f.leader, () => rawRecruitment.saveRecruitmentCycle({ id: f.fall.id, clubId: f.club.id, name: 'Fall 2026', archived: true })), /1 waitlisted application\. Record final decisions before archiving this cycle\./);
    assert.equal(await operator.auditLog.count({ where: { clubId: f.club.id, action: 'recruitment.cycle.saved' } }), 0);
    assert.equal(await operator.recruitmentCycle.count({ where: { clubId: f.club.id } }), 1);
    assert.equal((await operator.recruitmentCycle.findUniqueOrThrow({ where: { id: f.fall.id } })).archivedAt, null);
    assert.equal(await operator.auditLog.count({ where: { clubId: f.club.id, action: 'recruitment.cycle.started_from_previous' } }), 0);
  });

  await t.test('replaying an id with a different name is refused', async () => {
    const f = await fixture(), d = input(f);
    await as(f.leader, () => recruitment.startRecruitmentCycleFromPrevious(d));
    await assert.rejects(as(f.leader, () => recruitment.startRecruitmentCycleFromPrevious({ ...d, name: 'Spring 2027 renamed' })), /Cycle unavailable/);
    assert.equal((await operator.recruitmentCycle.findUniqueOrThrow({ where: { id: d.id } })).name, 'Spring 2027');
  });

  await t.test('an accepted application from the archived cycle can still be published and accepted', async () => {
    const f = await fixture({ letter: false });
    await as(f.leader, () => recruitment.startRecruitmentCycleFromPrevious(input(f)));
    assert.ok((await operator.recruitmentCycle.findUniqueOrThrow({ where: { id: f.fall.id } })).archivedAt);
    // The fixture's decision is recorded but its communication deferred, as after a voting room finalizes.
    await base.$transaction(async tx => {
      await offers.publishRecruitmentDecision(tx, { applicationId: f.app.id, clubId: f.club.id, status: 'ACCEPTED' }, f.leader.id);
      await communications.publishDecisionCommunication(tx, f.app.id, f.leader.id);
    });
    assert.equal(await operator.decisionLetter.count({ where: { applicationId: f.app.id } }), 1);
    await as(f.student, () => offerActions.respondToOffer(f.app.id, 'ACCEPT'));
    assert.equal((await operator.clubInvitation.findUniqueOrThrow({ where: { applicationId: f.app.id } })).status, 'ACCEPTED');
    assert.equal((await operator.clubMember.findUniqueOrThrow({ where: { userId_clubId: { userId: f.student.id, clubId: f.club.id } } })).status, 'ACTIVE');
  });
});
