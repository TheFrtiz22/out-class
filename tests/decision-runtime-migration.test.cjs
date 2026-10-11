const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
const dir=path.resolve('prisma/migrations'),decision='20261010190001_reconciled_decision_letters',repair='20261011194930_decision_letter_runtime_access';
const names=fs.readdirSync(dir).filter(n=>fs.existsSync(path.join(dir,n,'migration.sql'))).sort();
const sql=n=>fs.readFileSync(path.join(dir,n,'migration.sql'),'utf8');
for(const mode of ['fresh','current-main','original-reconciliation'])test(`DecisionLetter bounded runtime: ${mode} upgrade preserves populated data`,{timeout:120000},async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE migration_operator NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT outclass_production_app TO migration_operator; ALTER SCHEMA public OWNER TO migration_operator`);
 const applied=new Set();
 const apply=async n=>{if(n===repair){await db.exec('ALTER TABLE public."DecisionLetter" OWNER TO migration_operator; SET ROLE migration_operator');}await db.exec(sql(n));await db.exec('RESET ROLE');applied.add(n)};
 // Existing application tables follow production's original ownership convention.
 for(const n of names.filter(n=>n<='20261007010000_profile_gpa_private_photos'))await apply(n);
 for(const {tablename}of(await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`)).rows)await db.exec(`ALTER TABLE public."${tablename}" OWNER TO outclass_production_app`);
 let initial=names.filter(n=>n>'20261007010000_profile_gpa_private_photos'&&n!==repair);
 if(mode==='current-main')initial=initial.filter(n=>n!==decision);
 if(mode==='original-reconciliation')initial=initial.filter(n=>n<'20261011002000_production_communications_runtime_access');
 for(const n of initial)await apply(n);
 await db.exec(`INSERT INTO "User"(id,email) VALUES('student','student@demo.invalid'),('leader','leader@demo.invalid'); INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','Club','','','#142d45','Other'); INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','Review',0); INSERT INTO "Application"(id,"studentId","clubId","roundId",status,"submittedAt") VALUES('app','student','club','round','IN_REVIEW',NOW()); INSERT INTO "ClubAnnouncement"(id,"clubId","authorId",title,body,audience,"requestKey") VALUES('announcement','club','leader','Keep','Keep body','MEMBERS','request'); INSERT INTO "UserNotificationPreference"("userId","emailApplications","emailFrequency","updatedAt") VALUES('student',false,'DAILY',NOW()); INSERT INTO "UserNotification"(id,"userId","clubId","eventKey",type,title,body,href) VALUES('existing','student','club','keep','ANNOUNCEMENT','Keep','Body','/');`);
 if(applied.has(decision))await db.exec(`INSERT INTO "DecisionLetter"(id,"applicationId","clubId",version,decision,content) VALUES('historical','app','club',1,'WAITLISTED','{"body":"Original immutable copy"}')`);
 const tables=['ClubAnnouncement','UserNotification','UserNotificationPreference','NotificationEmailOutbox',...(applied.has(decision)?['DecisionLetter']:[])],before={};
 for(const t of tables)before[t]=(await db.query(`SELECT to_jsonb(t)::text AS data FROM "${t}" t ORDER BY 1`)).rows;
 // Pending older decision migration is applied after current-main's newer migration.
 for(const n of names.filter(n=>!applied.has(n)))await apply(n);
 for(const t of tables)assert.deepEqual((await db.query(`SELECT to_jsonb(t)::text AS data FROM "${t}" t ORDER BY 1`)).rows,before[t],t);
 assert.deepEqual((await db.query(`SELECT c.relowner::regrole::text AS owner,c.relrowsecurity AS rls FROM pg_class c WHERE c.relname='DecisionLetter'`)).rows[0],{owner:'outclass_production_app',rls:true});
 assert.deepEqual((await db.query(`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname='outclass_production_app'`)).rows[0],{rolsuper:false,rolbypassrls:false});
 assert.equal((await db.query(`SELECT has_schema_privilege('outclass_production_app','public','CREATE') AS allowed`)).rows[0].allowed,false);
 assert.equal((await db.query(`SELECT polpermissive,pg_get_expr(polqual,polrelid) AS predicate FROM pg_policy WHERE polname='outclass_decision_letters_server_only'`)).rows[0].polpermissive,false);
 await db.exec('SET ROLE outclass_production_app');await db.query('SELECT * FROM "DecisionLetter"');
 await db.exec(`BEGIN; UPDATE "Application" SET status='ACCEPTED',"decisionVersion"=2 WHERE id='app'; INSERT INTO "DecisionLetter"(id,"applicationId","clubId",version,decision,content) VALUES('published','app','club',2,'ACCEPTED','{"body":"Authorized server snapshot"}'); INSERT INTO "UserNotification"(id,"userId","clubId","eventKey",type,title,body,href) VALUES('decision-event','student','club','decision:app:2','DECISION','Decision available','Sign in','/applications/app/decision'); COMMIT`);
 assert.equal((await db.query(`SELECT count(*)::int AS count FROM "NotificationEmailOutbox" WHERE "notificationId"='decision-event'`)).rows[0].count,1);
 await assert.rejects(db.exec(`UPDATE "DecisionLetter" SET content='{}' WHERE id='published'`),/immutable/);
 await db.exec('RESET ROLE');
 for(const role of ['anon','authenticated']){
  for(const action of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege('${role}','"DecisionLetter"','${action}') AS allowed`)).rows[0].allowed,false);
  await db.exec('SET ROLE '+role);for(const statement of ['SELECT * FROM "DecisionLetter"', `INSERT INTO "DecisionLetter"(id,"applicationId","clubId",version,decision,content) VALUES('forged','app','club',3,'ACCEPTED','{}')`, `UPDATE "DecisionLetter" SET content='{}' WHERE id='published'`, `DELETE FROM "DecisionLetter" WHERE id='published'`])await assert.rejects(db.query(statement),/permission denied/);await db.exec('RESET ROLE');
 }
 await apply(repair);assert.equal((await db.query(`SELECT count(*)::int AS count FROM "DecisionLetter" WHERE id='published'`)).rows[0].count,1);
 }finally{await db.close()}
});
test('DecisionLetter runtime repair does nothing without the bounded role',async()=>{const db=new PGlite();try{await db.exec(sql(repair));assert.equal((await db.query(`SELECT count(*)::int AS count FROM pg_roles WHERE rolname='outclass_production_app'`)).rows[0].count,0)}finally{await db.close()}});
