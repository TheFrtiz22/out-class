const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function loader(mocks) {
  const cache = {};
  function load(file) {
    file = path.resolve(root, file);
    if (cache[file]) return cache[file].exports;
    const m = { exports: {} }; cache[file] = m;
    const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'module', 'exports', out)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), m, m.exports);
    return m.exports;
  }
  return load;
}

const userId = '00000000-0000-4000-8000-000000000001';
const adminId = '00000000-0000-4000-8000-000000000002';
const DAY = 86400000;

function harness(opts = {}) {
  const state = { now: Date.now(), viewAs: false, demo: false, amrAgo: 60 * 60_000, passwordOk: true, adminFresh: true, active: false, signOuts: [], signIns: 0, emails: [], deletions: [], ...opts };
  const reports = [], logs = [];
  const jar = { has: k => (k === 'outclass-platform-view' && state.viewAs) || (k === 'outclass-demo-session' && state.demo), get: k => k === 'outclass-demo-session' && state.demo ? { value: '1' } : undefined };
  const match = (row, where) => Object.entries(where).every(([k, v]) => v && typeof v === 'object' && !(v instanceof Date) ? ('in' in v ? v.in.includes(row[k]) : 'gte' in v ? row[k] >= v.gte : true) : row[k] === v);
  const prisma = {
    $queryRaw: async () => [], $transaction: async fn => fn(prisma),
    platformAdmin: { findUnique: async () => state.active ? { active: true } : null },
    clubMember: { findMany: async () => [], count: async () => 0 },
    platformReport: {
      findFirst: async ({ where }) => reports.filter(r => match(r, where)).at(-1) || null,
      findUnique: async ({ where }) => reports.find(r => r.id === where.id) || null,
      findMany: async ({ where }) => reports.filter(r => match(r, where)),
      create: async ({ data }) => { const row = { id: '00000000-0000-4000-8000-0000000000a' + reports.length, status: 'OPEN', revision: 0, createdAt: new Date(), ...data }; reports.push(row); return row; },
      update: async ({ where, data }) => { const row = reports.find(r => r.id === where.id); Object.assign(row, data, { revision: row.revision + 1 }); return row; },
      updateMany: async ({ where, data }) => { const rows = reports.filter(r => match(r, where)); for (const r of rows) Object.assign(r, data, { revision: r.revision + 1 }); return { count: rows.length }; },
    },
    auditLog: { create: async ({ data }) => { logs.push({ ...data, createdAt: new Date() }); return data; }, count: async ({ where }) => logs.filter(r => match(r, where)).length },
  };
  const load = loader({
    'next/headers': { cookies: async () => jar },
    'next/cache': { revalidatePath: () => {} },
    '@/utils/prisma': { prisma },
    '@/lib/demo/access': { DEMO_COOKIE: 'outclass-demo-session' },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: userId, email: 'student@virginia.edu' }, impersonation: state.viewAs ? { id: 'support' } : null }) },
    '@/utils/platform-admin': { requirePlatformAdmin: async (options = {}) => { state.adminOptions = options; if (options.fresh && !state.adminFresh) throw Error('Verify your password and authenticator again'); return { id: adminId }; } },
    '@/utils/supabase/server': { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { amr: [{ method: 'password', timestamp: Math.floor((Date.now() - state.amrAgo) / 1000) }] } } }) } }) },
    '@/utils/admin-elevation': { freshAuthClient: () => ({ auth: {
      signInWithPassword: async () => { state.signIns++; return state.passwordOk ? { data: { user: { id: userId }, session: { access_token: 'a' } }, error: null } : { data: {}, error: Object.assign(Error('bad'), { status: 400, code: 'invalid_credentials' }) }; },
      signOut: async options => { state.signOuts.push(options); return { error: null }; },
    } }) },
    '@/utils/email': { sendAccountDeletionEmail: async input => { state.emails.push(input); return { messageId: 'm' }; } },
    '@/utils/account-deletion': { performAccountDeletion: async (_db, id, ctx) => { state.deletions.push({ id, ctx }); return { userId: id, storageObjects: 2, deletedApplications: 1, anonymizedApplications: 1, deletedMemberships: 0, anonymizedMemberships: 1 }; } },
  });
  const actions = load('actions/account-deletion.ts');
  return { actions, state, reports, logs };
}

