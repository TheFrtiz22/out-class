// Actual Prisma engine + PostgreSQL + production support query extension.
// Only request/provider authentication is synthetic; all transactional authority,
// audit writes, locks, triggers, rollback and concurrency use real connections.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { PrismaClient } = require('@prisma/client');
const databaseUrl = process.env.OUTCLASS_TRANSACTION_TEST_DATABASE_URL;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function loader(mocks, overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const text = overrides[path.relative(process.cwd(), file)] ?? fs.readFileSync(file, 'utf8');
    const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('.') ? load(path.resolve(path.dirname(file), name) + '.ts') : require(name), mod, mod.exports);
    return mod.exports;
  }
  return load;
}
test('decision/invitation transaction repair on isolated native PostgreSQL', { skip: !databaseUrl, timeout: 240000 }, async t => {
  const url = new URL(databaseUrl);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '58452'); assert.equal(url.username, 'fixture_superuser'); assert.equal(url.pathname, '/outclass_recruitment_test');
  const operator = new PrismaClient({ datasourceUrl: databaseUrl });
  const base = new PrismaClient({ datasourceUrl: databaseUrl.replace('fixture_superuser@', 'outclass_production_app@'), log: [{ emit: 'event', level: 'query' }] });
  t.after(async () => { await base.$disconnect(); await operator.$disconnect(); });
  const [role] = await base.$queryRaw`SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
  assert.deepEqual(role, { current_user: 'outclass_production_app', rolsuper: false, rolbypassrls: false });
  const request = new AsyncLocalStorage(); let providerCalls = 0, providerDelay = 0, queryCount = 0, sqlMs = 0;
  let transactionStart, transactionMs, policyDelay = 0, policyCalls = 0;
  base.$on('query', e => {
    queryCount++; sqlMs += e.duration;
    if (e.query === 'BEGIN') transactionStart = Date.now();
    if ((e.query === 'COMMIT' || e.query === 'ROLLBACK') && transactionStart) transactionMs = Date.now() - transactionStart;
  });
  const admin = await operator.user.create({ data: { email: `${randomUUID()}@virginia.edu` } });
  await operator.platformAdmin.create({ data: { userId: admin.id } });
  const previousAllowlist = process.env.OUTCLASS_PLATFORM_ADMIN_IDS; process.env.OUTCLASS_PLATFORM_ADMIN_IDS = admin.id;
  t.after(() => { if (previousAllowlist === undefined) delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS; else process.env.OUTCLASS_PLATFORM_ADMIN_IDS = previousAllowlist; });
  const state = { afterAuth: null, afterPolicy: null, afterAudit: null, failAction: null, failAudit: false };
  await operator.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS storage');
  await operator.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS storage.objects(bucket_id text NOT NULL,name text NOT NULL,PRIMARY KEY(bucket_id,name))');
  await operator.$executeRawUnsafe('GRANT USAGE ON SCHEMA storage TO outclass_production_app');
  await operator.$executeRawUnsafe('GRANT SELECT ON storage.objects TO outclass_production_app');
  // Inject domain/audit failures through an actual extension; no in-memory ORM.
  const instrumented = base.$extends({ query: { auditLog: { async create({ args, query }) {
    if (state.failAudit || args.data.action === state.failAction) throw Error('Injected audit failure');
    if (state.afterAudit) await state.afterAudit(args.data);
    return query(args);
  } } } });
  class Client { constructor() { return instrumented; } }
  const mocks = {
    '@prisma/client': { ...require('@prisma/client'), PrismaClient: Client },
    'next/headers': { cookies: async () => ({ has: () => !!request.getStore()?.session, get: () => request.getStore()?.session ? { value: request.getStore().token } : undefined }) },
    'next/cache': { revalidatePath() {}, revalidateTag() {} },
    'server-only': {},
    '@/utils/verified-email-policy': { ...loader({})('utils/verified-email-policy.ts'), requireVerifiedEmailPolicy: async () => { policyCalls++; await sleep(policyDelay); if (state.afterPolicy) await state.afterPolicy(); } },
    '@/utils/platform-admin': { requirePlatformAdmin: async () => { providerCalls++; await sleep(providerDelay); return admin; } },
    '@/utils/admin-elevation': { requireAdminElevation: async () => request.getStore().elevation },
    '@/utils/auth': {
      requireAuth: async () => {
        const user = request.getStore().user;
        return { user, supabaseUser: { id: user.id, email: user.email, confirmation_sent_at: '2026-09-01', email_confirmed_at: '2026-10-01', ...request.getStore().proof } };
      },
      requireClubPermission: async (clubId, caps) => {
        const user = request.getStore().user;
        const membership = await base.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
        assert.ok(membership && membership.status === 'ACTIVE' && (membership.isOwner || caps.every(c => membership.permissions.includes(c))), 'Permission denied');
        if (state.afterAuth) await state.afterAuth();
        return { user, membership };
      },
    },
  };
  function load(overrides) {
    const previous = global.outclassPrismaBase; delete global.outclassPrismaBase;
    const api = loader(mocks, overrides); api('utils/prisma.ts');
    if (previous === undefined) delete global.outclassPrismaBase; else global.outclassPrismaBase = previous;
    return api;
  }
  const api = load();
  async function fixture(impersonated = true) {
    const user = await operator.user.create({ data: { email: `${randomUUID()}@virginia.edu` } });
    const student = await operator.user.create({ data: { email: `${randomUUID()}@virginia.edu` } });
    const club = await operator.club.create({ data: { slug: randomUUID(), name: 'Transaction fixture', tagline: '', description: '', category: 'Other', color: '#142d45' } });
    const member = await operator.clubMember.create({ data: { userId: user.id, clubId: club.id, isOwner: true } });
    const round = await operator.pipelineRound.create({ data: { clubId: club.id, name: 'Review', order: 0, type: 'APPLICATION_REVIEW' } });
    const app = await operator.application.create({ data: { studentId: student.id, clubId: club.id, roundId: round.id, status: 'IN_REVIEW' } });
    const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    const session = impersonated ? await operator.platformViewSession.create({ data: { actorId: admin.id, targetUserId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'), mode: 'IMPERSONATION', reason: 'Isolated transaction regression', expiresAt: new Date(Date.now() + 600000) } }) : null;
    const authId = randomUUID();
    await operator.$executeRaw`INSERT INTO auth.sessions(id,user_id) VALUES (${authId}::uuid,${admin.id}::uuid)`;
    const now = new Date();
    const elevation = await operator.adminElevation.create({ data: { actorId: admin.id, tokenHash: createHash('sha256').update(randomUUID()).digest('hex'), authSessionId: authId, factorId: randomUUID(), passwordVerifiedAt: now, mfaVerifiedAt: now, expiresAt: new Date(Date.now() + 600000) } });
    const context = { user, token, session, elevation };
    return { user, student, club, member, round, app, context, run: fn => request.run(context, fn) };
  }
  const direct = (f, status = 'WAITLISTED', use = api) => f.run(() => use('actions/crm.ts').setApplicationStatus({ clubId: f.club.id, applicationId: f.app.id, status }));
  async function voteFixture(f, applications = [f.app]) {
    const s = await operator.votingSession.create({ data: { clubId: f.club.id, roundId: f.round.id, createdBy: f.user.id, targetSize: 1, state: 'COMPLETED', currentPass: 1, candidates: { create: applications.map((a, position) => ({ applicationId: a.id, position, expectedStatus: 'IN_REVIEW' })) }, participants: { create: { memberId: f.member.id } } } });
    await operator.votingPass.create({ data: { sessionId: s.id, number: 1, state: 'COMPLETED', candidates: { create: applications.map((a, position) => ({ applicationId: a.id, position, override: 'PASS', overrideBy: f.user.id, overrideAt: new Date() })) } } });
    return () => f.run(() => api('actions/voting.ts').commandVotingSession({ clubId: f.club.id, sessionId: s.id, revision: 0, action: 'PUBLISH', applicationIds: applications.map(a => a.id) }));
  }
  async function invitation(f, use = api) {
    const config = await operator.schoolIdentifierType.findFirstOrThrow({ where: { schoolId: f.club.schoolId, verification: 'EMAIL_LOCAL_PART' } });
    return f.run(() => use('actions/organization-members.ts').inviteOrganizationMember({ clubId: f.club.id, identifierTypeId: config.id, identifier: f.student.email.split('@')[0], invitedName: 'Synthetic recipient', invitedYear: null, requestedRole: 'MEMBER' }));
  }
  async function assertRollback(f) {
    const app = await base.application.findUniqueOrThrow({ where: { id: f.app.id } });
    assert.equal(app.status, 'IN_REVIEW'); assert.equal(app.decisionVersion, 0);
    for (const model of ['decisionLetter', 'userNotification', 'notificationEmailOutbox', 'clubInvitation']) {
      const count = model === 'notificationEmailOutbox' ? await base[model].count({ where: { notification: { clubId: f.club.id } } }) : await base[model].count({ where: { clubId: f.club.id } });
      assert.equal(count, 0, model);
    }
    assert.equal(await base.auditLog.count({ where: { clubId: f.club.id } }), 0, 'Domain events rolled back');
  }
  async function assertPublished(f, status) {
    const app = await base.application.findUniqueOrThrow({ where: { id: f.app.id } });
    assert.equal(app.status, status); assert.equal(app.decisionVersion, 1);
    assert.equal(await base.decisionLetter.count({ where: { applicationId: app.id } }), 1);
    assert.equal(await base.userNotification.count({ where: { eventKey: `decision:${app.id}:1` } }), 1);
    assert.equal(await base.notificationEmailOutbox.count({ where: { notification: { eventKey: `decision:${app.id}:1` } } }), 1);
    const logs = await base.auditLog.findMany({ where: { clubId: f.club.id } });
    assert.ok(logs.length >= 4);
    for (const action of ['recruitment.letter.published', 'recruitment.notification.created', 'recruitment.email.queued']) assert.equal(logs.filter(row => row.action === action).length, 1);
    for (const row of logs) {
      assert.equal(row.actorId, f.context.session ? admin.id : f.user.id);
      assert.equal(row.effectiveUserId, f.context.session ? f.user.id : null);
      assert.equal(row.supportSessionId, f.context.session?.id ?? null);
    }
    assert.equal(await base.notificationEmailDelivery.count(), 0);
  }
  await t.test('serving-source reproduction: repeated provider waits exceed default 5s and roll back both paths', async () => {
    const serving = 'e50aabeffa76dde72840aeabc74e156e77d2d8f7';
    const overrides = Object.fromEntries(['actions/crm.ts', 'actions/club-onboarding.ts'].map(file => [file, execFileSync('git', ['show', `${serving}:${file}`], { encoding: 'utf8' })]));
    const legacy = load(overrides); providerDelay = 1800;
    for (const kind of ['decision', 'invitation']) {
      const f = await fixture(); const start = Date.now(), before = providerCalls;
      await assert.rejects(kind === 'decision' ? direct(f, 'WAITLISTED', legacy) : invitation(f, legacy), e => e.code === 'P2028');
      await assertRollback(f);
      t.diagnostic(`${kind}: elapsed=${Date.now() - start}ms provider resolutions=${providerCalls - before}; simulated Auth latency=1800ms/resolution, native default transaction=5000ms`);
    }
    providerDelay = 0;
  });
  await t.test('serving bulk domain audit is incompatible with support; individual events retain attribution', async () => {
    const file = 'utils/decision-communications.ts';
    const legacy = load({ [file]: execFileSync('git', ['show', `e50aabeffa76dde72840aeabc74e156e77d2d8f7:${file}`], { encoding: 'utf8' }) });
    const f = await fixture();
    await assert.rejects(direct(f, 'WAITLISTED', legacy), /unavailable during impersonation/); await assertRollback(f);
    await direct(f); await assertPublished(f, 'WAITLISTED');
  });
  for (const support of [false, true]) {
    await t.test(`direct all outcomes, retries/concurrency and attribution (support=${support})`, async () => {
      for (const status of ['ACCEPTED', 'WAITLISTED', 'REJECTED']) {
        const f = await fixture(support); const before = providerCalls, q = queryCount, duration = sqlMs, start = Date.now();
        await Promise.all([direct(f, status), direct(f, status)]); await direct(f, status);
        await assertPublished(f, status);
        t.diagnostic(`${status} support=${support}: three commands=${Date.now() - start}ms queries=${queryCount - q} PostgreSQL duration=${sqlMs - duration}ms provider resolutions=${providerCalls - before}`);
      }
    });
    await t.test(`voting publication, concurrent retry and attribution (support=${support})`, async () => {
      const f = await fixture(support), publish = await voteFixture(f);
      await Promise.all([publish(), publish()]); await publish(); await assertPublished(f, 'ACCEPTED');
    });
    await t.test(`no-email invitation creation and concurrent retry (support=${support})`, async () => {
      const f = await fixture(support), results = await Promise.all([invitation(f), invitation(f)]);
      assert.equal(results[0].id, results[1].id); assert.equal(results.filter(r => !r.reused).length, 1);
      assert.equal(await base.clubInvitation.count({ where: { clubId: f.club.id } }), 1);
      assert.equal(await base.invitationDelivery.count({ where: { invitation: { clubId: f.club.id } } }), 0);
      const audit = await base.auditLog.findFirstOrThrow({ where: { clubId: f.club.id, action: 'club.identity-invite.create' } });
      assert.equal(audit.actorId, support ? admin.id : f.user.id); assert.equal(audit.effectiveUserId, support ? f.user.id : null); assert.equal(audit.supportSessionId, f.context.session?.id ?? null);
    });
  }
  await t.test('slow provider resolution occurs before transaction; same latency no longer causes P2028', async () => {
    providerDelay = 1800;
    for (const kind of ['decision', 'invitation']) {
      const f = await fixture(), before = providerCalls, start = Date.now();
      if (kind === 'decision') { await direct(f); await assertPublished(f, 'WAITLISTED'); } else await invitation(f);
      assert.equal(providerCalls - before, 1);
      t.diagnostic(`repaired ${kind}: elapsed=${Date.now() - start}ms transaction=${transactionMs}ms; one pretransaction provider resolution`);
    }
    providerDelay = 0;
  });
  await t.test('direct/voting/invitation audit failure rolls back all domain data; durable support attempts remain', async () => {
    for (const kind of ['direct', 'voting', 'invitation']) {
      const f = await fixture(); const publish = kind === 'voting' ? await voteFixture(f) : null;
      state.failAction = kind === 'invitation' ? 'club.identity-invite.create' : 'recruitment.email.queued';
      await assert.rejects(kind === 'direct' ? direct(f) : kind === 'voting' ? publish() : invitation(f), /Injected audit failure/);
      state.failAction = null; await assertRollback(f);
      if (publish) assert.equal((await base.votingSession.findFirstOrThrow({ where: { clubId: f.club.id } })).publishedAt, null);
      assert.ok(await base.auditLog.count({ where: { supportSessionId: f.context.session.id, action: 'platform.impersonation.mutation-attempt' } }));
    }
    const f = await fixture(); state.failAudit = true; await assert.rejects(direct(f), /Injected audit failure/); state.failAudit = false; await assertRollback(f);
  });
  await t.test('permission revoked after request authorization and while waiting on Club lock denies direct/voting/invitation', async () => {
    for (const kind of ['direct', 'voting', 'invitation']) {
      const f = await fixture(false); const publish = kind === 'voting' ? await voteFixture(f) : null;
      await operator.clubMember.create({ data: { clubId: f.club.id, userId: admin.id, isOwner: true } });
      let locked, release; const lockReady = new Promise(r => locked = r), gate = new Promise(r => release = r);
      const blocker = operator.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${f.club.id} FOR UPDATE`; locked(); await gate; await tx.clubMember.update({ where: { id: f.member.id }, data: { isOwner: false, permissions: [] } }); }, { timeout: 10000 });
      await lockReady;
      const pending = kind === 'direct' ? direct(f) : kind === 'voting' ? publish() : invitation(f);
      await sleep(200); release(); await blocker;
      await assert.rejects(pending, /access denied|cannot grant/); await assertRollback(f);
    }
  });
  await t.test('cross-club publication, voting and invitation denied without writes', async () => {
    const f = await fixture(false), other = await fixture(false); await voteFixture(other);
    const votingSession = await base.votingSession.findFirstOrThrow({ where: { clubId: other.club.id } });
    await assert.rejects(f.run(() => api('actions/crm.ts').setApplicationStatus({ clubId: f.club.id, applicationId: other.app.id, status: 'ACCEPTED' })), /Application changed/);
    await assert.rejects(f.run(() => api('actions/voting.ts').commandVotingSession({ clubId: other.club.id, sessionId: votingSession.id, revision: 0, action: 'PUBLISH', applicationIds: [other.app.id] })), /Permission denied/);
    await assert.rejects(other.run(() => api('actions/club-onboarding.ts').createClubIdentityInvitation({ clubId: f.club.id, identifierTypeId: 'school-uva-computing-id', identifier: 'outsider', requestedRole: 'MEMBER' })), /cannot grant/);
    await assertRollback(f); await assertRollback(other);
  });
  await t.test('aged session-bound elevation allows support writes but cannot extend support expiry', async () => {
    const f = await fixture();
    const past = new Date(Date.now() - 3600000);
    await operator.adminElevation.update({ where: { id: f.context.elevation.id }, data: { createdAt: past, passwordVerifiedAt: past, mfaVerifiedAt: past, expiresAt: null } });
    f.context.elevation = await operator.adminElevation.findUniqueOrThrow({ where: { id: f.context.elevation.id } });
    await direct(f); await assertPublished(f, 'WAITLISTED');
    await operator.platformViewSession.update({ where: { id: f.context.session.id }, data: { createdAt: past, expiresAt: new Date(past.getTime()+1800000) } });
    await assert.rejects(f.run(() => api('utils/club-write-transaction.ts').clubWriteTransaction(async tx => {
      await tx.club.update({ where: { id: f.club.id }, data: { tagline: 'Must not publish' } });
    })), /Impersonation expired/);
    assert.equal((await operator.club.findUniqueOrThrow({ where: { id: f.club.id } })).tagline, '');
  });
  await t.test('session/elevation/grant/logout/target revocation between audited statements rolls back', async () => {
    const changes = [
      f => operator.platformViewSession.update({ where: { id: f.context.session.id }, data: { endedAt: new Date() } }),
      f => operator.adminElevation.update({ where: { id: f.context.elevation.id }, data: { revokedAt: new Date() } }),
      () => operator.platformAdmin.update({ where: { userId: admin.id }, data: { active: false } }),
      f => operator.$executeRaw`DELETE FROM auth.sessions WHERE id=${f.context.elevation.authSessionId}::uuid`,
      f => operator.user.update({ where: { id: f.user.id }, data: { disabledAt: new Date() } }),
    ];
    for (const change of changes) {
      const f = await fixture();
      await operator.clubMember.create({ data: { clubId: f.club.id, userId: admin.id, isOwner: true } });
      await assert.rejects(f.run(() => api('utils/club-write-transaction.ts').clubWriteTransaction(async tx => {
        await tx.application.update({ where: { id: f.app.id }, data: { status: 'WAITLISTED' } });
        await change(f); // final DB check must catch revocation even with no later ORM mutation
      })), /Impersonation expired/);
      await operator.platformAdmin.update({ where: { userId: admin.id }, data: { active: true } });
      await assertRollback(f);
    }
  });
  await t.test('simultaneous support scopes and normal requests cannot share identity or outlive their transaction', async () => {
    const fixtures = [await fixture(), await fixture(), await fixture(false)];
    await Promise.all(fixtures.map(f => direct(f)));
    for (const f of fixtures) await assertPublished(f, 'WAITLISTED');
    const audit = api('utils/support-audit.ts');
    assert.equal(audit.supportTransactionScope.getStore(), undefined);
    assert.equal(await audit.supportContext(), null);
    const before = providerCalls;
    await fixtures[0].run(() => audit.supportContext());
    assert.equal(providerCalls - before, 1, 'A later operation must resolve fresh provider authority');
  });
  await t.test('10s statement budget cancels slow SQL and rolls back business writes', async () => {
    const f = await fixture(false), start = Date.now();
    await assert.rejects(f.run(() => api('utils/club-write-transaction.ts').clubWriteTransaction(async tx => {
      await tx.application.update({ where: { id: f.app.id }, data: { status: 'WAITLISTED' } });
      await tx.$queryRaw`SELECT pg_sleep(11)`;
    })), e => e.code !== 'P2028' && /statement timeout/.test(e.message));
    assert.ok(Date.now() - start < 15000); await assertRollback(f);
    const [settings] = await base.$queryRaw`SELECT current_setting('lock_timeout') AS lock, current_setting('statement_timeout') AS statement`;
    assert.deepEqual(settings, { lock: '0', statement: '0' });
    t.diagnostic(`slow SQL cancelled after ${Date.now() - start}ms; transaction-local settings reset`);
  });
  await t.test('contended Club lock is observed and cancelled by 3s lock budget, not an expired Prisma transaction', async () => {
    const f = await fixture(false); let locked, release;
    const ready = new Promise(r => locked = r), gate = new Promise(r => release = r);
    const blocker = operator.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${f.club.id} FOR UPDATE`; locked(); await gate; }, { timeout: 10000 });
    await ready; const start = Date.now(); const outcome = direct(f).then(() => null, e => e);
    await sleep(250);
    const waiting = await operator.$queryRaw`SELECT wait_event_type FROM pg_stat_activity WHERE usename='outclass_production_app' AND wait_event_type='Lock'`;
    assert.ok(waiting.length);
    const error = await outcome; release(); await blocker;
    assert.notEqual(error.code, 'P2028'); assert.match(error.message, /lock timeout/); assert.ok(Date.now() - start < 5000); await assertRollback(f);
    t.diagnostic(`observed PostgreSQL Lock wait, cancelled after ${Date.now() - start}ms`);
  });
  const profile = (f, use = api, fields = {}) => f.run(() => use('actions/club-workspace.ts').updateClubSettings({ clubId: f.club.id, name: 'Published fixture', tagline: 'Updated', description: 'Private local test', ...fields }));
  await t.test('main-source profile publication reproduces P2028; bounded repair moves identical provider latency before acquisition', async () => {
    const main = load({ 'actions/club-workspace.ts': execFileSync('git', ['show', 'ce2c014:actions/club-workspace.ts'], { encoding: 'utf8' }) });
    providerDelay = 2700;
    const f = await fixture();
    await assert.rejects(profile(f, main), e => e.code === 'P2028');
    assert.equal((await base.club.findUniqueOrThrow({ where: { id: f.club.id } })).name, 'Transaction fixture');
    assert.equal(await base.auditLog.count({ where: { clubId: f.club.id } }), 0);
    const before = providerCalls, start = Date.now();
    await profile(f);
    assert.equal(providerCalls - before, 1);
    const audit = await base.auditLog.findFirstOrThrow({ where: { clubId: f.club.id, action: 'club.settings.update' } });
    assert.equal(audit.actorId, admin.id); assert.equal(audit.effectiveUserId, f.user.id); assert.equal(audit.supportSessionId, f.context.session.id);
    t.diagnostic(`profile simulated Auth=2700ms: elapsed=${Date.now()-start}ms, transaction=${transactionMs}ms; one pretransaction provider resolution`);
    providerDelay = 0;
  });
  for (const support of [false, true]) {
    await t.test(`profile publication retry, audit rollback and cross-club private image denial (support=${support})`, async () => {
      const f = await fixture(support);
      await Promise.all([profile(f), profile(f)]); await profile(f);
      assert.equal((await base.club.findUniqueOrThrow({ where: { id: f.club.id } })).name, 'Published fixture');
      state.failAction = 'club.settings.update';
      await assert.rejects(profile(f, api, { name: 'Must roll back' }), /Injected audit failure/); state.failAction = null;
      assert.equal((await base.club.findUniqueOrThrow({ where: { id: f.club.id } })).name, 'Published fixture');
      const object = `${f.club.id}/${randomUUID()}.webp`;
      await operator.$executeRaw`INSERT INTO storage.objects(bucket_id,name) VALUES ('club-assets',${object})`;
      await profile(f, api, { logoUrl: `club-assets/${object}` });
      assert.equal((await base.club.findUniqueOrThrow({where:{id:f.club.id}})).logoUrl,`club-assets/${object}`);
      await assert.rejects(profile(f,api,{logoUrl:`club-assets/${f.club.id}/${randomUUID()}.webp`}),/unavailable/);
      const other = await fixture(false);
      await assert.rejects(profile(f, api, { logoUrl: `club-assets/${other.club.id}/${randomUUID()}.webp` }), /ownership mismatch/);
      await assert.rejects(f.run(() => api('actions/club-workspace.ts').updateClubSettings({ clubId: other.club.id, name: 'Forbidden', tagline: '', description: '' })), /Permission denied/);
    });
    await t.test(`persisted voting draft reload, joining, ballots, retries and publication (support=${support})`, async () => {
      const f = await fixture(support), voting = api('actions/voting.ts');
      const id = await f.run(() => voting.createVotingSession({ clubId: f.club.id, roundId: f.round.id, applicationIds: [f.app.id], participantIds: [f.member.id], targetSize: 1, displayConfig: { version: 1, fields: ['name'] } }));
      let view = await f.run(() => voting.getVotingWorkspace(f.club.id));
      assert.equal(view.session.id, id); assert.equal(view.session.state, 'DRAFT');
      const command = async (action, extra = {}) => {
        view = await f.run(() => voting.getVotingWorkspace(f.club.id, id));
        return f.run(() => voting.commandVotingSession({ clubId: f.club.id, sessionId: id, revision: view.session.revision, action, ...extra }));
      };
      await command('OPEN_JOIN');
      await Promise.all([f.run(() => voting.joinVotingSession(id)), f.run(() => voting.joinVotingSession(id))]);
      await command('START_PASS');
      const ballot = () => f.run(() => voting.submitVotingBallot({ clubId: f.club.id, sessionId: id, passNumber: 1, applicationId: f.app.id, decision: 'PASS' }));
      const results = await Promise.allSettled([ballot(), ballot()]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(await base.votingBallot.count({ where: { sessionId: id } }), 1);
      await command('COMPLETE_PASS'); await command('FINISH'); await command('PUBLISH', { applicationIds: [f.app.id] });
      await assertPublished(f, 'ACCEPTED');
      await operator.clubMember.create({ data: { userId: admin.id, clubId: f.club.id, isOwner: true } });
      await operator.clubMember.update({ where: { id: f.member.id }, data: { isOwner: false, permissions: [] } });
      await assert.rejects(f.run(() => voting.getVotingWorkspace(f.club.id, id)), /Permission denied/);
      await assert.rejects(ballot(), /Permission denied/);
    });
  }
  async function recipient(f, support) {
    const context = { ...f.context, user: f.student, session: null };
    if (support) {
      context.token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
      context.session = await operator.platformViewSession.create({ data: { actorId: admin.id, targetUserId: f.student.id, tokenHash: createHash('sha256').update(context.token).digest('hex'), mode: 'IMPERSONATION', reason: 'Local recipient verification', expiresAt: new Date(Date.now()+600000) } });
    }
    return { context, run: fn => request.run(context, fn) };
  }
  await t.test('main invitation discovery holds a 5s transaction across provider policy fetch and expires', async () => {
    const main = load({ 'actions/club-onboarding.ts': execFileSync('git', ['show', 'ce2c014:actions/club-onboarding.ts'], { encoding: 'utf8' }) });
    const f = await fixture(false); await invitation(f); const r = await recipient(f, false);
    policyDelay = 5500;
    try { await assert.rejects(r.run(() => main('actions/club-onboarding.ts').getOrganizationInvitations(true)), e => e.code === 'P2028'); }
    finally { policyDelay = 0; }
    assert.equal(await base.schoolIdentity.count({ where: { userId: f.student.id } }), 0);
  });
  for (const support of [false, true]) {
    await t.test(`verified invitation discovery/claim is atomic and concurrent retries reuse membership (support=${support})`, async () => {
      const f = await fixture(support), invited = await invitation(f), r = await recipient(f, support), onboarding = api('actions/club-onboarding.ts');
      policyDelay = 5500; const before = policyCalls;
      const start = Date.now();
      const discovered = await r.run(() => onboarding.getOrganizationInvitations(true));
      assert.equal(discovered.length, 1); assert.equal(discovered[0].id, invited.id); assert.equal(policyCalls-before, 1);
      t.diagnostic(`invitation discovery policy latency=5500ms: elapsed=${Date.now()-start}ms, transaction=${transactionMs}ms`);
      policyDelay = 0;
      const accept = () => r.run(() => onboarding.acceptIdentityClubInvitation(invited.id));
      const results = await Promise.all([accept(), accept()]); await accept();
      assert.ok(results.every(result => result.clubId === f.club.id));
      assert.equal(await base.clubMember.count({ where: { clubId: f.club.id, userId: f.student.id } }), 1);
      assert.equal(await base.auditLog.count({ where: { targetId: invited.id, action: 'club.invite.accept' } }), 1);
      const audit = await base.auditLog.findFirstOrThrow({ where: { targetId: invited.id, action: 'club.invite.accept' } });
      assert.equal(audit.actorId, support ? admin.id : f.student.id); assert.equal(audit.effectiveUserId, support ? f.student.id : null);
      assert.equal(audit.supportSessionId, r.context.session?.id ?? null);
      assert.deepEqual(await r.run(() => onboarding.getOrganizationInvitations()), []);
      assert.equal(await base.invitationDelivery.count({ where: { invitationId: invited.id } }), 0);
    });
  }
  for (const support of [false, true]) {
    await t.test(`platform-designated owner claim preserves identity and grants exactly one owner (support=${support})`, async () => {
      const f = await fixture(false), onboarding = api('actions/club-onboarding.ts');
      const club = await operator.club.create({ data: { slug: randomUUID(), name: 'Unclaimed local club', tagline: '', description: '', category: 'Other', color: '#142d45' } });
      const invited = await request.run({ ...f.context, user: admin, session: null }, () => onboarding.createClubIdentityInvitation({ clubId: club.id, identifierTypeId: 'school-uva-computing-id', identifier: f.student.email.split('@')[0], requestedRole: 'OWNER', platformDesignation: true }));
      const r = await recipient(f, support);
      assert.equal((await r.run(() => onboarding.getOrganizationInvitations(true)))[0].id, invited.id);
      const claim = () => r.run(() => onboarding.acceptIdentityClubInvitation(invited.id));
      await Promise.all([claim(), claim()]); await claim();
      const member = await base.clubMember.findUniqueOrThrow({ where: { userId_clubId: { userId: f.student.id, clubId: club.id } } });
      assert.equal(member.isOwner, true); assert.equal(member.accessRole, 'OWNER'); assert.equal(member.status, 'ACTIVE');
      assert.equal(await base.clubMember.count({ where: { clubId: club.id, isOwner: true } }), 1);
      assert.ok((await base.club.findUniqueOrThrow({ where: { id: club.id } })).claimedAt);
      assert.equal((await base.user.findUniqueOrThrow({ where: { id: f.student.id } })).email, f.student.email);
      assert.equal(await base.auditLog.count({ where: { targetId: invited.id, action: 'club.invite.accept' } }), 1);
      const audit = await base.auditLog.findFirstOrThrow({ where: { targetId: invited.id, action: 'club.invite.accept' } });
      assert.equal(audit.actorId, support ? admin.id : f.student.id); assert.equal(audit.effectiveUserId, support ? f.student.id : null);
      assert.equal(audit.supportSessionId, r.context.session?.id ?? null);
    });
  }
  await t.test('platform owner claim rechecks revoked Admin grant after provider preflight and grants nothing', async () => {
    const f = await fixture(false), onboarding = api('actions/club-onboarding.ts');
    const club = await operator.club.create({data:{slug:randomUUID(),name:'Revocation fixture',tagline:'',description:'',category:'Other',color:'#142d45'}});
    const invited=await request.run({...f.context,user:admin,session:null},()=>onboarding.createClubIdentityInvitation({clubId:club.id,identifierTypeId:'school-uva-computing-id',identifier:f.student.email.split('@')[0],requestedRole:'OWNER',platformDesignation:true}));
    const r=await recipient(f,false);
    state.afterPolicy=()=>operator.platformAdmin.update({where:{userId:admin.id},data:{active:false}});
    try { await assert.rejects(r.run(()=>onboarding.acceptIdentityClubInvitation(invited.id)),/authority was revoked/); }
    finally {state.afterPolicy=null;await operator.platformAdmin.update({where:{userId:admin.id},data:{active:true}});}
    assert.equal(await base.clubMember.count({where:{clubId:club.id}}),0);
    assert.equal((await base.clubInvitation.findUniqueOrThrow({where:{id:invited.id}})).status,'PENDING');
    assert.equal((await base.club.findUniqueOrThrow({where:{id:club.id}})).claimedAt,null);
  });
  await t.test('invitation missing proof, foreign recipient, revoked inviter, suspended club and audit failure deny without partial grants', async () => {
    const onboarding = api('actions/club-onboarding.ts');
    for (const failure of ['proof', 'foreign', 'inviter', 'suspension', 'audit', 'account']) {
      const f = await fixture(false), invited = await invitation(f), r = await recipient(f, false);
      if (failure === 'proof') r.context.proof = { confirmation_sent_at: undefined };
      if (failure === 'foreign') r.context.user = (await fixture(false)).student;
      if (failure === 'inviter') { await operator.clubMember.create({ data: { clubId:f.club.id, userId:admin.id, isOwner:true } }); await operator.clubMember.update({ where: {id:f.member.id}, data: {isOwner:false, permissions:[]} }); }
      if (failure === 'suspension') await operator.club.update({ where:{id:f.club.id}, data:{suspendedAt:new Date()} });
      if (failure === 'audit') state.failAction = 'club.invite.accept';
      if (failure === 'account') await operator.user.update({ where:{id:f.student.id}, data:{disabledAt:new Date()} });
      await assert.rejects(r.run(() => onboarding.acceptIdentityClubInvitation(invited.id)), /Verify|unavailable|no longer|suspended|Injected/);
      state.failAction = null;
      assert.equal(await base.clubMember.count({where:{clubId:f.club.id,userId:f.student.id}}),0);
      assert.equal((await base.clubInvitation.findUniqueOrThrow({where:{id:invited.id}})).status,'PENDING');
      assert.equal(await base.auditLog.count({where:{action:'club.invite.accept',targetId:invited.id}}),0);
    }
  });
  async function submissionFixture(support = true) {
    const f = await fixture(support);
    await operator.club.update({ where: { id: f.club.id }, data: { applicationOpen: true } });
    await operator.studentProfile.create({ data: { userId: f.user.id, firstName: 'Synthetic', lastName: 'Applicant', computingId: randomUUID(), major: 'Economics', gradYear: 2027 } });
    const question = await operator.applicationQuestion.create({ data: { clubId: f.club.id, prompt: 'Why this club?', type: 'ESSAY', required: true, order: 0 } });
    const app = await operator.application.create({ data: { studentId: f.user.id, clubId: f.club.id, roundId: f.round.id, status: 'DRAFTING', answers: { create: { questionId: question.id, response: 'Retained draft response' } } } });
    return { ...f, ownApp: app, question, input: { clubId: f.club.id, answers: [{ questionId: question.id, response: 'Submitted response' }] } };
  }
  async function assertRetainedDraft(f) {
    const app = await base.application.findUniqueOrThrow({ where: { id: f.ownApp.id }, include: { answers: true } });
    assert.equal(app.status, 'DRAFTING'); assert.equal(app.submittedAt, null); assert.equal(app.decisionVersion, 0);
    assert.deepEqual(app.answers.map(a => a.response), ['Retained draft response']);
    assert.equal(await base.decisionLetter.count({ where: { applicationId: app.id } }), 0);
  }
  await t.test('application submission: serving five-second transaction fails under repeated Auth latency; bounded path preserves atomic answers and attribution', async () => {
    const legacy = load({ 'actions/applications.ts': execFileSync('git', ['show', '59df658:actions/applications.ts'], { encoding: 'utf8' }) });
    const f = await submissionFixture();
    providerDelay = 1800;
    try {
      await assert.rejects(f.run(() => legacy('actions/applications.ts').submitApplication(f.input)), e => e.code === 'P2028');
      await assertRetainedDraft(f);
      const before = providerCalls, start = Date.now();
      await f.run(() => api('actions/applications.ts').submitApplication(f.input));
      assert.equal(providerCalls - before, 1, 'provider validation happens once, before acquisition');
      const app = await base.application.findUniqueOrThrow({ where: { id: f.ownApp.id }, include: { answers: true } });
      assert.equal(app.status, 'SUBMITTED'); assert.ok(app.submittedAt); assert.equal(app.roundId, f.round.id);
      assert.deepEqual(app.answers.map(a => a.response), ['Submitted response']);
      const audits = await base.auditLog.findMany({ where: { supportSessionId: f.context.session.id } });
      assert.ok(audits.some(a => a.action === 'platform.impersonation.statement-returned' && a.details.model === 'ApplicationAnswer'));
      for (const audit of audits) { assert.equal(audit.actorId, admin.id); assert.equal(audit.effectiveUserId, f.user.id); }
      t.diagnostic(`application simulated Auth=1800ms: elapsed=${Date.now()-start}ms, transaction=${transactionMs}ms; one pretransaction provider resolution`);
    } finally { providerDelay = 0; }
  });
  for (const support of [false, true]) {
    await t.test(`application drafts, submission retry and cross-user isolation (support=${support})`, async () => {
      const f = await submissionFixture(support), actions = api('actions/applications.ts');
      await f.run(() => actions.saveApplicationDraft(f.input));
      assert.equal((await base.application.findUniqueOrThrow({ where: { id: f.ownApp.id } })).status, 'DRAFTING');
      await f.run(() => actions.submitApplication(f.input));
      await assert.rejects(f.run(() => actions.submitApplication({ ...f.input, answers: [{ questionId: f.question.id, response: 'Must not overwrite' }] })), /already been submitted/);
      assert.deepEqual((await base.applicationAnswer.findMany({ where: { applicationId: f.ownApp.id } })).map(a => a.response), ['Submitted response']);
      assert.equal((await base.application.findUniqueOrThrow({ where: { id: f.app.id } })).status, 'IN_REVIEW', 'the other student application is unchanged');
    });
  }
  await t.test('support revocation after the final answer write rolls submission and answers back', async () => {
    const f = await submissionFixture();
    state.afterAudit = async data => {
      if (data.action === 'platform.impersonation.statement-returned' && data.details.model === 'ApplicationAnswer' && data.details.operation === 'createMany')
        await operator.platformViewSession.update({ where: { id: f.context.session.id }, data: { endedAt: new Date() } });
    };
    try { await assert.rejects(f.run(() => api('actions/applications.ts').submitApplication(f.input)), /Impersonation expired/); }
    finally { state.afterAudit = null; }
    await assertRetainedDraft(f);
  });
  await t.test('profile authority revoked while waiting on club lock is rechecked inside the transaction', async () => {
    const f=await fixture(false);
    await operator.clubMember.create({data:{clubId:f.club.id,userId:admin.id,isOwner:true}});
    let ready,release;const gate=new Promise(r=>release=r),locked=new Promise(r=>ready=r);
    const blocker=operator.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${f.club.id} FOR UPDATE`;ready();await gate;await tx.clubMember.update({where:{id:f.member.id},data:{isOwner:false,permissions:[]}})}, {timeout:10000});
    await locked;const result=profile(f);await sleep(100);release();await blocker;
    await assert.rejects(result,/access denied/);
    assert.equal((await base.club.findUniqueOrThrow({where:{id:f.club.id}})).name,'Transaction fixture');
  });

});
