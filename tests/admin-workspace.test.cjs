const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const{PGlite}=require('@electric-sql/pglite');
function load(file,mocks={}){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name in mocks?mocks[name]:name.startsWith('@/lib/')?load(name.slice(2)+'.ts',mocks):require(name),mod,mod.exports);return mod.exports;}
function api(prisma,authorize=async()=>({id:'actor'})){return load('actions/admin-workspace.ts',{
 'next/cache':{revalidatePath(){},revalidateTag(){}},'@/utils/prisma':{prisma},'@/utils/platform-admin':{requirePlatformAdmin:authorize},'@/utils/auth':{requireAuth:async()=>({user:{id:'student'}})},
 '@/actions/platform-organization-onboarding':{},'@/actions/club-onboarding':{},'@/actions/platform-admin':{},
 '@/utils/club-onboarding':{},'@/utils/email':{},'@/utils/invitation-delivery':{},'@/utils/invitation-background':{},
});}
test('all Admin workspace readers and mutations reject without elevation before touching storage',async()=>{
 const server=api({},async()=>{throw Error('Fresh Admin authentication required.');});
 for(const [name,args]of Object.entries({getAdminOverview:[],listAdminReports:[{}],resolveAdminReport:[{}],inspectAdminClub:['bad','bad'],setAdminClubSuspended:['bad',true,'bad'],getAdminSettings:[],saveAdminSettings:[{},'bad'],createAdminStudent:[{}],resendAdminStudentInvitation:['bad','bad'],createAdminClub:[{}],resendAdminClubInvitation:['bad','bad','bad'],changeAdminDesignatedLeader:[{}],inspectAdminStudent:['bad','bad']}))await assert.rejects(server[name](...args),/Fresh Admin/);
});
test('report resolution checks revision, validates reason, and writes actor/outcome in the same transaction',async()=>{
 const reportId='00000000-0000-4000-8000-000000000001',logs=[],row={id:reportId,status:'OPEN',revision:2};
 const tx={$queryRaw:async()=>[],platformReport:{findUnique:async()=>row,update:async({data})=>Object.assign(row,data)},auditLog:{create:async({data})=>logs.push(data)}};
 const server=api({$transaction:async fn=>fn(tx)});
 await assert.rejects(server.resolveAdminReport({id:reportId,revision:1,status:'RESOLVED',reason:'Verified and resolved the report.'}),/Report changed/);assert.equal(logs.length,0);
 await assert.rejects(server.resolveAdminReport({id:reportId,revision:2,status:'RESOLVED',reason:'short'}));
 await server.resolveAdminReport({id:reportId,revision:2,status:'RESOLVED',reason:'Verified and resolved the report.'});
 assert.equal(row.resolvedBy,'actor');assert.equal(row.status,'RESOLVED');assert.equal(logs[0].actorId,'actor');assert.equal(logs[0].details.result,'success');
});
test('platform settings have safe defaults, reject infrastructure fields, and audit changes',async()=>{
 const logs=[];let saved;
 const tx={platformContent:{upsert:async({update})=>{saved=update.value;}},auditLog:{create:async({data})=>logs.push(data)}};
 const server=api({platformContent:{findUnique:async()=>null},auditLog:tx.auditLog,$transaction:async fn=>fn(tx)});
 assert.deepEqual(await server.getAdminSettings(),{supportEmail:'',campusNotice:'',maintenanceNotice:''});
 await assert.rejects(server.saveAdminSettings({serviceRoleKey:'secret'},'Update supported platform settings.'));
 await server.saveAdminSettings({supportEmail:'support@virginia.edu',campusNotice:'Welcome'},'Update supported platform settings.');
 assert.equal(saved.maintenanceNotice,'');assert.ok(logs.some(r=>r.action==='platform.settings.change'&&r.reason));
});
test('complete isolated migration chain denies browser CRUD even with broad grants/policies and preserves append-only audit',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;');
 for(const name of fs.readdirSync('prisma/migrations').sort()){const file=`prisma/migrations/${name}/migration.sql`;if(fs.existsSync(file))await db.exec(fs.readFileSync(file,'utf8'));}
 await db.exec(`INSERT INTO "User"(id,email)VALUES('actor','actor@virginia.edu');INSERT INTO "AuditLog"(id,"actorId",action,"targetId")VALUES('audit','actor','test','actor');`);
 await assert.rejects(db.exec(`UPDATE "AuditLog" SET action='forged' WHERE id='audit'`),/immutable|append|audit/i);
 await assert.rejects(db.exec(`DELETE FROM "AuditLog" WHERE id='audit'`),/immutable|append|audit/i);
 const inserts={AdminElevation:`('e','actor','${'a'.repeat(64)}','session','factor',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '20 minutes',NULL)`,AdminElevationChallenge:`('c','actor','${'b'.repeat(64)}','session','encrypted','factor','challenge',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '4 minutes',NULL,0)`,PlatformReport:`('r','USER','actor','actor','Reported inappropriate behavior','OPEN',NULL,NULL,NULL,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`};
 for(const table of Object.keys(inserts)){
  await db.exec(`INSERT INTO "${table}" VALUES${inserts[table]}`);
  for(const role of ['anon','authenticated'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege('${role}','"${table}"','${privilege}') allowed`)).rows[0].allowed,false);
  await db.exec(`GRANT ALL ON "${table}" TO anon,authenticated;CREATE POLICY accidental_broad ON "${table}" FOR ALL TO PUBLIC USING(true) WITH CHECK(true);`);
  for(const role of ['anon','authenticated']){
   await db.exec(`SET ROLE ${role}`);assert.equal((await db.query(`SELECT * FROM "${table}"`)).rows.length,0);assert.equal((await db.query(`DELETE FROM "${table}" RETURNING *`)).rows.length,0);assert.equal((await db.query(`UPDATE "${table}" SET "actorId"='actor' RETURNING *`.replace('"actorId"=\'actor\'',table==='PlatformReport'?`summary='Changed reported behavior'`:`"actorId"='actor'`))).rows.length,0);
   await assert.rejects(db.exec(`INSERT INTO "${table}" VALUES${inserts[table].replace(/\('([ecr])'/,"('new-$1'")}`),/row-level security/);await db.exec('RESET ROLE');
  }
 }
 await assert.rejects(db.exec(`UPDATE "AdminElevation" SET "expiresAt"="createdAt"+interval '31 minutes'`),/check constraint/);
 await assert.rejects(db.exec(`UPDATE "AdminElevationChallenge" SET attempts=6`),/check constraint/);
 await assert.rejects(db.exec(`UPDATE "PlatformReport" SET status='RESOLVED'`),/check constraint/);
});
