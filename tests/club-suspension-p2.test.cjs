const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createHash } = require('node:crypto');

function loader(mocks) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function('require', 'module', 'exports', code)(name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
      if (name === './prisma') return mocks['@/utils/prisma'];
      if (name === './supabase/server') return mocks['@/utils/supabase/server'];
      return require(name);
    }, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
const clubId = '00000000-0000-4000-8000-000000000001';
const invitationId = '00000000-0000-4000-8000-000000000002';
const actorId = '00000000-0000-4000-8000-000000000003';
const rosterId = '00000000-0000-4000-8000-000000000004';

test('direct application start rejects suspension under the existing transaction lock; active creation and existing application remain valid', async () => {
  let suspended = true, existing = null, created = [], inTransaction = false;
  const queries = [];
  const tx = {
    $queryRaw: async strings => { assert.equal(inTransaction, true); const sql = strings.join(''); queries.push(sql); return sql.includes('"suspendedAt"') && suspended ? [{ id: clubId }] : []; },
    application: { findUnique: async () => existing, upsert: async ({ create }) => { created.push(create); return { id: 'draft' }; } },
    club: { findUnique: async () => ({ applicationOpen: true, applicationDeadline: null }) },
    pipelineRound: { findFirst: async () => ({ id: 'round' }) },
  };
  const prisma = { $transaction: async fn => { inTransaction = true; try { return await fn(tx); } finally { inTransaction = false; } } };
  const api = loader({ '@/utils/prisma': { prisma }, '@/utils/auth': { requireAuth: async () => ({ user: { id: actorId } }) }, 'next/cache': { unstable_cache: fn => fn } })('actions/club-directory.ts');
  await assert.rejects(api.startClubApplication(clubId), /club is suspended/);
  assert.equal(created.length, 0); assert.match(queries[0], /FOR UPDATE/);
  suspended = false;
  assert.deepEqual(await api.startClubApplication(clubId), { applicationId: 'draft' });
  assert.equal(created[0].status, 'DRAFTING');
  existing = { id: 'existing' }; suspended = true;
  assert.deepEqual(await api.startClubApplication(clubId), { applicationId: 'existing' });
  assert.equal(created.length, 1);
});

function workspaceHarness({ demo = true, allowed = true, providerError = false, impersonating = false, suspended = false, liveDenied = false } = {}) {
  let liveReads = 0, providerReads = 0;
  function Workspace() {} function Boundary() {}
  const mocks = {
    'next/headers': { cookies: async () => ({ has: key => key === 'outclass-platform-view' && impersonating, get: key => key === 'outclass-demo-session' && demo ? { value: '1' } : undefined }) },
    '@/utils/auth': { getSessionUser: async () => { providerReads++; return { data: { user: { email: 'presenter@virginia.edu' } }, error: providerError ? Error('expired') : null }; } },
    '@/lib/demo/access': { DEMO_COOKIE: 'outclass-demo-session', canAccessDemo: email => allowed && email === 'presenter@virginia.edu' },
    '@/utils/current-user': { getCurrentUser: async () => { liveReads++; if (liveDenied) throw Error('Live authorization denied'); return { memberships: [{ clubId, club: { name: 'Club', suspendedAt: suspended ? new Date() : null } }] }; } },
    '@/components/club-workspace': { ClubWorkspace: Workspace },
    '@/components/auth-session-boundary': { AuthSessionBoundary: Boundary },
    'next/link': { default: () => null },
  };
  const page = loader(mocks)('app/club/[clubId]/workspace/page.tsx').default;
  return { render: () => page({ params: Promise.resolve({ clubId }), searchParams: Promise.resolve({ section: 'members' }) }), Workspace, Boundary, liveReads: () => liveReads, providerReads: () => providerReads };
}
test('authorized Demo workspace renders its existing client boundary without live identity reads', async () => {
  const h = workspaceHarness({ liveDenied: true }); const result = await h.render();
  assert.equal(result.type, h.Boundary); assert.equal(result.props.children.type, h.Workspace);
  assert.equal(result.props.children.props.section, 'members'); assert.equal(h.liveReads(), 0); assert.equal(h.providerReads(), 1);
});
test('live workspace retains live authorization and suspension view', async () => {
  const h = workspaceHarness({ demo: false }); assert.equal((await h.render()).type, h.Boundary); assert.equal(h.liveReads(), 1);
  const paused = workspaceHarness({ demo: false, suspended: true }); assert.equal((await paused.render()).type, 'main');
  await assert.rejects(workspaceHarness({ demo: false, liveDenied: true }).render(), /Live authorization denied/);
});
test('stale or unauthorized Demo cookies and impersonation cannot skip live authorization', async () => {
  for (const patch of [{ allowed: false }, { providerError: true }, { impersonating: true }]) {
    const h = workspaceHarness({ ...patch, liveDenied: true }); await assert.rejects(h.render(), /Live authorization denied/); assert.equal(h.liveReads(), 1);
  }
});