test('request requires a fresh session or the current password', async () => {
  const h = harness();
  await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'DELETE' }), /sign out and sign back in/);
  assert.equal(h.reports.length, 0);
  h.state.passwordOk = false;
  await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'DELETE', password: 'wrong' }), /password isn’t right/);
  assert.equal(h.reports.length, 0);
  h.state.passwordOk = true;
  const ok = await h.actions.requestAccountDeletion({ confirmation: 'student@virginia.edu', password: 'right' });
  assert.ok(ok.scheduledFor);
  assert.deepEqual(h.state.signOuts, [{ scope: 'local' }], 'only the throwaway verification session is closed');
  const recent = harness({ amrAgo: 2 * 60_000 });
  await recent.actions.requestAccountDeletion({ confirmation: 'DELETE' });
  assert.equal(recent.reports.length, 1);
  assert.equal(recent.state.signIns, 0);
});

test('password attempts are rate limited before calling Auth', async () => {
  const h = harness({ passwordOk: false });
  for (let i = 0; i < 5; i++) await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'DELETE', password: 'x' }), /password/);
  await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'DELETE', password: 'x' }), /Too many attempts/);
  assert.equal(h.state.signIns, 5);
});

test('typed confirmation must be the email or DELETE', async () => {
  const h = harness({ amrAgo: 0 });
  await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'delete me' }), /Type your university email or DELETE/);
});

test('view-as support sessions and Demo Mode are refused', async () => {
  const viewAs = harness({ viewAs: true, amrAgo: 0 });
  await assert.rejects(viewAs.actions.requestAccountDeletion({ confirmation: 'DELETE' }), /Support sessions/);
  await assert.rejects(viewAs.actions.cancelAccountDeletion(), /Support sessions/);
  assert.equal(viewAs.reports.length, 0);
  const demo = harness({ demo: true, amrAgo: 0 });
  await assert.rejects(demo.actions.requestAccountDeletion({ confirmation: 'DELETE' }), /Demo Mode/);
});

test('active platform admins cannot request deletion', async () => {
  const h = harness({ active: true, amrAgo: 0 });
  await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'DELETE' }), /administrator access/);
});

test('request writes the audit row, notifies admins via Reports and emails once', async () => {
  const h = harness({ amrAgo: 0 });
  const first = await h.actions.requestAccountDeletion({ confirmation: 'DELETE' });
  const audit = h.logs.find(l => l.action === 'account.deletion.requested');
  assert.ok(audit, 'account.deletion.requested audit row');
  assert.equal(audit.targetId, userId);
  assert.equal(audit.details.scheduledFor, first.scheduledFor);
  assert.equal(new Date(first.scheduledFor) - new Date(first.requestedAt), 14 * DAY);
  assert.equal(h.reports[0].kind, 'ACCOUNT_DELETION');
  assert.equal(h.state.emails.length, 1);
  const again = await h.actions.requestAccountDeletion({ confirmation: 'DELETE' });
  assert.equal(again.scheduledFor, first.scheduledFor, 'idempotent');
  assert.equal(h.reports.length, 1);
  assert.equal(h.state.emails.length, 1);
});

test('cancel works within 14 days and not after', async () => {
  const h = harness({ amrAgo: 0 });
  await h.actions.requestAccountDeletion({ confirmation: 'DELETE' });
  h.reports[0].createdAt = new Date(Date.now() - 13 * DAY);
  await h.actions.cancelAccountDeletion();
  assert.equal(h.reports[0].status, 'DISMISSED');
  assert.ok(h.logs.some(l => l.action === 'account.deletion.cancelled'));
  assert.equal(await h.actions.getAccountDeletionRequest(), null);
  await h.actions.requestAccountDeletion({ confirmation: 'DELETE' });
  h.reports[1].createdAt = new Date(Date.now() - 15 * DAY);
  await assert.rejects(h.actions.cancelAccountDeletion(), /can no longer be cancelled/);
});

