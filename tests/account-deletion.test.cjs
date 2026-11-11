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
  const state = { now: Date.now(), viewAs: false, demo: false, amrAgo: 60 * 60_000, passwordOk: true, adminFresh: true, active: false, passwordAccount: true, ip: '203.0.113.7', emailFails: false, deletionError: null, owners: [], signOuts: [], signIns: 0, emails: [], deletions: [], ...opts };
  const reports = [], logs = [];
  const jar = { has: k => (k === 'outclass-platform-view' && state.viewAs) || (k === 'outclass-demo-session' && state.demo), get: k => k === 'outclass-demo-session' && state.demo ? { value: '1' } : undefined };
  const match = (row, where) => Object.entries(where).every(([k, v]) => v && typeof v === 'object' && !(v instanceof Date) ? ('in' in v ? v.in.includes(row[k]) : 'gte' in v ? row[k] >= v.gte : 'path' in v ? row[k]?.[v.path[0]] === v.equals : true) : row[k] === v);
  const prisma = {
    $queryRaw: async () => [], $transaction: async fn => fn(prisma),
    platformAdmin: { findUnique: async () => state.active ? { active: true } : null },
    clubMember: { findMany: async ({ where }) => where.isOwner && where.userId === userId ? state.owners.map(o => ({ clubId: o.clubId, club: { name: o.name } })) : where.isOwner ? (state.owners.find(o => o.clubId === where.clubId)?.others || []).map(id => ({ userId: id })) : [], count: async () => 0 },
    platformReport: {
      findFirst: async ({ where }) => reports.filter(r => match(r, where)).at(-1) || null,
      findUnique: async ({ where }) => reports.find(r => r.id === where.id) || null,
      findMany: async ({ where }) => reports.filter(r => match(r, where)),
      count: async ({ where }) => reports.filter(r => match(r, where)).length,
      create: async ({ data }) => { const row = { id: '00000000-0000-4000-8000-0000000000a' + reports.length, status: 'OPEN', revision: 0, createdAt: new Date(), ...data }; reports.push(row); return row; },
      update: async ({ where, data }) => { const row = reports.find(r => r.id === where.id); Object.assign(row, data, { revision: row.revision + 1 }); return row; },
      updateMany: async ({ where, data }) => { const rows = reports.filter(r => match(r, where)); for (const r of rows) Object.assign(r, data, { revision: r.revision + 1 }); return { count: rows.length }; },
    },
    auditLog: { create: async ({ data }) => { logs.push({ ...data, createdAt: new Date() }); return data; }, count: async ({ where }) => logs.filter(r => match(r, where)).length, findMany: async ({ where }) => logs.filter(r => match(r, where)) },
  };
  const load = loader({
    'next/headers': { cookies: async () => jar, headers: async () => new Map([['x-forwarded-for', state.ip]]) },
    'next/cache': { revalidatePath: () => {} },
    '@/utils/prisma': { prisma },
    '@/lib/demo/access': { DEMO_COOKIE: 'outclass-demo-session' },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: userId, email: 'student@virginia.edu' }, supabaseUser: { app_metadata: { providers: state.passwordAccount ? ['email', 'azure'] : ['azure'] } }, impersonation: state.viewAs ? { id: 'support' } : null }) },
    '@/utils/platform-admin': { requirePlatformAdmin: async (options = {}) => { state.adminOptions = options; if (options.fresh && !state.adminFresh) throw Error('Verify your password and authenticator again'); return { id: adminId }; } },
    '@/utils/supabase/server': { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { amr: [{ method: 'password', timestamp: Math.floor((Date.now() - state.amrAgo) / 1000) }] } } }) } }) },
    '@/utils/admin-elevation': { freshAuthClient: () => ({ auth: {
      signInWithPassword: async () => { state.signIns++; return state.passwordOk ? { data: { user: { id: userId }, session: { access_token: 'a' } }, error: null } : { data: {}, error: Object.assign(Error('bad'), { status: 400, code: 'invalid_credentials' }) }; },
      signOut: async options => { state.signOuts.push(options); return { error: null }; },
    } }) },
    '@/utils/email': { sendAccountDeletionEmail: async input => { state.emails.push(input); if (state.emailFails) throw Error('smtp down'); return { messageId: 'm' }; } },
    '@/utils/account-deletion': { OWNER_GUARD_MESSAGE: 'only active owner', ownerGuardError: e => /Assign another active owner/.test(e.message), performAccountDeletion: async (_db, id, ctx) => { state.deletions.push({ id, ctx }); if (state.deletionError) throw state.deletionError; return { userId: id, storageObjects: 2, deletedApplications: 1, anonymizedApplications: 1, deletedMemberships: 0, anonymizedMemberships: 1, retainedDecisionLetters: 0, retainedResumeSnapshots: 0, authDeleted: true }; } },
  });
  const actions = load('actions/account-deletion.ts');
  return { actions, state, reports, logs };
}