function invitationHarness(patch = {}) {
  const state = { aal: 'aal2', elevated: true, expired: false, revoked: false, liveSession: true, grant: true, disabled: false, verified: true, impersonating: false, member: false, ...patch };
  const token = 'a'.repeat(64), deliveries = [], audits = [], scheduled = [], sent = [];
  const invitation = { id: invitationId, clubId, requestedRole: patch.leader ? 'MEMBER' : 'OWNER', permissions: [], authoritySource: 'PLATFORM_ADMIN', invitedBy: actorId, status: 'PENDING', email: 'leader@virginia.edu', expiresAt: new Date(Date.now() + 86400000), club: { name: 'Club' } };
  const owner = { isOwner: !patch.leader, status: 'ACTIVE', permissions: patch.leader ? ['members.manage'] : [] };
  const model = {
    findUnique: async ({ where }) => deliveries.find(d => where.id ? d.id === where.id : d.idempotencyKey === where.idempotencyKey) || null,
    findFirst: async () => null,
    count: async () => 0,
    create: async ({ data }) => { const d = { id: 'delivery', status: 'QUEUED', ...data }; deliveries.push(d); return d; },
    createMany: async ({ data }) => { for (const d of data) await model.create({ data: d }); },
    findMany: async () => deliveries,
    findUniqueOrThrow: async () => ({ ...deliveries[0], invitation }),
    update: async ({ data }) => Object.assign(deliveries[0], data),
  };
  const prisma = {
    $queryRaw: async strings => strings.join('').includes('auth.sessions') ? state.liveSession ? [{ id: 'session' }] : [] : [],
    user: { findUnique: async () => ({ id: actorId, email: 'admin@virginia.edu', disabledAt: state.disabled ? new Date() : null }) },
    clubMember: { findUnique: async () => state.member ? owner : null },
    platformAdmin: { findUnique: async () => ({ active: state.grant }) },
    adminElevation: { findUnique: async ({ where }) => { assert.equal(where.tokenHash, createHash('sha256').update(token).digest('hex')); return { actorId, authSessionId: 'session', expiresAt: new Date(Date.now() + (state.expired ? -1000 : 60000)), revokedAt: state.revoked ? new Date() : null, passwordVerifiedAt: new Date(Date.now() - 2000), mfaVerifiedAt: new Date(Date.now() - 1000) }; } },
    club: { findUnique: async () => ({ invitationEmailEnabled: true }) },
    clubInvitation: { findFirst: async () => invitation, findMany: async () => [invitation], update: async () => invitation },
    rosterImport: { findUniqueOrThrow: async () => ({ id: rosterId, clubId, status: 'COMPLETED' }) },
    rosterImportRow: { findMany: async () => [{ invitationId }] },
    invitationDelivery: model,
    auditLog: { create: async ({ data }) => audits.push(data) },
  };
  prisma.$transaction = async fn => fn(prisma);
  const provider = { auth: {
    getUser: async () => ({ data: { user: { id: actorId, email: 'admin@virginia.edu', email_confirmed_at: state.verified ? '2026-01-01' : null } } }),
    getClaims: async () => ({ data: { claims: { session_id: 'session' } } }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: state.aal } }) },
  } };
  const load = loader({
    '@/utils/prisma': { prisma }, '@/utils/supabase/server': { createClient: async () => provider },
    '@/utils/platform-view-as': { platformViewSession: async () => ({ targetUserId: actorId }) },
    'next/headers': { cookies: async () => ({ has: key => key === 'outclass-platform-view' && state.impersonating, get: key => key === 'outclass-admin-elevation' && state.elevated ? { value: token } : undefined }) },
    'next/navigation': { redirect: () => { throw Error('Authentication required'); } },
    '@/utils/email': { invitationEmailConfig() {}, sendInvitationEmail: async message => { sent.push(message); return { messageId: 'local' }; } },
    '@/utils/invitation-background': { scheduleInvitationDelivery: id => scheduled.push(id) },
  });
  return { state, deliveries, audits, scheduled, sent, api: load('actions/invitation-emails.ts'), worker: load('utils/invitation-delivery.ts') };
}
async function adminConfigured(fn) {
  const old = process.env.OUTCLASS_PLATFORM_ADMIN_IDS;
  process.env.OUTCLASS_PLATFORM_ADMIN_IDS = actorId;
  try { await fn(); } finally { if (old === undefined) delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS; else process.env.OUTCLASS_PLATFORM_ADMIN_IDS = old; }
}
const requests = h => [
  () => h.api.resendOrganizationInvitation(clubId, invitationId),
  () => h.api.sendRosterInvitations(rosterId),
  () => h.api.deliverOrganizationInvitations(clubId),
  () => h.api.requestInvitationDelivery(clubId),
];
test('all legacy invitation requests enforce actual Admin MFA, elevation, identity and no-impersonation guards', async () => adminConfigured(async () => {
  for (const patch of [{ aal: 'aal1' }, { elevated: false }, { expired: true }, { revoked: true }, { liveSession: false }, { grant: false }, { disabled: true }, { verified: false }, { impersonating: true }]) {
    const h = invitationHarness(patch);
    for (const invoke of requests(h)) await assert.rejects(invoke());
    assert.equal(h.deliveries.length, 0, JSON.stringify(patch)); assert.equal(h.scheduled.length, 0); assert.equal(h.sent.length, 0);
  }
}));
test('appropriately elevated Admin can use every legacy invitation request; worker uses durable grants after request elevation expires', async () => adminConfigured(async () => {
  for (let i = 0; i < 4; i++) { const h = invitationHarness(); await requests(h)[i](); }
  const h = invitationHarness(); await h.api.resendOrganizationInvitation(clubId, invitationId);
  assert.equal(h.deliveries.length, 1); h.state.elevated = false;
  assert.equal((await h.worker.processInvitationEmails(clubId)).sent, 1);
  const revoked = invitationHarness(); await revoked.api.resendOrganizationInvitation(clubId, invitationId); revoked.state.grant = false;
  assert.equal((await revoked.worker.processInvitationEmails(clubId)).cancelled, 1); assert.equal(revoked.sent.length, 0);
}));
test('ordinary club owner/leader invitation authority is preserved; non-allowlisted outsiders are denied', async () => {
  const old = process.env.OUTCLASS_PLATFORM_ADMIN_IDS; delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS;
  try {
    for (const leader of [false, true]) {
      const h = invitationHarness({ member: true, leader, elevated: false, aal: 'aal1' });
      await h.api.resendOrganizationInvitation(clubId, invitationId); assert.equal(h.deliveries.length, 1);
    }
    const outsider = invitationHarness();
    for (const invoke of requests(outsider)) await assert.rejects(invoke());
    assert.equal(outsider.deliveries.length, 0);
  }
  finally { if (old !== undefined) process.env.OUTCLASS_PLATFORM_ADMIN_IDS = old; }
});
