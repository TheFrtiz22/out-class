const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')

const migration = fs.readFileSync('prisma/migrations/20261127000000_profile_storage_server_only/migration.sql', 'utf8')

// Production's shape on 2026-11-26: the earlier privacy guards plus dashboard-era permissive policies.
const productionShape = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE storage_service BYPASSRLS; CREATE ROLE outclass_production_app;
  CREATE SCHEMA storage; CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.sub', true) $$;
  CREATE FUNCTION public.outclass_scholar_status_valid(v JSONB) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$ SELECT v IS NULL OR jsonb_typeof(v) = 'object' $$;
  CREATE TABLE public.profile_fixture(status JSONB CHECK (public.outclass_scholar_status_valid(status)));
  GRANT INSERT ON public.profile_fixture TO outclass_production_app;
  CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean);
  CREATE TABLE storage.objects(id text PRIMARY KEY, bucket_id text, name text);
  INSERT INTO storage.buckets VALUES ('resumes','resumes',false),('headshots','headshots',false),('club-assets','club-assets',false),('other','other',false);
  INSERT INTO storage.objects VALUES ('r1','resumes','owner/a.pdf'),('h1','headshots','owner/p.png'),('o1','other','owner/x.txt');
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE POLICY headshots_select_public ON storage.objects FOR SELECT USING (bucket_id = 'headshots');
  CREATE POLICY outclass_headshots_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC USING (bucket_id <> 'headshots');
  CREATE POLICY outclass_resumes_private_read ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC USING (bucket_id <> 'resumes');
  CREATE POLICY "Users read own resumes" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resumes' AND split_part(name,'/',1) = auth.uid());
  CREATE POLICY outclass_resumes_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resumes' AND split_part(name,'/',1) = auth.uid());
  CREATE POLICY outclass_headshots_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'headshots' AND split_part(name,'/',1) = auth.uid());
  CREATE POLICY "Users update own headshots" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'headshots' AND split_part(name,'/',1) = auth.uid());
  CREATE POLICY "Users upload own club assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'club-assets' AND split_part(name,'/',1) = auth.uid());
  CREATE POLICY other_bucket_owner ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'other' AND split_part(name,'/',1) = auth.uid()) WITH CHECK (bucket_id = 'other' AND split_part(name,'/',1) = auth.uid());
  GRANT USAGE ON SCHEMA storage, auth TO anon, authenticated, storage_service;
  GRANT ALL ON storage.objects TO anon, authenticated, storage_service;
  SELECT set_config('request.jwt.claim.sub', 'owner', false);
`

test('profile buckets become server-only: owner uploads, updates and reads fail; service key and other buckets unchanged', async () => {
  const db = new PGlite()
  const as = async (role, statement) => { await db.exec('SET ROLE ' + role); try { return await db.query(statement) } finally { await db.exec('RESET ROLE') } }
  try {
    await db.exec(productionShape)
    // The gap this closes: today an owner can store unchecked bytes in their own resume folder.
    await db.exec('BEGIN'); await as('authenticated', "INSERT INTO storage.objects VALUES ('x','resumes','owner/raw.pdf')"); await db.exec('ROLLBACK')

    await db.exec(migration); await db.exec(migration)

    for (const bucket of ['resumes', 'headshots']) {
      await assert.rejects(as('authenticated', `INSERT INTO storage.objects VALUES ('n-${bucket}','${bucket}','owner/new')`), /row-level security/)
      assert.equal((await as('authenticated', `UPDATE storage.objects SET name='owner/moved' WHERE bucket_id='${bucket}'`)).affectedRows, 0)
      assert.equal((await as('authenticated', `DELETE FROM storage.objects WHERE bucket_id='${bucket}'`)).affectedRows, 0)
    }
    assert.deepEqual((await as('authenticated', 'SELECT id FROM storage.objects ORDER BY id')).rows.map(r => r.id), ['o1'])
    assert.deepEqual((await as('anon', 'SELECT id FROM storage.objects')).rows, [])

    // Dead permissive policies are gone; the earlier restrictive guards stay in place.
    const names = (await db.query("SELECT policyname FROM pg_policies WHERE schemaname='storage' ORDER BY 1")).rows.map(r => r.policyname)
    assert.deepEqual(names, ['other_bucket_owner', 'outclass_headshots_read_guard', 'outclass_profile_files_server_only', 'outclass_resumes_private_read'])

    // The server key (BYPASSRLS) still writes profile files, and unrelated buckets keep their own rules.
    await as('storage_service', "INSERT INTO storage.objects VALUES ('r2','resumes','owner/b.pdf')")
    assert.equal((await as('storage_service', "SELECT count(*)::int n FROM storage.objects WHERE bucket_id IN ('resumes','headshots')")).rows[0].n, 3)
    await as('authenticated', "INSERT INTO storage.objects VALUES ('o2','other','owner/y.txt')")
  } finally { await db.close() }
})

test('CHECK helper is no longer callable by browser roles but still validates server writes', async () => {
  const db = new PGlite()
  try {
    await db.exec(productionShape)
    await db.exec(migration)
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query(`SELECT has_function_privilege('${role}', 'public.outclass_scholar_status_valid(jsonb)', 'EXECUTE') AS ok`)).rows[0].ok, false)
    }
    await db.exec('SET ROLE outclass_production_app')
    try {
      await db.exec(`INSERT INTO public.profile_fixture VALUES ('{"selections":[]}')`)
      await assert.rejects(db.exec(`INSERT INTO public.profile_fixture VALUES ('[1]')`), /check constraint/)
    } finally { await db.exec('RESET ROLE') }
  } finally { await db.close() }
})

test('profile storage migration skips Storage on plain PostgreSQL', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE FUNCTION public.outclass_scholar_status_valid(v JSONB) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$ SELECT true $$;`)
    await db.exec(migration)
    assert.equal((await db.query('SELECT count(*)::int n FROM pg_policies')).rows[0].n, 0)
  } finally { await db.close() }
})

test('profile upload action signs with the server key, never the session client', () => {
  const source = fs.readFileSync('actions/storage.ts', 'utf8')
  assert.match(source, /const storage = admin\.storage\.from\(bucket\)/)
  assert.doesNotMatch(source, /@\/utils\/supabase\/server|mobileRequest|cookies\(/)
})
