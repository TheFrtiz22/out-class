const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const { Actor, totp } = require('./helpers/onboarding-e2e.cjs');
const filename = process.env.OUTCLASS_ADMIN_SESSION_E2E_CONFIG;

test('real local Admin session survives elevation, navigation and refresh and rejects revoked authority', { skip: !filename }, async t => {
  const c = JSON.parse(fs.readFileSync(filename));
  assert.equal(c.projectId, 'outclass-corkboard-e2e');
  for (const [value, port] of [[c.status.API_URL, '56321'], [c.status.DB_URL, '56322']]) {
    const url = new URL(value);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.port, port, 'Only the dedicated disposable services are permitted');
  }
  c.appUrl = 'http://127.0.0.1:3109';
  c.buildDir = path.resolve('.next-publish');
  const db = new PrismaClient({ datasourceUrl: c.status.DB_URL });
  t.after(() => db.$disconnect());
  const admin = new Actor(c), student = new Actor(c);
  await admin.signIn(c.identities.admin.email, c.identities.admin.password);
  await student.signIn(c.identities.student.email, c.identities.student.password);
  const currentAuth = () => { const actor = new Actor(c); actor.cookies = new Map(admin.cookies); return actor; };
  const post = body => admin.request('/api/platform/elevation', {
    method: 'POST', headers: { origin: c.appUrl, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  async function denied(actor, route = '/platform') {
    const response = await actor.request(route), html = await response.text();
    if (response.status === 307) assert.equal(response.headers.get('location'), '/platform/login');
    else {
      assert.equal(response.status, 200);
      assert.match(html, /http-equiv="refresh"|NEXT_REDIRECT/);
      assert.match(html, /platform\/login/);
    }
    assert.ok(!html.includes('Needs Attention'), 'Denied requests must not render protected overview data');
  }
  async function allowed(route) {
    const response = await admin.request(route), html = await response.text();
    assert.equal(response.status, 200, route);
    assert.ok(!/http-equiv="refresh"|NEXT_REDIRECT/.test(html), route + ' must not silently redirect');
    assert.match(html, /Admin workspace/);
    if (route === '/platform') assert.match(html, /Needs Attention/);
    return html;
  }
  await t.test('non-Admin and unelevated Admin are denied', async () => {
    await denied(student); await denied(admin);
    assert.equal((await (await student.request('/api/platform/eligibility')).json()).eligible, false);
    assert.equal((await (await admin.request('/api/platform/eligibility')).json()).eligible, true);
  });
  await t.test('a matching live elevation cannot substitute for AAL2', async () => {
    assert.equal((await admin.client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel, 'aal1');
    const { data } = await admin.client.auth.getClaims();
    const token = randomBytes(32).toString('hex'), now = new Date();
    const row = await db.adminElevation.create({ data: {
      actorId: c.identities.admin.id, authSessionId: data.claims.session_id,
      tokenHash: createHash('sha256').update(token).digest('hex'), factorId: c.identities.admin.factorId,
      passwordVerifiedAt: now, mfaVerifiedAt: now, expiresAt: new Date(Date.now() + 60000),
    } });
    admin.cookies.set('outclass-admin-elevation', token);
    try { await denied(admin); }
    finally {
      await db.adminElevation.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
      admin.cookies.delete('outclass-admin-elevation');
    }
  });
  const originalSessionId = (await admin.client.auth.getClaims()).data.claims.session_id;
  await t.test('password plus MFA upgrades the original AAL1 sign-in and persists both cookies', async () => {
    const begin = await post({ action: 'password', password: c.identities.admin.password });
    assert.equal(begin.status, 200, await begin.text());
    const verify = await post({ action: 'verify', code: totp(c.identities.admin.totpSecret) });
    assert.equal(verify.status, 200, await verify.text());
    assert.ok(admin.cookies.get('outclass-admin-elevation'));
    assert.equal((await currentAuth().client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel, 'aal2');
    assert.notEqual((await currentAuth().client.auth.getClaims()).data.claims.session_id, originalSessionId);
    await allowed('/platform');
  });
  const elevation = await db.adminElevation.findFirstOrThrow({
    where: { actorId: c.identities.admin.id, revokedAt: null }, orderBy: { createdAt: 'desc' },
  });
  await t.test('all protected sections and repeated server renders stay authorized', async () => {
    for (const section of ['', '/users', '/clubs', '/corkboard', '/applications', '/events', '/claims', '/onboarding', '/support', '/activity', '/permissions', '/settings', '/audit']) {
      await allowed('/platform' + section);
    }
    await allowed('/platform'); await allowed('/platform/users'); await allowed('/platform');
    const users = await admin.action('actions/platform-admin.ts', 'readPlatformResource', ['users', 0, {}]);
    assert.ok(users.some(user => user.id === c.identities.admin.id));
  });
  await t.test('provider token refresh retains the session binding and Admin access', async () => {
    const refreshedActor = currentAuth();
    const before = (await refreshedActor.client.auth.getClaims()).data.claims.session_id;
    const refreshed = await refreshedActor.client.auth.refreshSession();
    assert.equal(refreshed.error, null);
    assert.equal((await refreshedActor.client.auth.getClaims()).data.claims.session_id, before);
    admin.cookies = new Map(refreshedActor.cookies);
    await allowed('/platform');
  });
  await t.test('expired elevation is denied and restoring the test expiry restores access', async () => {
    try {
      await db.adminElevation.update({ where: { id: elevation.id }, data: { passwordVerifiedAt: new Date(0), mfaVerifiedAt: new Date(1), createdAt: new Date(1), expiresAt: new Date(2) } });
      await denied(admin);
    } finally { await db.adminElevation.update({ where: { id: elevation.id }, data: { passwordVerifiedAt: elevation.passwordVerifiedAt, mfaVerifiedAt: elevation.mfaVerifiedAt, createdAt: elevation.createdAt, expiresAt: elevation.expiresAt } }); }
    await allowed('/platform');
  });
  await t.test('revoked PlatformAdmin grant is denied', async () => {
    try {
      await db.platformAdmin.update({ where: { userId: c.identities.admin.id }, data: { active: false } });
      await denied(admin);
    } finally { await db.platformAdmin.update({ where: { userId: c.identities.admin.id }, data: { active: true } }); }
    await allowed('/platform');
  });
  await t.test('impersonation marker blocks Admin routes and operations', async () => {
    admin.cookies.set('outclass-platform-view', 'a'.repeat(64));
    try {
      await denied(admin);
      await assert.rejects(admin.action('actions/platform-admin.ts', 'readPlatformResource', ['users', 0, {}]));
      assert.equal((await post({ action: 'password', password: c.identities.admin.password })).status, 403);
    } finally { admin.cookies.delete('outclass-platform-view'); }
    await allowed('/platform');
  });
  await t.test('a closed provider session denies still-unexpired elevation and captured JWT cookies', async () => {
    const session = (await currentAuth().client.auth.getSession()).data.session;
    assert.ok(session);
    const service = createClient(c.status.API_URL, c.status.SECRET_KEY || c.status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await service.auth.admin.signOut(session.access_token, 'local')).error, null);
    assert.equal((await db.adminElevation.findUniqueOrThrow({ where: { id: elevation.id } })).revokedAt, null);
    await denied(admin);
  });
  await t.test('logout revokes the durable elevation and denies a captured cookie replay', async () => {
    const replay = new Actor(c); replay.cookies = new Map(admin.cookies);
    const response = await admin.request('/api/auth/logout', { method: 'POST', headers: { origin: c.appUrl } });
    assert.equal(response.status, 200);
    assert.ok((await db.adminElevation.findUniqueOrThrow({ where: { id: elevation.id } })).revokedAt);
    await denied(admin); await denied(replay);
  });
});
