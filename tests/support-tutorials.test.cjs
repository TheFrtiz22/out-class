const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { AsyncLocalStorage } = require('node:async_hooks');
function loader(mocks = {}) {
  const cache = {};
  function load(file) {
    file = path.resolve(file);
    if (cache[file]) return cache[file].exports;
    const mod = { exports: {} }; cache[file] = mod;
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', source)(name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
      return require(name);
    }, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
const actor = '00000000-0000-4000-8000-000000000001';
const target = '00000000-0000-4000-8000-000000000002';
const clubId = '00000000-0000-4000-8000-000000000003';
const cookie = 'outclass-platform-view';
function identityHarness() {
  let token, grant = true, aal = 'aal2', login = actor, disabled = false, targetGrant = false;
  const accounts = { [actor]: { id: actor, email: 'admin@virginia.edu' }, [target]: { id: target, email: 'target@virginia.edu', role: 'STUDENT' } };
  const session = { id: 'support-session', actorId: actor, targetUserId: target, mode: 'IMPERSONATION', expiresAt: new Date(Date.now() + 60000), endedAt: null };
  let tokenHash;
  const prisma = {
    user: { upsert: async () => accounts[login], findUnique: async ({ where }) => ({ ...accounts[where.id], disabledAt: where.id === target && disabled ? new Date() : null }) },
    platformAdmin: { findUnique: async ({ where }) => where.userId === actor ? { active: grant } : targetGrant ? { active: true } : null },
    platformViewSession: { findUnique: async ({ where }) => where.tokenHash === tokenHash ? session : null },
    clubMember: { findUnique: async ({ where }) => { assert.equal(where.userId_clubId.userId, target); return { permissions: ['applications.review'], isOwner: false }; } },
    $transaction: async fn => fn(prisma),
  };
  const load = loader({
    '@/utils/prisma': { prisma }, './prisma': { prisma },
    'next/headers': { cookies: async () => ({ has: key => key === cookie && !!token, get: key => key === cookie && token ? { value: token } : undefined }) },
    '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { ...accounts[login], email_confirmed_at: '2026-01-01', app_metadata: { role: 'admin' } } } }), mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aal } }) } } }) },
    './supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { ...accounts[login], email_confirmed_at: '2026-01-01', app_metadata: { role: 'admin' } } } }) } }) },
    'next/navigation': { redirect: () => { throw Error('login required'); } },
  });
  const helper = load('utils/platform-view-as.ts');
  return { auth: load('utils/auth.ts'), admin: load('utils/platform-admin.ts'), session,
    start() { token = 'a'.repeat(64); tokenHash = helper.viewTokenHash(token); },
    exit() { token = undefined; }, forge() { token = 'b'.repeat(64); }, revoke() { grant = false; }, lowerMfa() { aal = 'aal1'; }, disable() { disabled = true; }, promote() { targetGrant = true; }, loginAsUser() { login = target; },
  };
}
test('effective authorization uses target membership; exit restores original identity and provider verification never leaks', async () => {
  const old = process.env.OUTCLASS_PLATFORM_ADMIN_IDS; process.env.OUTCLASS_PLATFORM_ADMIN_IDS = actor;
  try {
    const h = identityHarness();
    assert.equal((await h.auth.requireAuth()).user.id, actor);
    h.start();
    const effective = await h.auth.requireAuth();
    assert.equal(effective.user.id, target);
    assert.equal(effective.impersonation.actorId, actor);
    assert.equal(effective.supabaseUser.email_confirmed_at, undefined);
    assert.deepEqual(effective.supabaseUser.app_metadata, {});
    await h.auth.requireClubPermission(clubId, ['applications.review']);
    await assert.rejects(h.auth.requireClubPermission(clubId, ['leaders.manage']), /permission/);
    await assert.rejects(h.admin.requirePlatformAdmin(), /Exit impersonation/);
    h.exit();
    assert.equal((await h.auth.requireAuth()).user.id, actor);
    assert.equal((await h.admin.requirePlatformAdmin()).id, actor);
  } finally { if (old === undefined) delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS; else process.env.OUTCLASS_PLATFORM_ADMIN_IDS = old; }
});
for (const role of ['student', 'club member', 'club manager']) test(`${role} cannot acquire support authority with a manufactured cookie`, async () => {
  const old = process.env.OUTCLASS_PLATFORM_ADMIN_IDS; process.env.OUTCLASS_PLATFORM_ADMIN_IDS = actor;
  try { const h = identityHarness(); h.loginAsUser(); await assert.rejects(h.admin.requirePlatformAdmin(), /denied/); h.start(); await assert.rejects(h.auth.requireAuth(), /denied/); }
  finally { if (old === undefined) delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS; else process.env.OUTCLASS_PLATFORM_ADMIN_IDS = old; }
});
test('forged, revoked, MFA-downgraded, disabled, privileged and historical read-only contexts fail closed', async () => {
  const old = process.env.OUTCLASS_PLATFORM_ADMIN_IDS; process.env.OUTCLASS_PLATFORM_ADMIN_IDS = actor;
  try {
    for (const invalidate of [h => h.forge(), h => h.revoke(), h => h.lowerMfa(), h => h.disable(), h => h.promote(), h => { h.session.mode = 'READ_ONLY'; }, h => { h.session.endedAt = new Date(); }]) {
      const h = identityHarness(); h.start(); invalidate(h); await assert.rejects(h.auth.requireAuth());
    }
  } finally { if (old === undefined) delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS; else process.env.OUTCLASS_PLATFORM_ADMIN_IDS = old; }
});
function auditHarness() {
  const logs = []; let hook, context = { id: 'session', actorId: actor, targetUserId: target }, failAudit = false;
  class Client { auditLog = { create: async ({ data }) => { if (failAudit) throw Error('Audit unavailable'); logs.push(data); } }; $extends(extension) { hook = extension.query.$allModels.$allOperations; return this; } }
  const internal = new AsyncLocalStorage();
  // Avoid the development singleton when loading the fake client.
  const previous = global.outclassPrismaBase; delete global.outclassPrismaBase;
  loader({ '@prisma/client': { PrismaClient: Client }, '@/utils/support-audit': { supportInternal: internal, supportContext: async () => context } })('utils/prisma.ts');
  global.outclassPrismaBase = previous;
  return { run: input => hook(input), logs, fail() { failAudit = true; }, normal() { context = null; } };
}
test('all effective ORM writes have durable attempts; application audit events retain actor, subject and session', async () => {
  const h = auditHarness(); let writes = 0;
  const args = { data: { bio: 'private text is never copied into the generic audit' } };
  await h.run({ model: 'StudentProfile', operation: 'update', args, query: async () => { writes++; return { id: 'profile' }; } });
  assert.equal(writes, 1); assert.equal(h.logs.length, 2);
  assert.equal(h.logs[0].actorId, actor); assert.equal(h.logs[0].effectiveUserId, target); assert.equal(h.logs[0].supportSessionId, 'session');
  assert.equal(h.logs[1].targetId, 'profile'); assert.equal(h.logs[0].details.operationId, h.logs[1].details.operationId);
  assert.equal(h.logs[1].details.transactionMayStillRollback, true);
  assert.ok(!JSON.stringify(h.logs).includes('private text'));
  const domain = { data: { actorId: target, action: 'application.decision', targetId: 'application' } };
  await h.run({ model: 'AuditLog', operation: 'create', args: domain, query: async a => a });
  assert.deepEqual(domain.data, { actorId: actor, effectiveUserId: target, supportSessionId: 'session', action: 'application.decision', targetId: 'application' });
  h.fail(); await assert.rejects(h.run({ model: 'Application', operation: 'updateMany', args: {}, query: async () => { writes++; } }), /Audit unavailable/);
  assert.equal(writes, 1);
});
test('failed statements remain attempts; ordinary users retain their own audit identity', async () => {
  const h = auditHarness();
  await assert.rejects(h.run({ model: 'Application', operation: 'create', args: {}, query: async () => { throw Error('constraint'); } }), /constraint/);
  assert.equal(h.logs.length, 1);
  h.normal(); const data = { actorId: target, action: 'normal' };
  await h.run({ model: 'AuditLog', operation: 'create', args: { data }, query: async args => args });
  assert.deepEqual(data, { actorId: target, action: 'normal' });
});
function tutorialHarness() {
  const rows = new Map(); let leader = true, currentUser = target, impersonation = null;
  const key = q => `${q.userId}:${q.experience}`;
  const tx = { userTutorial: {
    findUnique: async ({ where }) => rows.get(key(where.userId_experience)) ?? null,
    findUniqueOrThrow: async ({ where }) => rows.get(key(where.userId_experience)),
    upsert: async ({ where, create }) => { const id = key(where.userId_experience); if (!rows.has(id)) rows.set(id, { ...create, version: 1 }); return rows.get(id); },
    updateMany: async ({ where, data }) => { const row = rows.get(key(where)); if (row && (!where.status || row.status === where.status)) Object.assign(row, data); },
  } };
  const mocks = { '@/utils/auth': { requireAuth: async () => ({ user: { id: currentUser }, impersonation }) }, '@/utils/prisma': { prisma: { ...tx, $transaction: async fn => fn(tx), clubMember: { findUnique: async () => leader ? { permissions: ['applications.review'] } : null } } } };
  return { api: () => loader(mocks)('actions/tutorials.ts'), rows, denyLeader() { leader = false; }, otherUser() { currentUser = actor; }, preview() { impersonation = { id: 'session' }; } };
}
test('first-time student starts at step zero; completion persists across independently loaded sessions and devices', async () => {
  const h = tutorialHarness(), first = h.api();
  assert.deepEqual(await first.getTutorial('student'), { status: 'IN_PROGRESS', step: 0, version: 1 });
  await first.saveTutorial({ experience: 'student', action: 'progress', step: 3 });
  assert.equal((await h.api().getTutorial('student')).step, 3);
  await first.saveTutorial({ experience: 'student', action: 'complete', step: 7 });
  assert.equal((await h.api().getTutorial('student')).status, 'COMPLETED');
  await first.saveTutorial({ experience: 'student', action: 'progress', step: 2 });
  assert.equal((await h.api().getTutorial('student')).status, 'COMPLETED', 'stale device progress cannot reopen completion');
  h.otherUser(); assert.equal((await h.api().getTutorial('student')).status, 'IN_PROGRESS');
});
test('leader tutorial is independent, requires workspace authorization, and skipped tutorials can restart', async () => {
  const h = tutorialHarness(), api = h.api();
  await api.saveTutorial({ experience: 'student', action: 'complete', step: 7 });
  assert.equal((await api.getTutorial('leader', clubId)).status, 'IN_PROGRESS');
  await api.saveTutorial({ experience: 'leader', clubId, action: 'skip', step: 2 });
  assert.equal((await h.api().getTutorial('leader', clubId)).status, 'SKIPPED');
  await api.saveTutorial({ experience: 'leader', clubId, action: 'restart', step: 0 });
  assert.equal((await api.getTutorial('leader', clubId)).status, 'IN_PROGRESS');
  assert.equal((await api.getTutorial('student')).status, 'COMPLETED');
  h.denyLeader(); await assert.rejects(api.getTutorial('leader', clubId), /access/);
  await assert.rejects(api.saveTutorial({ experience: 'leader', clubId, action: 'complete', step: 5 }), /access/);
});
test('tutorial input cannot choose another user; support walkthrough does not consume target progress', async () => {
  const h = tutorialHarness(), api = h.api();
  await api.saveTutorial({ userId: actor, experience: 'student', action: 'skip', step: 0 });
  assert.ok(h.rows.has(`${target}:student`)); assert.ok(!h.rows.has(`${actor}:student`));
  for (const input of [{ experience: 'platform', action: 'complete', step: 0 }, { experience: 'leader', clubId, action: 'progress', step: 7 }, { experience: 'student', action: 'progress', step: -1 }]) await assert.rejects(api.saveTutorial(input));
  h.preview(); assert.equal((await api.saveTutorial({ experience: 'student', action: 'restart', step: 0 })).status, 'IN_PROGRESS');
  assert.equal((await api.getTutorial('student')).status, 'SKIPPED');
});
test('support banner is a root-level fixed non-dismissable element and exit only clears the support cookie', () => {
  const root = fs.readFileSync('app/layout.tsx', 'utf8'), banner = fs.readFileSync('components/platform-view-banner.tsx', 'utf8');
  assert.match(root, /cookieStore\.has\(PLATFORM_VIEW_COOKIE\) && <PlatformViewBanner/);
  assert.match(banner, /fixed inset-x-0 top-0 z-\[2147483000\]/);
  assert.match(banner, /Viewing as/); assert.match(banner, /Exit impersonation/);
  assert.doesNotMatch(banner, /signOut|setSession|hidden|dismiss/i);
  assert.match(banner, /action: "end"/);
});

test('async support resolution keeps simultaneous administrator sessions isolated and clears recursion scope', async () => {
  const request = new AsyncLocalStorage();
  const load = loader({
    'next/headers': { cookies: async () => ({ has: () => !!request.getStore()?.token }) },
    '@/utils/platform-view-as': { platformViewSession: async () => { await new Promise(resolve => setImmediate(resolve)); return request.getStore()?.session; } },
  });
  const audit = load('utils/support-audit.ts');
  const results = await Promise.all(['one', 'two'].map(id => request.run({ token: true, session: { id, actorId: id } }, () => audit.supportContext())));
  assert.deepEqual(results.map(s => s.id), ['one', 'two']);
  assert.equal(audit.supportInternal.getStore(), undefined);
  assert.equal(await audit.supportContext(), null);
  await assert.rejects(request.run({ token: true, session: null }, () => audit.supportContext()), /expired/);
  assert.equal(audit.supportInternal.getStore(), undefined);
});

test('feature migration preserves old data, keeps historical tokens read-only, isolates progress, and retains append-only audit', async () => {
  const { PGlite } = require('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE "User"(id TEXT PRIMARY KEY); INSERT INTO "User" VALUES ('existing');
      CREATE TABLE "PlatformViewSession"(id TEXT PRIMARY KEY); INSERT INTO "PlatformViewSession" VALUES ('old-token');
      CREATE TABLE "AuditLog"(id TEXT PRIMARY KEY); INSERT INTO "AuditLog" VALUES ('historical');
      CREATE FUNCTION immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only'; END $$;
      CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION immutable_audit();
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;`);
    await db.exec(fs.readFileSync('prisma/migrations/20261001000000_support_impersonation_tutorials/migration.sql', 'utf8'));
    assert.deepEqual((await db.query('SELECT * FROM "User"')).rows, [{ id: 'existing' }]);
    assert.equal((await db.query('SELECT mode FROM "PlatformViewSession"')).rows[0].mode, 'READ_ONLY');
    assert.deepEqual((await db.query('SELECT * FROM "AuditLog"')).rows, [{ id: 'historical', effectiveUserId: null, supportSessionId: null }]);
    await assert.rejects(db.exec(`UPDATE "AuditLog" SET "effectiveUserId"='forged'`), /append-only/);
    await db.exec(`INSERT INTO "UserTutorial" ("userId",experience,"updatedAt") VALUES ('existing','student',NOW()),('existing','leader',NOW());`);
    await assert.rejects(db.exec(`INSERT INTO "UserTutorial" ("userId",experience,"updatedAt") VALUES ('existing','student',NOW())`), /unique/);
    await assert.rejects(db.exec(`UPDATE "UserTutorial" SET status='INVALID'`), /check constraint/);
    await assert.rejects(db.exec(`UPDATE "UserTutorial" SET step=-1`), /check constraint/);
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query(`SELECT has_table_privilege($1, '"UserTutorial"', $2) AS allowed`, [role, privilege])).rows[0].allowed, false);
      }
    }
    assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='UserTutorial'`)).rows[0].relrowsecurity, true);
    await db.exec(`DELETE FROM "User" WHERE id='existing'`);
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM "UserTutorial"`)).rows[0].n, 0);
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM "AuditLog"`)).rows[0].n, 1);
  } finally { await db.close(); }
});