test('password accounts always re-enter the password; only password-less accounts may use a recent sign-in', async () => {
  const h = harness({ amrAgo: 0 });
  await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'DELETE' }), /Enter your current password/, 'a fresh sign-in is not enough when a password exists');
  h.state.passwordOk = false;
  await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'DELETE', password: 'wrong' }), /password isn’t right/);
  assert.equal(h.reports.length, 0);
  h.state.passwordOk = true;
  const ok = await h.actions.requestAccountDeletion({ confirmation: 'student@virginia.edu', password: 'right' });
  assert.ok(ok.scheduledFor);
  assert.deepEqual(h.state.signOuts, [{ scope: 'local' }], 'only the throwaway verification session is closed');
  const stale = harness({ passwordAccount: false });
  await assert.rejects(stale.actions.requestAccountDeletion({ confirmation: 'DELETE' }), /sign out and sign back in/);
  await assert.rejects(stale.actions.requestAccountDeletion({ confirmation: 'DELETE', password: 'guess' }), /sign out and sign back in/);
  assert.equal(stale.state.signIns, 0);
  const recent = harness({ amrAgo: 2 * 60_000, passwordAccount: false });
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

test('password attempts are also limited per network, and only an IP hash is stored', async () => {
  const h = harness({ passwordOk: false });
  for (let i = 0; i < 20; i++) h.logs.push({ actorId: 'someone-' + i, action: 'account.deletion.password-attempt', createdAt: new Date(), details: { ipHash: null } });
  await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'DELETE', password: 'x' }), /password isn’t right/);
  const hash = h.logs.at(-1).details.ipHash;
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(h.logs).includes('203.0.113.7'));
  for (const row of h.logs) row.details = { ipHash: hash };
  await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'DELETE', password: 'x' }), /from this network/);
  assert.equal(h.state.signIns, 1);
});

test('typed confirmation must be the email or DELETE', async () => {
  const h = harness({ amrAgo: 0, passwordAccount: false });
  await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'delete me' }), /Type your university email or DELETE/);
});

test('view-as support sessions and Demo Mode are refused', async () => {
  const viewAs = harness({ viewAs: true, amrAgo: 0, passwordAccount: false });
  await assert.rejects(viewAs.actions.requestAccountDeletion({ confirmation: 'DELETE' }), /Support sessions/);
  await assert.rejects(viewAs.actions.cancelAccountDeletion(), /Support sessions/);
  assert.equal(viewAs.reports.length, 0);
  const demo = harness({ demo: true, amrAgo: 0, passwordAccount: false });
  await assert.rejects(demo.actions.requestAccountDeletion({ confirmation: 'DELETE' }), /Demo Mode/);
});

test('active platform admins cannot request deletion', async () => {
  const h = harness({ active: true, amrAgo: 0, passwordAccount: false });
  await assert.rejects(h.actions.requestAccountDeletion({ confirmation: 'DELETE' }), /administrator access/);
});

