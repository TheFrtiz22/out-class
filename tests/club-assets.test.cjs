const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{PGlite}=require('@electric-sql/pglite');
const migration=fs.readFileSync('prisma/migrations/20261009234601_private_club_assets/migration.sql','utf8');
function load(file,mocks={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/lib/')?load(n.slice(2)+'.ts',mocks):require(n),m,m.exports);return m.exports;}
for(const legacy of [false,true])test(`club assets ${legacy?'legacy':'fresh'} storage is private and denies browser CRUD without changing other buckets`,async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE storage_service BYPASSRLS;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id text PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO anon,authenticated,storage_service;GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon,authenticated,storage_service;CREATE POLICY broad_objects ON storage.objects FOR ALL TO PUBLIC USING(true) WITH CHECK(true);CREATE POLICY broad_buckets ON storage.buckets FOR ALL TO PUBLIC USING(true) WITH CHECK(true);INSERT INTO storage.buckets VALUES('event-flyers','event-flyers',false,123,NULL),('headshots','headshots',false,234,NULL),('resumes','resumes',false,345,NULL);`);
 if(legacy)await db.exec(`INSERT INTO storage.buckets VALUES('club-assets','club-assets',true,NULL,NULL);CREATE POLICY club_assets_insert_owner_only ON storage.objects FOR INSERT WITH CHECK(true);CREATE POLICY club_assets_update_owner_only ON storage.objects FOR UPDATE USING(true);CREATE POLICY club_assets_delete_owner_only ON storage.objects FOR DELETE USING(true);CREATE POLICY club_assets_select_public ON storage.objects FOR SELECT USING(true);`);
 const before=(await db.query(`SELECT * FROM storage.buckets ORDER BY id`)).rows.filter(b=>b.id!=='club-assets');await db.exec(migration);await db.exec(migration);
 const bucket=(await db.query(`SELECT * FROM storage.buckets WHERE id='club-assets'`)).rows[0];assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),5242880);assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);assert.deepEqual((await db.query(`SELECT * FROM storage.buckets WHERE id<>'club-assets' ORDER BY id`)).rows,before);
 assert.equal((await db.query(`SELECT * FROM pg_policies WHERE policyname LIKE 'club_assets_%'`)).rows.length,0);
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);await assert.rejects(db.exec(`INSERT INTO storage.objects VALUES('forged','club-assets','foreign/forged.png')`),/row-level security/);assert.equal((await db.query(`SELECT * FROM storage.buckets WHERE id='club-assets'`)).rows.length,0);await db.exec('RESET ROLE');}
 await db.exec(`SET ROLE storage_service;INSERT INTO storage.objects VALUES('stored','club-assets','club/asset.png');RESET ROLE;`);
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role};UPDATE storage.objects SET name='replaced' WHERE id='stored';DELETE FROM storage.objects WHERE id='stored';UPDATE storage.buckets SET public=true WHERE id='club-assets';RESET ROLE;`);assert.equal((await db.query(`SELECT name FROM storage.objects WHERE id='stored'`)).rows[0].name,'club/asset.png');}
 assert.equal((await db.query(`SELECT public FROM storage.buckets WHERE id='club-assets'`)).rows[0].public,false);
});
test('asset references reject traversal, foreign layouts and privileged URL substitutions',()=>{const {clubAssetReference,clubAssetSource}=load('lib/club-assets.ts');const good='club-assets/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.png';assert.ok(clubAssetReference.safeParse(good).success);assert.match(clubAssetSource(good),/^\/api\/club-assets\?reference=/);for(const bad of [good+'/extra',good.replace('.png','.svg'),good.replace('club-assets/','../'), 'https://storage.example/'+good])assert.equal(clubAssetReference.safeParse(bad).success,false);});

test("hidden section images are excluded from public delivery but retained for assignment validation",()=>{const {clubProfileImages}=load("lib/club-assets.ts");const profile={logoUrl:"logo",marketing:{sections:[{visible:false,cards:[{image:"hidden"}]},{visible:true,cards:[{image:"shown"}]}]}};assert.deepEqual(clubProfileImages(profile),["logo","hidden","shown"]);assert.deepEqual(clubProfileImages(profile,true),["logo","shown"]);});

test('Storage readiness accepts only the exact original or bounded-runtime guard and fails closed on broader policies',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`CREATE ROLE anon;CREATE SCHEMA storage;CREATE TABLE storage.objects(bucket_id text,name text);CREATE TABLE storage.buckets(id text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;CREATE POLICY outclass_club_assets_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO PUBLIC USING(bucket_id<>'club-assets') WITH CHECK(bucket_id<>'club-assets');CREATE POLICY outclass_club_assets_bucket_server_only ON storage.buckets AS RESTRICTIVE FOR ALL TO PUBLIC USING(id<>'club-assets') WITH CHECK(id<>'club-assets');`);
 const previous=process.env.SUPABASE_SECRET_KEY;process.env.SUPABASE_SECRET_KEY='disposable-fixture-only';t.after(()=>{if(previous===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=previous;});
 const sentinel={},api=load('utils/club-asset-storage.ts',{'server-only':{},'@/utils/prisma':{prisma:{$queryRaw:async strings=>(await db.query(strings.join(''))).rows}},'@supabase/supabase-js':{createClient:()=>({storage:{getBucket:async()=>({data:{public:false},error:null}),from:()=>sentinel}})}});
 assert.equal(await api.privateClubAssetStorage(),sentinel);
 const reviewed="bucket_id<>'club-assets' OR CURRENT_USER='outclass_production_app'::name";
 await db.exec(`ALTER POLICY outclass_club_assets_server_only ON storage.objects USING(${reviewed}) WITH CHECK(${reviewed})`);
 assert.equal(await api.privateClubAssetStorage(),sentinel);
 const dedicated="bucket_id<>'club-assets' OR CURRENT_USER='outclass_web_runtime'::name";
 await db.exec(`ALTER POLICY outclass_club_assets_server_only ON storage.objects USING(${dedicated}) WITH CHECK(${dedicated})`);
 assert.equal(await api.privateClubAssetStorage(),sentinel);
 await db.exec('ALTER POLICY outclass_club_assets_server_only ON storage.objects WITH CHECK(true)');
 await assert.rejects(api.privateClubAssetStorage(),/unavailable/);
 await db.exec(`ALTER POLICY outclass_club_assets_server_only ON storage.objects TO anon WITH CHECK(${reviewed})`);
 await assert.rejects(api.privateClubAssetStorage(),/unavailable/);
 await db.exec('ALTER POLICY outclass_club_assets_server_only ON storage.objects TO PUBLIC USING(true) WITH CHECK(true)');
 await assert.rejects(api.privateClubAssetStorage(),/unavailable/);
 await db.exec(`ALTER POLICY outclass_club_assets_server_only ON storage.objects USING(${reviewed}) WITH CHECK(${reviewed});ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;`);
 await assert.rejects(api.privateClubAssetStorage(),/unavailable/);
});