test('admin completion is fresh-admin only, waits for the window, and is audited', async () => {
  const h = harness({ amrAgo: 0 });
  await h.actions.requestAccountDeletion({ confirmation: 'DELETE' });
  const row = h.reports[0];
  const input = () => ({ id: row.id, revision: row.revision, reason: 'Verified request; window elapsed.' });
  h.state.adminFresh = false;
  await assert.rejects(h.actions.completeAccountDeletion(input()), /authenticator again/);
  assert.deepEqual(h.state.adminOptions, { fresh: true });
  assert.equal(h.state.deletions.length, 0);
  h.state.adminFresh = true;
  await assert.rejects(h.actions.completeAccountDeletion(input()), /cancellation window/);
  row.createdAt = new Date(Date.now() - 15 * DAY);
  const result = await h.actions.completeAccountDeletion(input());
  assert.equal(result.userId, userId);
  assert.deepEqual(h.state.deletions.map(d => [d.id, d.ctx.actorId, d.ctx.reportId]), [[userId, adminId, row.id]]);
  assert.ok(h.logs.some(l => l.action === 'platform.account-deletion.start' && l.actorId === adminId));
  await assert.rejects(h.actions.completeAccountDeletion({ ...input(), revision: 0 }), /changed|no longer/);
});

test('generic report resolution cannot close a deletion request', () => {
  const src = fs.readFileSync(path.join(root, 'actions/admin-workspace.ts'), 'utf8');
  assert.match(src, /notIn: \["SUPPORT", "ACCOUNT_DELETION"\]/);
  assert.match(src, /row\.kind === "ACCOUNT_DELETION"/);
});

function procedureHarness({ apps = [], members = [], authMissing = false } = {}) {
  const calls = [], removed = [], audit = [];
  let authDeleted = 0;
  const user = { id: userId, email: 'student@virginia.edu', disabledAt: null };
  const op = (model, name) => async args => { calls.push([model, name, args]); if (name === 'findMany' && model === 'application') return apps; if (name === 'findMany' && model === 'clubMember') return members; return { count: 1 }; };
  const models = ['studentProfile', 'eventRsvp', 'savedCampusEvent', 'corkboardClub', 'userTutorial', 'userAvailability', 'editorDraft', 'calendarFeedToken', 'recipientGroupEntry', 'userNotification', 'notificationEmailDelivery', 'userNotificationPreference', 'clubConversation', 'taskAssignment', 'clubTask', 'clubClaim', 'adminElevationChallenge', 'platformAdmin', 'rosterImportRow', 'application', 'applicationAnswer', 'clubMember', 'platformReport'];
  const tx = { $queryRaw: async () => [], auditLog: { create: async ({ data }) => audit.push(data) }, user: { update: async ({ data }) => { calls.push(['user', 'update', { data }]); Object.assign(user, data); } } };
  for (const m of models) tx[m] = new Proxy({}, { get: (_, name) => op(m, name) });
  const db = {
    $transaction: async fn => fn(tx),
    user: { findUnique: async () => user, update: async ({ data }) => Object.assign(user, data) },
    platformAdmin: { findUnique: async () => null },
    taskFile: { findMany: async () => [{ path: 'assignment-1/file' }] },
  };
  const services = {
    listObjects: async (bucket, prefix) => bucket === 'resumes' ? [`${prefix}/resume.pdf`] : [`${prefix}/face.png`],
    removeObjects: async (bucket, paths) => removed.push([bucket, paths]),
    deleteAuthUser: async () => { authDeleted++; },
  };
  const { performAccountDeletion } = loader({ '@supabase/supabase-js': { createClient: () => ({}) } })('utils/account-deletion.ts');
  return { run: () => performAccountDeletion(db, userId, { actorId: adminId, reportId: 'report-1', reason: 'Completed after window.' }, services), calls, removed, audit, user, authDeleted: () => authDeleted };
}