test('tutorial UI advances, goes back, skips with Escape, restarts, highlights context and remains dismissible on save failure', async () => {
  const slots = [], pendingEffects = []; let cursor = 0, saved = [], fail = false;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i][j])) { slots[i] = deps; pendingEffects.push(fn); } },
  };
  const api = {
    getTutorial: async () => ({ status: 'IN_PROGRESS', step: 0, version: 1 }),
    saveTutorial: async input => { if (fail) throw Error('Offline'); saved.push(input); return { status: input.action === 'skip' ? 'SKIPPED' : input.action === 'complete' ? 'COMPLETED' : 'IN_PROGRESS', step: input.action === 'restart' ? 0 : input.step, version: 1 }; },
  };
  const old = { window: global.window, document: global.document, ResizeObserver: global.ResizeObserver };
  global.window = { addEventListener() {}, removeEventListener() {} };
  global.document = { activeElement: null, querySelectorAll: () => [], querySelector: () => ({ getBoundingClientRect: () => ({ top: 100, left: 10, width: 200, height: 50 }) }), body: {} };
  global.ResizeObserver = class { observe() {} disconnect() {} };
  global.HTMLElement ??= class {};
  try {
    const { TutorialWalkthrough } = loader({ react, '@/components/ui/button': { Button: 'button' }, '@/actions/tutorials': api })('components/tutorial-walkthrough.tsx');
    let tree;
    const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
    const label = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(label).join('') : node?.props ? label(node.props.children) : '';
    async function render() { cursor = 0; tree = TutorialWalkthrough({ experience: 'student', onOpenStep() {} }); while (pendingEffects.length) pendingEffects.shift()(); await new Promise(resolve => setImmediate(resolve)); cursor = 0; tree = TutorialWalkthrough({ experience: 'student', onOpenStep() {} }); }
    const button = text => walk(tree).find(node => node.type === 'button' && label(node) === text);
    async function click(text) { button(text).props.onClick(); await new Promise(resolve => setImmediate(resolve)); await render(); }
    await render();
    assert.ok(walk(tree).some(node => node.props?.role === 'dialog' && node.props['aria-modal'] === 'false'));
    assert.equal(button('Back').props.disabled, true);
    await click('Next'); assert.equal(saved.at(-1).step, 1);
    await click('Back'); assert.equal(saved.at(-1).step, 0);
    walk(tree).find(node => node.props?.role === 'dialog').props.onKeyDown({ key: 'Escape', preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve)); await render();
    assert.equal(saved.at(-1).action, 'skip'); assert.ok(button('Tutorial help'));
    await click('Tutorial help'); assert.equal(saved.at(-1).action, 'restart');
    fail = true; await click('Next'); assert.ok(button('Close for now'));
    await click('Close for now'); assert.ok(button('Tutorial help'));
  } finally { Object.assign(global, old); }
});

