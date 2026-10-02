const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function load(file,mocks={}) {
 const mod={exports:{}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(n.slice(2)+'.ts',mocks):require(n),mod,mod.exports);
 return mod.exports;
}

test('university identity proof fails closed for auto-confirm, missing settings, errors, and unavailable Auth',async t=>{
 const saved={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,fetch:global.fetch};
 t.after(()=>{global.fetch=saved.fetch;for(const [key,value]of [['NEXT_PUBLIC_SUPABASE_URL',saved.url],['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',saved.key]])if(value===undefined)delete process.env[key];else process.env[key]=value;});
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://auth.example.test';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='public-test-key';
 const api=load('utils/verified-email-policy.ts');
 for(const settings of [{mailer_autoconfirm:true},{}, {mailer_autoconfirm:'false'}]){global.fetch=async()=>({ok:true,json:async()=>settings});await assert.rejects(api.requireVerifiedEmailPolicy(),/email confirmation enabled/);}
 global.fetch=async()=>({ok:false});await assert.rejects(api.requireVerifiedEmailPolicy());
 global.fetch=async()=>{throw Error('offline')};await assert.rejects(api.requireVerifiedEmailPolicy());
 global.fetch=async(url,options)=>{assert.equal(url,'https://auth.example.test/auth/v1/settings');assert.equal(options.cache,'no-store');assert.equal(options.headers.apikey,'public-test-key');return{ok:true,json:async()=>({mailer_autoconfirm:false})};};
 await api.requireVerifiedEmailPolicy();delete process.env.NEXT_PUBLIC_SUPABASE_URL;await assert.rejects(api.requireVerifiedEmailPolicy());
});

test('changed verified mailbox never discovers historical university identities; client metadata cannot spoof the key',async()=>{
 const identities=[{id:'old',userId:'account'},{id:'current',userId:'account'}];let query,normalized;
 const tx={$queryRaw:async()=>[],schoolIdentifierType:{findMany:async({where})=>{assert.equal(where.emailDomain,'virginia.edu');return[{id:'computing',schoolId:'uva',normalization:'TRIM_LOWERCASE',validationRegex:'^[a-z0-9]+$'}];}},schoolIdentity:{upsert:async({create})=>{normalized=create.normalizedIdentifier;return{id:'current'};},findUniqueOrThrow:async()=>identities[1],findMany:async({where})=>{query=where;return identities.filter(i=>where.id.in.includes(i.id));}}};
 const helper=load('utils/school-identity.ts',{'@/utils/verified-email-policy':{...load('utils/verified-email-policy.ts'),requireVerifiedEmailPolicy:async()=>{}}});
 const account={user:{id:'account',email:'newid@virginia.edu'},supabaseUser:{id:'account',email:'NEWID@virginia.edu',confirmation_sent_at: '2026-09-01', email_confirmed_at:'2026-10-02',user_metadata:{computing_id:'victim'}}};
 assert.deepEqual((await helper.verifiedSchoolIdentities(tx,account)).map(i=>i.id),['current']);assert.equal(normalized,'newid');assert.deepEqual(query.id,{in:['current']});
 for(const change of [{confirmation_sent_at:undefined},{confirmation_sent_at:'invalid'},{confirmation_sent_at:'2027-01-01'},{id:'victim'},{email:'victim@virginia.edu'},{confirmation_sent_at: '2026-09-01', email_confirmed_at:null},{app_metadata:{email_verification_skipped:true}}])await assert.rejects(helper.verifiedSchoolIdentities(tx,{...account,supabaseUser:{...account.supabaseUser,...change}}),/Verify/);
});