test('request writes the audit row, notifies admins via Reports and emails once', async () => {
  const h = harness({ amrAgo: 0, passwordAccount: false });
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

test('a failed confirmation email is surfaced to the person and to admins', async () => {
  const h = harness({ amrAgo: 0, passwordAccount: false, emailFails: true });
  const result = await h.actions.requestAccountDeletion({ confirmation: 'DELETE' });
  assert.equal(result.emailSent, false);
  assert.equal((await h.actions.getAccountDeletionRequest()).pending.emailSent, false);
  assert.equal((await h.actions.requestAccountDeletion({ confirmation: 'DELETE' })).emailSent, false, 'repeat request reports the stored status');
  const [row] = await h.actions.listAccountDeletionRequests();
  assert.equal(row.emailSent, false);
  const ui = fs.readFileSync(path.join(root, 'components/settings/account-deletion.tsx'), 'utf8');
  assert.match(ui, /!pending\.emailSent && <p role="status"[^>]*>We couldn’t send the confirmation email/);
  assert.match(fs.readFileSync(path.join(root, 'components/admin/admin-deletion-requests.tsx'), 'utf8'), /row\.emailSent === false \? "Confirmation email failed to send"/);
  const ok = harness({ amrAgo: 0, passwordAccount: false });
  await ok.actions.requestAccountDeletion({ confirmation: 'DELETE' });
  assert.equal((await ok.actions.listAccountDeletionRequests())[0].emailSent, true);
});

test('sole owners, and owners whose only co-owner is also leaving, are refused', async () => {
  const club = '00000000-0000-4000-8000-0000000000c1', other = '00000000-0000-4000-8000-0000000000b1';
  const sole = harness({ amrAgo: 0, passwordAccount: false, owners: [{ clubId: club, name: 'Rotunda Society', others: [] }] });
  await assert.rejects(sole.actions.requestAccountDeletion({ confirmation: 'DELETE' }), /Transfer ownership of Rotunda Society/);
  const race = harness({ amrAgo: 0, passwordAccount: false, owners: [{ clubId: club, name: 'Rotunda Society', others: [other] }] });
  race.reports.push({ id: 'r-other', kind: 'ACCOUNT_DELETION', targetId: other, status: 'OPEN', revision: 0, createdAt: new Date() });
  await assert.rejects(race.actions.requestAccountDeletion({ confirmation: 'DELETE' }), /other owner of Rotunda Society has also asked to delete/);
  race.reports[0].status = 'DISMISSED';
  await race.actions.requestAccountDeletion({ confirmation: 'DELETE' });
});

test('admin completion turns the owner-guard trigger error into a clear message', async () => {
  const h = harness({ amrAgo: 0, passwordAccount: false, deletionError: Error('Assign another active owner before suspending this account') });
  await h.actions.requestAccountDeletion({ confirmation: 'DELETE' });
  const row = h.reports[0]; row.createdAt = new Date(Date.now() - 15 * DAY);
  await assert.rejects(h.actions.completeAccountDeletion({ id: row.id, revision: row.revision, reason: 'Window elapsed; completing.' }), /^Error: only active owner$/);
});

test('cancel works within 14 days and not after', async () => {
  const h = harness({ amrAgo: 0, passwordAccount: false });
  await h.actions.requestAccountDeletion({ confirmation: 'DELETE' });
  h.reports[0].createdAt = new Date(Date.now() - 13 * DAY);
  await h.actions.cancelAccountDeletion();
  assert.equal(h.reports[0].status, 'DISMISSED');
  assert.ok(h.logs.some(l => l.action === 'account.deletion.cancelled'));
  assert.equal((await h.actions.getAccountDeletionRequest()).pending, null);
  await h.actions.requestAccountDeletion({ confirmation: 'DELETE' });
  h.reports[1].createdAt = new Date(Date.now() - 15 * DAY);
  await assert.rejects(h.actions.cancelAccountDeletion(), /can no longer be cancelled/);
});

test('admin completion is fresh-admin only, waits for the window, and is audited', async () => {
  const h = harness({ amrAgo: 0, passwordAccount: false });
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

function procedureHarness({ apps = [], members = [], authFails = 0, txFails = false } = {}) {
  const calls = [], removed = [], audit = [], events = [];
  let authCalls = 0;
  const user = { id: userId, email: 'student@virginia.edu', disabledAt: null };
  const store = { answers: [], letters: [], observations: [], evaluations: [] };
  const countsFor = app => ({
    evaluations: store.evaluations.filter(e => e.applicationId === app.id).length, interviewRecords: 0, votingCandidates: 0, interviewAssignments: 0,
    resumeDocuments: app.resumeDocuments || 0, decisionLetters: store.letters.filter(l => l.applicationId === app.id).length,
    observations: store.observations.filter(o => o.applicationId === app.id).length,
  });
  const op = (model, name) => async args => {
    calls.push([model, name, args]);
    if (model === 'application' && name === 'findMany') return apps.map(app => ({ id: app.id, status: app.status, recruitmentOffer: null, _count: countsFor(app) }));
    if (model === 'application' && name === 'deleteMany') { for (const id of args.where.id.in) apps.splice(apps.findIndex(a => a.id === id), 1); return { count: 1 }; }
    if (model === 'application' && name === 'updateMany') { for (const app of apps) if (args.where.id.in.includes(app.id)) Object.assign(app, args.data); return { count: 1 }; }
    if (model === 'applicationAnswer' && name === 'deleteMany') { store.answers = store.answers.filter(a => !args.where.applicationId.in.includes(a.applicationId)); return { count: 1 }; }
    if (model === 'clubMember' && name === 'findMany') return members;
    return { count: 1 };
  };
  const models = ['studentProfile', 'eventRsvp', 'savedCampusEvent', 'corkboardClub', 'userTutorial', 'userAvailability', 'editorDraft', 'calendarFeedToken', 'recipientGroupEntry', 'userNotification', 'notificationEmailDelivery', 'userNotificationPreference', 'clubConversation', 'taskAssignment', 'clubTask', 'clubClaim', 'adminElevationChallenge', 'platformAdmin', 'rosterImportRow', 'application', 'applicationAnswer', 'clubMember', 'platformReport'];
  const auditModel = { create: async ({ data }) => { audit.push(data); }, findMany: async ({ where }) => audit.filter(r => r.targetId === where.targetId && r.action === where.action) };
  const db = {
    $transaction: async fn => {
      // Snapshot so a thrown transaction rolls back like Postgres would.
      const before = JSON.stringify({ user, apps, store, audit });
      const tx = { $queryRaw: async () => [], auditLog: auditModel, user: { update: async ({ data }) => { if (txFails) throw Error('trigger refused'); events.push('tombstone'); Object.assign(user, data); } } };
      for (const m of models) tx[m] = new Proxy({}, { get: (_, name) => op(m, name) });
      try { return await fn(tx); } catch (error) {
        const old = JSON.parse(before); Object.assign(user, old.user); apps.splice(0, apps.length, ...old.apps); Object.assign(store, old.store); audit.splice(0, audit.length, ...old.audit);
        throw error;
      }
    },
    user: { findUnique: async () => user, update: async ({ data }) => Object.assign(user, data) },
    platformAdmin: { findUnique: async () => null },
    taskFile: { findMany: async () => [{ path: 'assignment-1/file' }] },
    auditLog: auditModel,
  };
  const services = {
    listObjects: async (bucket, prefix) => bucket === 'resumes' ? [`${prefix}/resume.pdf`] : [`${prefix}/face.png`],
    removeObjects: async (bucket, paths) => { events.push('storage:' + bucket); removed.push([bucket, paths]); },
    deleteAuthUser: async () => { authCalls++; events.push('auth'); if (authCalls <= authFails) throw Error('auth admin unavailable'); },
  };
  const { performAccountDeletion } = loader({ '@supabase/supabase-js': { createClient: () => ({}) } })('utils/account-deletion.ts');
  return { run: () => performAccountDeletion(db, userId, { actorId: adminId, reportId: 'report-1', reason: 'Completed after window.' }, services), calls, removed, audit, events, user, apps, store, authCalls: () => authCalls };
}

test('deletion procedure deletes personal data, anonymizes club records and deletes the Auth user', async () => {
  const h = procedureHarness({
    apps: [{ id: 'draft', status: 'DRAFTING' }, { id: 'decided', status: 'REJECTED' }],
    members: [
      { id: 'quiet', _count: { evaluations: 0, interviewRecords: 0, interviewAssignments: 0, resumeAnnotations: 0, votingParticipants: 0, availabilityOverrides: 0 } },
      { id: 'voter', _count: { evaluations: 2, interviewRecords: 0, interviewAssignments: 0, resumeAnnotations: 0, votingParticipants: 1, availabilityOverrides: 0 } },
    ],
  });
  h.store.evaluations.push({ applicationId: 'decided' });
  const result = await h.run();
  assert.deepEqual(result, { userId, storageObjects: 3, deletedApplications: 1, anonymizedApplications: 1, deletedMemberships: 1, anonymizedMemberships: 1, retainedDecisionLetters: 0, retainedResumeSnapshots: 0, authDeleted: true });
  assert.deepEqual(h.removed, [['resumes', [`${userId}/resume.pdf`]], ['headshots', [`${userId}/face.png`]], ['task-submissions', ['assignment-1/file']]]);
  const find = (model, name) => h.calls.filter(c => c[0] === model && c[1] === name).map(c => c[2]);
  assert.deepEqual(find('application', 'deleteMany')[0].where.id.in, ['draft']);
  assert.deepEqual(find('clubMember', 'deleteMany')[0].where.id.in, ['quiet']);
  assert.equal(find('clubMember', 'updateMany')[0].data.status, 'LEFT');
  assert.ok(find('studentProfile', 'deleteMany').length && find('calendarFeedToken', 'deleteMany').length);
  const notif = h.calls.findIndex(c => c[0] === 'userNotification'), delivery = h.calls.findIndex(c => c[0] === 'notificationEmailDelivery');
  assert.ok(notif < delivery, 'outbox rows go with notifications before deliveries');
  assert.equal(h.user.email, `deleted-${userId}@deleted.outclass.invalid`);
  assert.ok(h.user.disabledAt);
  assert.equal(h.audit.at(-1).action, 'account.deletion.completed');
  assert.equal(h.audit.at(-1).details.authDeleted, true);
  assert.equal(h.audit.at(-1).actorId, adminId);
  assert.ok(find('platformReport', 'updateMany').length, 'request resolved');
  await h.run();
  assert.equal(h.authCalls(), 2, 'idempotent re-run');
});

test('Storage is removed only after the transaction commits; a rollback leaves every file', async () => {
  const ok = procedureHarness();
  await ok.run();
  assert.ok(ok.events.indexOf('tombstone') < ok.events.indexOf('storage:resumes'));
  assert.ok(ok.events.indexOf('storage:task-submissions') < ok.events.indexOf('auth'));
  const failing = procedureHarness({ txFails: true });
  await assert.rejects(failing.run(), /trigger refused/);
  assert.deepEqual(failing.removed, []);
  assert.equal(failing.authCalls(), 0);
  assert.equal(failing.user.email, 'student@virginia.edu');
});

test('a seeded ACCEPTED application keeps the club’s notes and decision, loses answers; immutable letters are reported', async () => {
  const h = procedureHarness({ apps: [{ id: 'accepted', status: 'ACCEPTED', studentId: userId, anonymousReviewText: 'I led the robotics team…', resumeDocuments: 1 }] });
  h.store.answers.push({ applicationId: 'accepted', response: 'Why I want to join…' }, { applicationId: 'accepted', response: `${userId}/attachment.pdf` });
  h.store.letters.push({ applicationId: 'accepted', decision: 'ACCEPTED', content: { salutation: 'Dear Jordan', body: 'Welcome!' } });
  h.store.observations.push({ applicationId: 'accepted', authorId: adminId, body: 'Strong case interview.' });
  h.store.evaluations.push({ applicationId: 'accepted', score: 9, notes: 'Leader rubric notes' });
  const result = await h.run();
  const [app] = h.apps;
  assert.equal(app.id, 'accepted');
  assert.equal(app.status, 'ACCEPTED', 'decision outcome kept');
  assert.equal(app.studentId, userId, 'linked to the tombstone User');
  assert.equal(h.user.email, `deleted-${userId}@deleted.outclass.invalid`);
  assert.equal(app.anonymousReviewText, null);
  assert.deepEqual(h.store.answers, [], 'answers removed');
  assert.deepEqual(h.store.observations, [{ applicationId: 'accepted', authorId: adminId, body: 'Strong case interview.' }], 'club’s own observation kept');
  assert.equal(h.store.evaluations[0].notes, 'Leader rubric notes');
  // DecisionLetter and InterviewResumeDocument are trigger-immutable: kept and reported, never claimed as removed.
  assert.equal(h.store.letters[0].content.salutation, 'Dear Jordan');
  assert.equal(result.retainedDecisionLetters, 1);
  assert.equal(result.retainedResumeSnapshots, 1);
  assert.equal(h.audit.at(-1).details.retainedDecisionLetters, 1);
  assert.ok(h.removed.some(([bucket, paths]) => bucket === 'resumes' && paths.length), 'answer attachments under the user prefix are removed');
});

test('a failed Auth delete is retried, recorded, leaves the request open, and an old session cannot restore the email', async () => {
  const h = procedureHarness({ authFails: 99 });
  const result = await h.run();
  assert.equal(result.authDeleted, false);
  assert.equal(h.authCalls(), 3, 'retried');
  assert.equal(h.audit.at(-1).action, 'account.deletion.incomplete');
  assert.equal(h.audit.at(-1).details.authDeleted, false);
  assert.equal(h.calls.filter(c => c[0] === 'platformReport').length, 0, 'request not resolved');
  const dummy = h.user.email;
  // The still-valid provider session now calls requireAuth.
  let upserts = 0;
  const auth = loader({
    '@/lib/server-phase-trace': { serverPhase: (_n, fn) => fn() },
    '@/lib/club-suspension': { assertClubOperational: async () => {} },
    '@supabase/supabase-js': { createClient: () => ({}) },
    '@/utils/platform-view-as': { platformViewSession: async () => null },
    '@/lib/demo/access': { DEMO_COOKIE: 'outclass-demo-session' },
    '@/lib/auth': { isUvaEmail: e => e.endsWith('@virginia.edu') },
    '@/lib/auth-session': { sessionIdFromVerifiedToken: () => '00000000-0000-4000-8000-00000000005e' },
    './supabase/server': { createClient: async () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }), getUser: async () => ({ data: { user: { id: userId, email: 'student@virginia.edu', email_confirmed_at: '2026-01-01' } }, error: null }) } }) },
    './prisma': { prisma: { $queryRaw: async () => [{ live: true }], user: { findUnique: async () => ({ ...h.user }), upsert: async ({ update }) => { upserts++; Object.assign(h.user, update); return { ...h.user }; } } } },
    'next/headers': { cookies: async () => ({ has: () => false, get: () => undefined }), headers: async () => new Map() },
    'next/navigation': { redirect: () => { throw Error('NEXT_REDIRECT'); } },
    'react': { cache: fn => fn },
  })('utils/auth.ts');
  await assert.rejects(auth.requireAuth(), /NEXT_REDIRECT/);
  assert.equal(upserts, 0);
  assert.equal(h.user.email, dummy);
  // A later run finishes the job.
  const retry = procedureHarness();
  Object.assign(retry.user, h.user);
  assert.equal((await retry.run()).authDeleted, true);
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
  assert.match(ui, /Your profile, résumé, headshot, files and in-progress applications are deleted\./);
  assert.match(ui, /the club keeps its own review notes and the decision, linked to an anonymized placeholder\. Your answers are removed\./);
  assert.match(ui, /Decision letters and interview copies of your résumé that a club already holds stay/);
});
