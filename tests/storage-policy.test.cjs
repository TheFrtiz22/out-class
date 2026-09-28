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
