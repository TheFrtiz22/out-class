const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const { Actor, readConfig, randomUUID } = require('./helpers/onboarding-e2e.cjs');
const filename = process.env.OUTCLASS_RUNTIME_ROLE_E2E_CONFIG;
const denied = error => error.code === 'P2010' && error.meta?.code === '42501';

test('restricted runtime through real Auth, SQL locks, private Storage and Next actions', { skip: !filename, timeout: 90000 }, async t => {
 const c = readConfig(filename); assert.ok(c.runtimeDatabaseUrl);
 const op = new PrismaClient({ datasourceUrl: c.status.DB_URL });
 const db = new PrismaClient({ datasourceUrl: c.runtimeDatabaseUrl });
 t.after(async () => { await db.$disconnect(); await op.$disconnect(); });
 const service = createClient(c.status.API_URL, c.status.SECRET_KEY, { auth: { persistSession: false } });
 const people = [];
 for (const label of ['owner', 'foreign']) {
  const email = `role.${label}.${randomUUID()}@virginia.edu`, password = 'Disposable-only!' + randomUUID();
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true }); assert.equal(error, null);
  await op.user.create({ data: { id: data.user.id, email, studentProfile: { create: { firstName: 'Synthetic', lastName: label, computingId: email.split('@')[0], major: 'Economics', gradYear: 2028 } } } });
  const actor = new Actor(c); await actor.signIn(email, password); people.push(actor);
 }
 const [owner, foreign] = people;
 const club = await op.club.create({ data: { slug: randomUUID(), name: 'Runtime role fixture', tagline: '', description: '', category: 'Other', color: '#142d45' } });
 await op.clubMember.create({ data: { clubId: club.id, userId: owner.user.id, isOwner: true } });
 const session = (await owner.client.auth.getSession()).data.session;
 const sessionId = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url')).session_id;

 await t.test('actual connection is bounded; operator history, DDL, Auth secrets and unrelated columns deny', async () => {
  const [role] = await db.$queryRaw`SELECT current_user,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,
    has_schema_privilege(current_user,'public','CREATE') creates_public,
    has_schema_privilege(current_user,'auth','CREATE') creates_auth,
    has_schema_privilege(current_user,'storage','CREATE') creates_storage,
    pg_has_role(current_user,'postgres','MEMBER') operator_member,
    pg_has_role('anon',current_user,'MEMBER') anon_member,
    pg_has_role('authenticated',current_user,'MEMBER') authenticated_member
    FROM pg_roles WHERE rolname=current_user`;
  assert.deepEqual(role, { current_user: 'outclass_production_app', rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, creates_public: false, creates_auth: false, creates_storage: false, operator_member: false, anon_member: false, authenticated_member: false });
  for (const sql of ['SELECT * FROM public._prisma_migrations LIMIT 0', 'SELECT encrypted_password FROM auth.users LIMIT 0', 'SELECT refresh_token_hmac_key FROM auth.sessions LIMIT 0', 'SELECT * FROM auth.sessions LIMIT 0', 'SELECT * FROM storage.objects LIMIT 0', 'CREATE TABLE public.runtime_role_forbidden(id int)']) {
   await assert.rejects(db.$queryRawUnsafe(sql), denied);
  }
 });
 await t.test('three session columns and FOR SHARE work while all session mutations deny and rows stay identical', async () => {
  const before = await op.$queryRaw`SELECT id,user_id,updated_at,not_after FROM auth.sessions WHERE id=${sessionId}::uuid`;
  const rows = await db.$transaction(tx => tx.$queryRaw`SELECT id FROM auth.sessions WHERE id=${sessionId}::uuid AND user_id=${owner.user.id}::uuid AND (not_after IS NULL OR not_after>clock_timestamp()) FOR SHARE`);
  assert.equal(rows.length, 1);
  // A real operator DELETE must wait on that shared row lock, then abort on budget.
  await db.$transaction(async tx => {
   await tx.$queryRaw`SELECT id FROM auth.sessions WHERE id=${sessionId}::uuid FOR SHARE`;
   await assert.rejects(op.$transaction(async other => {
    await other.$executeRaw`SET LOCAL lock_timeout='150ms'`;
    await other.$executeRaw`DELETE FROM auth.sessions WHERE id=${sessionId}::uuid`;
   }), error => error.code === 'P2010' && error.meta?.code === '55P03');
  });
  for (const sql of [
   `UPDATE auth.sessions SET updated_at=clock_timestamp() WHERE id='${sessionId}'::uuid`,
   `UPDATE auth.sessions SET not_after=NULL WHERE id='${sessionId}'::uuid`,
   `DELETE FROM auth.sessions WHERE id='${sessionId}'::uuid`,
   `INSERT INTO auth.sessions(id,user_id) VALUES('${randomUUID()}','${owner.user.id}')`,
  ]) await assert.rejects(db.$executeRawUnsafe(sql), denied);
  await op.$executeRawUnsafe('CREATE POLICY fixture_permissive_update ON auth.sessions FOR UPDATE TO outclass_production_app USING(true) WITH CHECK(true)');
  try { await assert.rejects(db.$executeRaw`UPDATE auth.sessions SET updated_at=clock_timestamp() WHERE id=${sessionId}::uuid`, denied); }
  finally { await op.$executeRawUnsafe('DROP POLICY fixture_permissive_update ON auth.sessions'); }
  assert.deepEqual(await op.$queryRaw`SELECT id,user_id,updated_at,not_after FROM auth.sessions WHERE id=${sessionId}::uuid`, before);
 });
 await t.test('private upload, assignment and read work; foreign, anonymous and direct browser writes deny', async () => {
  const image = await require('sharp')({ create: { width: 20, height: 10, channels: 3, background: '#216543' } }).png().toBuffer();
  const form = () => { const f = new FormData(); f.set('clubId', club.id); f.set('admin', 'false'); f.set('file', new File([image], 'safe.png', { type: 'image/png' })); return f; };
  const uploaded = await owner.action('actions/club-assets.ts', 'uploadClubAsset', [form()]);
  assert.ok(uploaded.reference.startsWith(`club-assets/${club.id}/`));
  const next = { clubId: club.id, name: club.name, tagline: '', description: '', logoUrl: uploaded.reference };
  assert.deepEqual(await owner.action('actions/club-workspace.ts', 'updateClubSettings', [next]), { success: true });
  await assert.rejects(foreign.action('actions/club-workspace.ts', 'updateClubSettings', [next]));
  await assert.rejects(foreign.action('actions/club-assets.ts', 'uploadClubAsset', [form()]));
  const preview = '/api/club-assets?reference=' + encodeURIComponent(uploaded.reference) + '&preview=1';
  assert.equal((await owner.request(preview)).status, 200);
  assert.equal((await foreign.request(preview)).status, 404);
  assert.equal((await new Actor(c).request(preview)).status, 404);
  const anon = createClient(c.status.API_URL, c.status.PUBLISHABLE_KEY, { auth: { persistSession: false } });
  for (const client of [anon, owner.client]) {
   assert.ok((await client.storage.from('club-assets').upload(`${club.id}/${randomUUID()}.png`, image, { contentType: 'image/png' })).error);
   assert.ok((await client.storage.from('club-assets').update(uploaded.reference.slice(12), image, { contentType: 'image/png' })).error);
   await client.storage.from('club-assets').remove([uploaded.reference.slice(12)]);
   assert.equal((await service.storage.from('club-assets').download(uploaded.reference.slice(12))).error, null);
  }
  const otherPath = `${owner.user.id}/${randomUUID()}.png`;
  assert.equal((await service.storage.from('headshots').upload(otherPath, image, { contentType: 'image/png' })).error, null);
  assert.equal((await op.$queryRaw`SELECT name FROM storage.objects WHERE bucket_id='headshots' AND name=${otherPath}`).length, 1);
  assert.equal((await db.$queryRaw`SELECT name FROM storage.objects WHERE bucket_id='club-assets' AND name=${uploaded.reference.slice(12)}`).length, 1);
  assert.equal((await db.$queryRaw`SELECT name FROM storage.objects WHERE bucket_id<>'club-assets'`).length, 0);
  await assert.rejects(db.$executeRaw`UPDATE storage.objects SET name='forged' WHERE name=${uploaded.reference.slice(12)}`, denied);
  await assert.rejects(db.$executeRaw`DELETE FROM storage.objects WHERE name=${uploaded.reference.slice(12)}`, denied);
  for (const role of ['anon', 'authenticated']) await op.$transaction(async tx => {
   await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
   assert.equal((await tx.$queryRaw`SELECT name FROM storage.objects WHERE bucket_id='club-assets'`).length, 0);
   assert.equal((await tx.$queryRaw`SELECT id FROM storage.buckets WHERE id='club-assets'`).length, 0);
  });
 });
 await t.test('reviewed inverse restores the original guard and grants; reapply and inverse both succeed', async () => {
  const sql = name => fs.readFileSync(path.resolve(__dirname, '../docs/production-audit-2026-10-18/runtime-role', name), 'utf8');
  const run = input => {
   const r = spawnSync('docker', ['exec', '-i', 'supabase_db_outclass-onboarding-e2e', 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8' });
   assert.equal(r.status, 0, 'Reviewed local SQL must succeed without printing user data or credentials');
  };
  for (let i = 0; i < 2; i++) {
   run(sql('rollback.sql'));
   const [baseline] = await op.$queryRaw`SELECT has_schema_privilege('outclass_production_app','auth','USAGE') auth,
    has_schema_privilege('outclass_production_app','storage','USAGE') storage,
    has_any_column_privilege('outclass_production_app','auth.sessions','SELECT,UPDATE') sessions,
    has_any_column_privilege('outclass_production_app','storage.objects','SELECT') objects,
    (SELECT qual='(bucket_id <> ''club-assets''::text)' AND with_check=qual FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='outclass_club_assets_server_only') guard`;
   assert.deepEqual(baseline, { auth: false, storage: false, sessions: false, objects: false, guard: true });
   await assert.rejects(db.$queryRaw`SELECT id FROM auth.sessions LIMIT 0`, denied);
   const sentinel = {};
   const api = require('./helpers/communications-loader.cjs').loader({ 'server-only': {}, '@/utils/prisma': { prisma: op }, '@supabase/supabase-js': { createClient: () => ({ storage: { getBucket: async () => ({ data: { public: false }, error: null }), from: () => sentinel } }) } })('utils/club-asset-storage.ts');
   assert.equal(await api.privateClubAssetStorage(), sentinel, 'Application remains compatible with the original policy during rollback');
   if (i === 0) { run(sql('access-proposal.sql')); assert.equal((await db.$queryRaw`SELECT id FROM auth.sessions WHERE id=${sessionId}::uuid FOR SHARE`).length, 1); }
  }
  // Later HTTP groups keep using this running app's bounded connection. Restore
  // its candidate grants after proving both inverses; teardown deletes the stack.
  run(sql('access-proposal.sql'));
 });
});
