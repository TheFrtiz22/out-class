const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}) {const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/lib/')?load(n.slice(2)+'.ts',mocks):require(n),m,m.exports);return m.exports;}
const owner='123e4567-e89b-12d3-a456-426614174000',other='123e4567-e89b-12d3-a456-426614174001',clubId='123e4567-e89b-12d3-a456-426614174002',applicationId='123e4567-e89b-12d3-a456-426614174003',roundId='123e4567-e89b-12d3-a456-426614174004';
const photo=load('lib/profile-photo.ts'),profile=load('lib/student-profile.ts');
test('external, public, foreign and proxy references cannot be saved as owned photos',async()=>{
 const writes=[];const api=load('actions/profile.ts',{'@/utils/auth':{requireAuth:async()=>({user:{id:owner,email:'owner@virginia.edu'}})},'@/utils/prisma':{prisma:{studentProfile:{update:async q=>{writes.push(q);return q.data},upsert:async q=>{writes.push(q);return q.create}}}},'next/cache':{revalidatePath(){}}});
 for(const headshotUrl of ['https://external.invalid/photo.png',`https://local.invalid/storage/v1/object/public/headshots/${owner}/p.png`,`${other}/p.png`,photo.profilePhotoSource(`${owner}/p.png`)]) {
  assert.ok((await api.updateStudentProfileSection({section:'identity',firstName:'New',lastName:'Name',headshotUrl})).error);
  await assert.rejects(api.upsertStudentProfile({firstName:'New',lastName:'Name',computingId:'owner',major:'Math',gradYear:2028,headshotUrl}));
 }
 assert.equal(writes.length,0);
 assert.ok(!(await api.updateStudentProfileSection({section:'identity',firstName:'New',lastName:'Name',headshotUrl:`${owner}/p.png`})).error);
 assert.equal(photo.profilePhotoSource('https://external.invalid/photo.png'),undefined);
 assert.equal(profile.headshotUrlSchema.safeParse('https://external.invalid/photo.png').success,false);
});
test('private photo proxy authenticates owner and context, denies students/anonymous/path attacks, and returns no bearer URL',async()=>{
 let actor=owner,anonymous=false,allowed=false,publicBucket=false,downloads=0;
 const scope={clubId,applicationId},path=`${owner}/p.png`;
 const headersResponse=(body,init={})=>new Response(body,init);
 const api=load('app/api/profile-photos/route.ts',{
  'next/server':{NextResponse:class extends Response{}},'@/utils/auth':{requireAuth:async()=>{if(anonymous)throw{digest:'NEXT_REDIRECT'};return{user:{id:actor}}}},'@/utils/support-audit':{auditSupportAction:async()=>{}},
  '@supabase/supabase-js': { createClient: () => ({ storage: {
    getBucket: async () => ({ data: { public: publicBucket } }),
    from: () => ({ download: async p => { assert.equal(p,path); downloads++; return { data: new Blob([new Uint8Array([1,2,3])], { type:'image/png' }) }; } })
  } }) },
  '@/utils/prisma':{prisma:{$transaction:async()=>{throw Error('Denied')}}},
  '@/actions/applicant-intelligence':{getApplicantDisplay:async()=>{if(!allowed)throw Error('Denied');return{photo:photo.profilePhotoSource(path,scope)}}},
  '@/actions/interview-resumes':{getInterviewApplicantPanel:async()=>{if(!allowed)throw Error('Denied');return{profile:{headshotUrl:photo.profilePhotoSource(path,{...scope,roundId})}}}},
  '@/actions/evaluations':{getEvaluations:async()=>{throw Error('Denied')}}
 });
 process.env.SUPABASE_SECRET_KEY='test-secret';process.env.NEXT_PUBLIC_SUPABASE_URL='http://localhost';
 const get=url=>api.GET(new Request('http://localhost'+url));
 let r=await get(photo.profilePhotoSource(path));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('location'),null);assert.equal(r.headers.get('content-type'),'image/png');assert.equal((await r.arrayBuffer()).byteLength,3);
 actor=other;assert.equal((await get(photo.profilePhotoSource(path))).status,403);assert.equal(downloads,1);
 assert.equal((await get(photo.profilePhotoSource(path,scope))).status,403);
 allowed=true;assert.equal((await get(photo.profilePhotoSource(path,scope))).status,200);
 assert.equal((await get(photo.profilePhotoSource(path,{...scope,roundId}))).status,200);
 allowed=false;assert.equal((await get(photo.profilePhotoSource(path,{...scope,roundId}))).status,403);
 anonymous=true;assert.equal((await get(photo.profilePhotoSource(path))).status,401);anonymous=false;
 assert.equal((await get('/api/profile-photos?path='+encodeURIComponent(`${owner}/../foreign.png`))).status,400);
 actor=owner;publicBucket=true;assert.equal((await get(photo.profilePhotoSource(path))).status,503);
});
test('Postgres migration preserves legacy GPA and photos while validating changed GPA and closing public Storage',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try {
 await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;');
 const dir='prisma/migrations',latest='20261007010000_profile_gpa_private_photos';
 for(const name of fs.readdirSync(dir).sort().filter(n=>n<latest&&fs.existsSync(`${dir}/${n}/migration.sql`))) {
  if(name==='20261006020000_profile_recruitment_visibility') {
   await db.exec(`INSERT INTO "User"(id,email) VALUES('${owner}','owner@virginia.edu'),('${other}','other@virginia.edu'); INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear",gpa,"headshotUrl") VALUES('p','${owner}','Legacy','Name','owner','Math',2028,4.6,'https://old.invalid/storage/v1/object/public/headshots/${owner}/p.png'),('p2','${other}','Legacy','Precision','other','Math',2028,3.1234,NULL);CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);CREATE TABLE storage.objects(id text,bucket_id text,name text);ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;CREATE POLICY broad_objects ON storage.objects FOR ALL TO PUBLIC USING(true) WITH CHECK(true);CREATE POLICY broad_buckets ON storage.buckets FOR ALL TO PUBLIC USING(true) WITH CHECK(true);GRANT USAGE ON SCHEMA storage TO anon,authenticated;GRANT ALL ON storage.buckets,storage.objects TO anon,authenticated;`);
  }
  await db.exec(fs.readFileSync(`${dir}/${name}/migration.sql`,'utf8'));
 }
 await db.exec(`INSERT INTO storage.objects VALUES('o','headshots','${owner}/p.png');`);
 await db.exec(fs.readFileSync(`${dir}/${latest}/migration.sql`,'utf8'));
 assert.equal((await db.query(`SELECT public FROM storage.buckets WHERE id='headshots'`)).rows[0].public,false);
 assert.equal((await db.query(`SELECT "headshotUrl" FROM "StudentProfile" WHERE id='p'`)).rows[0].headshotUrl,`${owner}/p.png`);
 for(const [id,gpa] of [['p',4.6],['p2',3.1234]]) {
  for(const update of [`"firstName"='New Name'`,`"headshotUrl"='${id==='p'?owner:other}/replacement.png'`,`"linkedinUrl"='https://linkedin.com/in/new'`,`major='New major'`]) {
   await db.exec(`UPDATE "StudentProfile" SET ${update} WHERE id='${id}'`);assert.equal((await db.query(`SELECT gpa FROM "StudentProfile" WHERE id='${id}'`)).rows[0].gpa,gpa);
  }
  await db.exec(`UPDATE "StudentProfile" SET gpa=3.8 WHERE id='${id}'`);
  for(const invalid of [4.6,-1,3.1234])await assert.rejects(db.exec(`UPDATE "StudentProfile" SET gpa=${invalid} WHERE id='${id}'`),/GPA/);
 }
 for(const invalid of [4.6,-1,3.1234])await assert.rejects(db.exec(`INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear",gpa) VALUES('bad','new','Bad','GPA','bad','Math',2028,${invalid})`),/GPA/);
 for(const role of ['anon','authenticated']) {
  await db.exec(`SET ROLE ${role};`);
  assert.equal((await db.query(`SELECT * FROM storage.objects WHERE bucket_id='headshots'`)).rows.length,0);
  assert.equal((await db.query(`UPDATE storage.buckets SET public=true WHERE id='headshots' RETURNING id`)).rows.length,0);
  await db.exec('RESET ROLE;');
 }
 } finally {await db.close();}
});
