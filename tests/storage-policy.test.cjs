const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {PGlite}=require('@electric-sql/pglite')
const sql=fs.readFileSync('prisma/migrations/20260928000000_private_resume_storage/migration.sql','utf8')
test('resume privacy patch defeats public and broad legacy policies, preserves owner inserts and service signing access',async()=>{
 const db=new PGlite()
 try {
  await db.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE storage_service BYPASSRLS;
   CREATE SCHEMA storage; CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.sub', true) $$;
   CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
   CREATE TABLE storage.objects(id text PRIMARY KEY,bucket_id text,name text);
   INSERT INTO storage.buckets VALUES ('resumes','resumes',true),('headshots','headshots',true);
   INSERT INTO storage.objects VALUES ('private','resumes','owner/current.pdf'),('public','headshots','owner/photo.png');
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
   CREATE POLICY resumes_select_public ON storage.objects FOR SELECT USING(bucket_id='resumes');
   CREATE POLICY broad_legacy_policy ON storage.objects FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
   GRANT USAGE ON SCHEMA storage,auth TO anon,authenticated,storage_service;
   GRANT ALL ON storage.objects TO anon,authenticated,storage_service;
  `)
  await db.exec(sql);await db.exec(sql)
  assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='resumes'")).rows[0].public,false)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE policyname='resumes_select_public'")).rows[0].n,0)
  for(const role of ['anon','authenticated']){
   await db.exec("SELECT set_config('request.jwt.claim.sub','owner',false)")
   await db.exec('SET ROLE '+role)
   assert.deepEqual((await db.query('SELECT id FROM storage.objects')).rows.map(r=>r.id),['public'])
   await db.exec('RESET ROLE')
  }
  await db.exec("SET ROLE authenticated")
  await db.exec("INSERT INTO storage.objects VALUES ('new','resumes','owner/new.pdf')")
  await assert.rejects(db.exec("INSERT INTO storage.objects VALUES ('foreign','resumes','other/new.pdf')"),/row-level security/)
  await db.exec('RESET ROLE')
  await db.exec('SET ROLE storage_service')
  assert.equal((await db.query("SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id='resumes'")).rows[0].n,2)
  await db.exec('RESET ROLE')
 }finally{await db.close()}
})
test('only Prisma has an active migration history; archived snapshot remains evidence',()=>{
 const dir='supabase/migrations'
 assert.ok(!fs.existsSync(dir)||!fs.readdirSync(dir).some(f=>f.endsWith('.sql')))
 assert.match(fs.readFileSync('supabase/archive/20260923181745_remote_schema.sql','utf8'),/resumes_select_public/)
 require('../scripts/check-migration-path.cjs')
})
test('resume mutation guard: owners cannot update or delete stored resumes even with legacy permissive policies; service access and other buckets unchanged',async()=>{
 const guard=fs.readFileSync('prisma/migrations/20261110100000_resume_storage_mutation_guard/migration.sql','utf8')
 const db=new PGlite()
 try {
  // Production's shape: the privacy patch plus dashboard-era permissive owner policies.
  await db.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE storage_service BYPASSRLS;
   CREATE SCHEMA storage; CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.sub', true) $$;
   CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
   CREATE TABLE storage.objects(id text PRIMARY KEY,bucket_id text,name text);
   INSERT INTO storage.buckets VALUES ('resumes','resumes',false),('headshots','headshots',false);
   INSERT INTO storage.objects VALUES ('r1','resumes','owner/a.pdf'),('r2','resumes','owner/b.pdf'),('r3','resumes','other/c.pdf'),('h1','headshots','owner/photo.png');
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users update own resumes" ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='resumes' AND split_part(name,'/',1)=auth.uid()) WITH CHECK(bucket_id='resumes' AND split_part(name,'/',1)=auth.uid());
   CREATE POLICY "Users delete own resumes" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='resumes' AND split_part(name,'/',1)=auth.uid());
   CREATE POLICY "Users change own headshots" ON storage.objects FOR ALL TO authenticated USING(bucket_id='headshots' AND split_part(name,'/',1)=auth.uid()) WITH CHECK(bucket_id='headshots' AND split_part(name,'/',1)=auth.uid());
   GRANT USAGE ON SCHEMA storage,auth TO anon,authenticated,storage_service;
   GRANT ALL ON storage.objects TO anon,authenticated,storage_service;
   SELECT set_config('request.jwt.claim.sub','owner',false);
  `)
  await db.exec(sql)
  const as=async(role,statement)=>{await db.exec('SET ROLE '+role);try{return await db.query(statement)}finally{await db.exec('RESET ROLE')}}
  // The gap this closes: a statement that reads no column is not stopped by the SELECT guard (two own resumes and the own headshot change).
  await db.exec('BEGIN');assert.equal((await as('authenticated',"DELETE FROM storage.objects")).affectedRows,3);await db.exec('ROLLBACK')
  await db.exec('BEGIN');assert.equal((await as('authenticated',"UPDATE storage.objects SET name='owner/replaced'")).affectedRows,3);await db.exec('ROLLBACK')
  await db.exec(guard);await db.exec(guard)
  assert.equal((await as('authenticated',"DELETE FROM storage.objects WHERE bucket_id='resumes'")).affectedRows,0)
  assert.equal((await as('authenticated',"UPDATE storage.objects SET id=id||'-x' WHERE bucket_id='resumes'")).affectedRows,0)
  // Unqualified statements now touch only what other buckets' policies allow.
  await db.exec('BEGIN');assert.equal((await as('authenticated',"UPDATE storage.objects SET name='owner/replaced'")).affectedRows,1);await db.exec('ROLLBACK')
  await db.exec('BEGIN');assert.equal((await as('authenticated',"DELETE FROM storage.objects")).affectedRows,1);await db.exec('ROLLBACK')
  assert.equal((await as('anon',"DELETE FROM storage.objects")).affectedRows,0)
  assert.deepEqual((await db.query("SELECT id FROM storage.objects ORDER BY id")).rows.map(r=>r.id),['h1','r1','r2','r3'])
  // Owner uploads to a new path still pass; service-role maintenance is unaffected.
  await as('authenticated',"INSERT INTO storage.objects VALUES ('r4','resumes','owner/new.pdf')")
  assert.equal((await as('storage_service',"DELETE FROM storage.objects WHERE id='r4'")).affectedRows,1)
  assert.equal((await as('storage_service',"UPDATE storage.objects SET name='owner/a2.pdf' WHERE id='r1'")).affectedRows,1)
 }finally{await db.close()}
})
test('resume mutation guard is a no-op without Supabase Storage',async()=>{
 const db=new PGlite()
 try{await db.exec(fs.readFileSync('prisma/migrations/20261110100000_resume_storage_mutation_guard/migration.sql','utf8'));assert.equal((await db.query("SELECT count(*)::int n FROM pg_policies")).rows[0].n,0)}finally{await db.close()}
})