test('deletion procedure deletes personal data, anonymizes club records and deletes the Auth user', async () => {
  const none = { evaluations: 0, interviewRecords: 0, votingCandidates: 0, interviewAssignments: 0, resumeDocuments: 0, decisionLetters: 0, observations: 0 };
  const h = procedureHarness({
    apps: [
      { id: 'draft', status: 'DRAFTING', recruitmentOffer: null, _count: none },
      { id: 'decided', status: 'ACCEPTED', recruitmentOffer: null, _count: none },
      { id: 'voted', status: 'IN_REVIEW', recruitmentOffer: null, _count: { ...none, votingCandidates: 1 } },
    ],
    members: [
      { id: 'quiet', _count: { evaluations: 0, interviewRecords: 0, interviewAssignments: 0, resumeAnnotations: 0, votingParticipants: 0, availabilityOverrides: 0 } },
      { id: 'voter', _count: { evaluations: 2, interviewRecords: 0, interviewAssignments: 0, resumeAnnotations: 0, votingParticipants: 1, availabilityOverrides: 0 } },
    ],
  });
  const result = await h.run();
  assert.deepEqual(result, { userId, storageObjects: 3, deletedApplications: 1, anonymizedApplications: 2, deletedMemberships: 1, anonymizedMemberships: 1 });
  assert.deepEqual(h.removed, [['resumes', [`${userId}/resume.pdf`]], ['headshots', [`${userId}/face.png`]], ['task-submissions', ['assignment-1/file']]]);
  const find = (model, name) => h.calls.filter(c => c[0] === model && c[1] === name).map(c => c[2]);
  assert.deepEqual(find('application', 'deleteMany')[0].where.id.in, ['draft']);
  assert.deepEqual(find('applicationAnswer', 'deleteMany')[0].where.applicationId.in, ['decided', 'voted']);
  assert.deepEqual(find('clubMember', 'deleteMany')[0].where.id.in, ['quiet']);
  assert.equal(find('clubMember', 'updateMany')[0].data.status, 'LEFT');
  assert.ok(find('studentProfile', 'deleteMany').length && find('calendarFeedToken', 'deleteMany').length);
  const notif = h.calls.findIndex(c => c[0] === 'userNotification'), delivery = h.calls.findIndex(c => c[0] === 'notificationEmailDelivery');
  assert.ok(notif < delivery, 'outbox rows go with notifications before deliveries');
  assert.equal(h.user.email, `deleted-${userId}@deleted.outclass.invalid`);
  assert.ok(h.user.disabledAt);
  assert.equal(h.authDeleted(), 1);
  assert.equal(h.audit.at(-1).action, 'account.deletion.completed');
  assert.equal(h.audit.at(-1).actorId, adminId);
  // Idempotent re-run (e.g. after an interrupted attempt).
  await h.run();
  assert.equal(h.authDeleted(), 2);
});

test('relation plan covers every User relation in schema.prisma, and the procedure acts on each deleted or unlinked one', () => {
  const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
  const models = new Set([...schema.matchAll(/^model (\w+) \{/gm)].map(m => m[1]));
  const body = schema.match(/^model User \{([\s\S]*?)^\}/m)[1];
  const relations = {};
  for (const line of body.split('\n')) {
    const m = line.trim().match(/^(\w+)\s+(\w+)(\[\]|\?)?/);
    if (m && models.has(m[2])) relations[m[1]] = m[2];
  }
  const { userRelationDeletionPlan } = loader({})('lib/account-deletion.ts');
  assert.deepEqual(Object.keys(userRelationDeletionPlan).sort(), Object.keys(relations).sort(), 'every User relation has exactly one plan entry');
  for (const [field, model] of Object.entries(relations)) assert.equal(userRelationDeletionPlan[field].model, model, field);
  const procedure = fs.readFileSync(path.join(root, 'utils/account-deletion.ts'), 'utf8');
  for (const [field, plan] of Object.entries(userRelationDeletionPlan)) {
    if (plan.treatment === 'retain') continue;
    const delegate = plan.model[0].toLowerCase() + plan.model.slice(1);
    assert.match(procedure, new RegExp(`tx\\.${delegate}\\.(deleteMany|updateMany)`), `${field} (${plan.treatment}) is handled`);
  }
  // Restrict relations can only be retained or unlinked: the User row is the tombstone.
  for (const [field, plan] of Object.entries(userRelationDeletionPlan)) if (plan.onDelete === 'Restrict') assert.ok(['retain', 'unlink'].includes(plan.treatment), field);
});

test('the settings section hides itself in Demo Mode and support sessions', () => {
  const src = fs.readFileSync(path.join(root, 'components/settings/account-settings.tsx'), 'utf8');
  assert.match(src, /!demo\.isDemoEnabled && !impersonating && <AccountDeletion/);
  const ui = fs.readFileSync(path.join(root, 'components/settings/account-deletion.tsx'), 'utf8');
  assert.match(ui, /tone: "danger"/);
  assert.match(ui, /You can cancel within 14 days\./);
});