test('support uploads sign only fresh effective-user paths and fail closed before issuance if audit fails', async () => {
  const oldKey = process.env.SUPABASE_SECRET_KEY; process.env.SUPABASE_SECRET_KEY = 'fixture';
  let signed, auditFailure = false;
  const admin = { storage: { getBucket: async () => ({ data: { public: false } }), from: () => ({ createSignedUploadUrl: async path => { signed = path; return { data: { signedUrl: 'https://fixture.invalid/upload', token: 'fixture' } }; } }) } };
  try {
    const api = loader({
      '@/utils/auth': { requireAuth: async () => ({ user: { id: target }, impersonation: { actorId: actor } }) },
      'next/headers': { cookies: async () => ({}) },
      '@/utils/supabase/server': { createClient: async () => ({ storage: { from: () => { throw Error('Original admin Storage identity must not be used'); } } }) },
      '@supabase/supabase-js': { createClient: () => admin },
      '@/utils/support-audit': { auditSupportAction: async (action, id) => { assert.equal(id, target); if (auditFailure) throw Error('audit unavailable'); } },
    })('actions/storage.ts');
    await api.getSignedUploadUrl({ bucket: 'resumes', fileName: 'resume.pdf' });
    assert.match(signed, new RegExp(`^${target}/[0-9]+-resume.pdf$`));
    signed = undefined; auditFailure = true;
    await assert.rejects(api.getSignedUploadUrl({ bucket: 'resumes', fileName: 'resume.pdf' }), /audit unavailable/);
    assert.equal(signed, undefined);
  } finally { if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey; }
});