test('all onboarding tables retain independent restrictive RLS even with browser grants and permissive policies',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 for(const file of fs.readdirSync('prisma/migrations').sort()){const migration=path.join('prisma/migrations',file,'migration.sql');if(fs.existsSync(migration))await db.exec(fs.readFileSync(migration,'utf8'));}
 await db.exec(`INSERT INTO "User" (id,email) VALUES ('private-person','private@virginia.edu');`);
 const tables=['User','StudentProfile','Club','ClubMember','ClubInvitation','School','SchoolIdentifierType','SchoolIdentity','RosterImport','RosterImportRow','InvitationDelivery'];
 for(const table of tables){
  const policy=(await db.query(`SELECT pg_get_expr(polwithcheck,polrelid) AS check FROM pg_policy WHERE polrelid=$1::regclass AND NOT polpermissive`,['"'+table+'"'])).rows;
  assert.ok(policy.some(p=>p.check==='false'),`No restrictive INSERT check on ${table}`);
  await db.exec(`GRANT SELECT,INSERT,UPDATE,DELETE ON "${table}" TO anon,authenticated; CREATE POLICY security_test_permissive ON "${table}" FOR ALL TO PUBLIC USING(true) WITH CHECK(true);`);
  for(const role of ['anon','authenticated']){
   await db.exec(`SET ROLE ${role}`);
   try {
    assert.equal((await db.query(`SELECT * FROM "${table}"`)).rows.length,0,`${role} reads ${table}`);
    assert.equal((await db.query(`DELETE FROM "${table}" RETURNING *`)).rows.length,0,`${role} deletes ${table}`);
    assert.equal((await db.query(`UPDATE "${table}" SET id=id RETURNING *`)).rows.length,0);
    if(table==='User')await assert.rejects(db.exec(`INSERT INTO "User" (id,email) VALUES ('browser','browser@virginia.edu')`),/row-level security|permission denied/);
   } finally {await db.exec('RESET ROLE');}
  }
 }
 await db.exec(`INSERT INTO "User" (id,email) VALUES ('owner','owner@virginia.edu'),('other','other@virginia.edu'); INSERT INTO "Club" (id,slug,name,tagline,description,color,category) VALUES ('club','security-test','Club','','','#fff','Other'); INSERT INTO "ClubMember" (id,"clubId","userId","isOwner") VALUES ('owner','club','owner',true);`);
 await assert.rejects(db.exec(`UPDATE "User" SET "disabledAt"=NOW() WHERE id='owner'`),/another active owner/);
 await db.exec(`UPDATE "User" SET "disabledAt"=NOW() WHERE id='other'`);
 await assert.rejects(db.exec(`INSERT INTO "ClubMember" (id,"clubId","userId","isOwner") VALUES ('disabled','club','other',true)`),/active account/);
 await db.exec(`UPDATE "User" SET "disabledAt"=NULL WHERE id='other'; INSERT INTO "ClubMember" (id,"clubId","userId","isOwner") VALUES ('second','club','other',true); UPDATE "User" SET "disabledAt"=NOW() WHERE id='owner';`);
 await assert.rejects(db.exec(`UPDATE "User" SET "disabledAt"=NOW() WHERE id='other'`),/another active owner/);
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM "ClubMember" m JOIN "User" u ON u.id=m."userId" WHERE m."isOwner" AND u."disabledAt" IS NULL`)).rows[0].n,1);
});

test('malformed Unicode and duplicate flooding are bounded; export-formula prefixes cannot become ready rows',()=>{
 const api=load('lib/roster-csv.ts'),config={normalization:'TRIM_LOWERCASE',validationRegex:'^[a-z][a-z0-9]+$'};
 for(const bad of ['\uFFFD','\uD800','\uDC00'])assert.throws(()=>api.parseRosterCsv(`name,computing_id\nJohn${bad},jms8xy`),/encoding/);
 for(const name of [' =cmd','\t=cmd',' +cmd',' @SUM(A1)',' -cmd'])assert.equal(api.validateRosterRows([{name,year:'2028',computing_id:'jms8xy'}],config)[0].status,'INVALID');
 const rows=api.validateRosterRows(api.parseRosterCsv('name,computing_id\n'+Array(1000).fill('John,jms8xy').join('\n')),config);
 assert.deepEqual(api.rosterSummary(rows),{total:1000,ready:1,duplicates:999,invalid:0,alreadyMember:0,alreadyInvited:0});
 assert.throws(()=>api.parseRosterCsv('name,computing_id\n'+Array(1001).fill('John,jms8xy').join('\n')),/data rows/);
});