test('verification-dependent actions read the target provider identity and reject mismatches instead of borrowing admin verification', async () => {
  const old = process.env.SUPABASE_SECRET_KEY; process.env.SUPABASE_SECRET_KEY = 'fixture';
  let provider = { id: target, email: 'target@virginia.edu', email_confirmed_at: '2026-09-01', app_metadata: { email_verification_skipped: false } };
  try {
    const auth = loader({
      'next/headers': { cookies: async () => ({ has: () => true }) },
      '@/utils/platform-view-as': { platformViewSession: async () => ({ id: 'session', actorId: actor, targetUserId: target }) },
      './prisma': { prisma: { user: { findUnique: async () => ({ id: target, email: 'target@virginia.edu' }) } } },
      './supabase/server': {},
      '@supabase/supabase-js': { createClient: () => ({ auth: { admin: { getUserById: async id => { assert.equal(id, target); return { data: { user: provider } }; } } } }) },
    })('utils/auth.ts');
    const verified = await auth.requireAuth({ verifyEmail: true });
    assert.equal(verified.supabaseUser.email_confirmed_at, '2026-09-01');
    assert.equal(verified.supabaseUser.id, target);
    provider = { ...provider, email_confirmed_at: undefined };
    assert.equal((await auth.requireAuth({ verifyEmail: true })).supabaseUser.email_confirmed_at, undefined);
    provider = { ...provider, id: actor };
    await assert.rejects(auth.requireAuth({ verifyEmail: true }), /unavailable/);
  } finally { if (old === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = old; }
});

test('account API denies forged support context and returns 401 for an unauthenticated normal request', async () => {
  for (const support of [false, true]) {
    let reads = 0;
    const api = loader({
      'next/headers': { cookies: async () => ({ has: () => support, get: () => undefined }) },
      '@/utils/auth': { requireAuth: async () => { throw support ? Error('invalid support session') : { digest: 'NEXT_REDIRECT;replace;/;307;' }; } },
      '@/utils/prisma': { prisma: { user: { findUnique: async () => { reads++; } } } },
    })('app/api/users/me/route.ts');
    assert.equal((await api.GET()).status, support ? 403 : 401);
    assert.equal(reads, 0);
  }
});

test('other tabs and restored pages reload on server context changes; broadcasts never carry credentials', async () => {
  const saved = Object.fromEntries(['window', 'document', 'localStorage', 'BroadcastChannel', 'fetch'].map(k => [k, global[k]]));
  const messages = [], listeners = {}; let effect, reloads = 0, server = { marker: false, sessionId: null };
  global.window = { location: { reload() { reloads++; } }, addEventListener: (k, fn) => { listeners[k] = fn; }, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {} };
  global.document = { visibilityState: 'visible', addEventListener: (k, fn) => { listeners[k] = fn; }, removeEventListener() {} };
  global.localStorage = { setItem: (key, value) => messages.push({ key, value }) };
  global.BroadcastChannel = class { postMessage(message) { messages.push(message); } close() {} };
  global.fetch = async () => ({ ok: true, json: async () => server });
  try {
    const sync = loader({ react: { useEffect(fn) { effect = fn; } } })('components/support-session-sync.tsx');
    sync.SupportSessionSync({ marker: false, sessionId: null });
    const cleanup = effect(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(reloads, 0);
    server = { marker: true, sessionId: 'opaque-session-id' };
    await listeners.pageshow(); assert.equal(reloads, 1);
    listeners.storage({ key: 'outclass-support-context-changed' }); assert.equal(reloads, 2);
    sync.notifySupportSessionChanged();
    assert.ok(messages.length >= 2);
    assert.ok(!JSON.stringify(messages).includes('opaque-session-id'));
    assert.deepEqual(Object.keys(messages.at(-1)), ['source']);
    cleanup();
  } finally { Object.assign(global, saved); }
});
