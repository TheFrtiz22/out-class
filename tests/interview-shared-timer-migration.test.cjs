const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('shared timer migration: additive, LF, one row per room, revision-ordered, same-club attribution, runtime-only access',{timeout:240000},async()=>{
 const file='prisma/migrations/20261111180000_interview_shared_timer/migration.sql',sql=fs.readFileSync(file,'utf8');
 assert.ok(!sql.includes('\r'),'LF line endings');assert.match(sql,/^BEGIN; SET LOCAL lock_timeout='5s';/);
 assert.doesNotMatch(sql,/\b(DROP|TRUNCATE|DELETE FROM)\b|ALTER TABLE "(?!InterviewTimer")/i,'touches no existing table');
 // Must sort after migrations already applied in production (incl. 20261111120000_voting_setup_edit_prepared, PR #290).
 assert.ok('20261111180000_interview_shared_timer'>'20261111120000_voting_setup_edit_prepared');assert.ok(fs.readdirSync('prisma/migrations').filter(n=>/^\d{14}_/.test(n)&&n<'20261111180000').every(n=>!n.includes('interview_shared_timer')),'no earlier copy of this migration');
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
 for(const n of fs.readdirSync('prisma/migrations').filter(n=>fs.existsSync(path.join('prisma/migrations',n,'migration.sql'))).sort())await db.exec(fs.readFileSync(path.join('prisma/migrations',n,'migration.sql'),'utf8'));
 await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','o@virginia.edu'),('rev','r@virginia.edu'),('s1','s1@virginia.edu'),('other','x@virginia.edu');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other'),('club2','club2','QB','','','#142d45','Other');
 INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('lead','club','owner','PRESIDENT'),('mem','club','rev','GENERAL_MEMBER'),('foreign','club2','other','GENERAL_MEMBER');
 INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0);
 INSERT INTO "Application"(id,"clubId","studentId","roundId",status) VALUES('a1','club','s1','round','INTERVIEWING');
 INSERT INTO "InterviewCollaboration"(id,"clubId","applicationId","roundId","roomKey",questions) VALUES('room','club','a1','round','panel:a1','[]');`);
 const insert=(member='mem',extra='')=>db.exec(`INSERT INTO "InterviewTimer"("sessionId","durationMs","contextKey","updatedBy"${extra?',"startedAt","pausedMs"':''}) VALUES('room',1200000,'round:club:round:20','${member}'${extra})`);
 await assert.rejects(insert('foreign'),/member scope/,'another club cannot be attributed');
 await assert.rejects(db.exec(`INSERT INTO "InterviewTimer"("sessionId","durationMs","contextKey") VALUES('missing',1200000,'k')`),/foreign key/i);
 await assert.rejects(db.exec(`INSERT INTO "InterviewTimer"("sessionId","durationMs","contextKey") VALUES('room',14400001,'k')`),/duration_range/);
 await assert.rejects(insert('mem',`,NULL,5`),/InterviewTimer_state/,'no paused time without a start');
 await insert();await assert.rejects(insert(),/duplicate|unique/i,'one timer per room');
 await db.exec(`UPDATE "InterviewTimer" SET "startedAt"=NOW(),revision=revision+1`);
 await assert.rejects(db.exec(`UPDATE "InterviewTimer" SET "pausedAt"=NOW()`),/revision/,'every change advances the revision by one');
 await assert.rejects(db.exec(`UPDATE "InterviewTimer" SET "pausedAt"="startedAt"-interval '1 second',revision=revision+1`),/InterviewTimer_state/);
 await assert.rejects(db.exec(`UPDATE "InterviewTimer" SET "sessionId"='other',revision=revision+1`),/identity|foreign key/i);
 // Removing the member who last pressed a control clears attribution without a timer change.
 await db.exec(`DELETE FROM "ClubMember" WHERE id='mem'`);
 const [row]=(await db.query(`SELECT revision,"updatedBy" FROM "InterviewTimer"`)).rows;assert.deepEqual(row,{revision:2,updatedBy:null});
 assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='InterviewTimer'`)).rows[0].relrowsecurity,true);
 for(const role of ['anon','authenticated'])for(const p of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege($1,'"InterviewTimer"',$2) ok`,[role,p])).rows[0].ok,false);
 for(const role of ['anon','authenticated'])assert.equal((await db.query(`SELECT has_function_privilege($1,'outclass_interview_timer_guard()','EXECUTE') ok`,[role])).rows[0].ok,false);
 assert.deepEqual(await Promise.all(['SELECT','INSERT','UPDATE','DELETE'].map(async p=>(await db.query(`SELECT has_table_privilege('outclass_production_app','"InterviewTimer"',$1) ok`,[p])).rows[0].ok)),[true,true,true,false]);
 assert.deepEqual((await db.query(`SELECT policyname FROM pg_policies WHERE tablename='InterviewTimer' ORDER BY 1`)).rows.map(r=>r.policyname),['interview_timer_runtime_insert','interview_timer_runtime_read','interview_timer_runtime_update']);
 assert.deepEqual((await db.query(`SELECT DISTINCT unnest(roles)::text r FROM pg_policies WHERE tablename='InterviewTimer'`)).rows.map(r=>r.r),['outclass_production_app']);
 await db.exec(`DELETE FROM "Application" WHERE id='a1'`);
 assert.equal((await db.query(`SELECT count(*)::int n FROM "InterviewTimer"`)).rows[0].n,0,'removed with the room');
 }finally{await db.close();}
});
test('shared timer migration under production-like ownership: the runtime role can insert and advance a timer; the guard still refuses bad writes',{timeout:240000},async()=>{
 const name='20261111180000_interview_shared_timer',dir='prisma/migrations';
 const names=fs.readdirSync(dir).filter(n=>fs.existsSync(path.join(dir,n,'migration.sql'))).sort();
 const db=new PGlite();try{
 // Same role shape as tests/production-communications-runtime-migration.test.cjs: a bounded, non-bypassing runtime
 // role that owns the existing application tables, and a non-superuser migration operator.
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE migration_operator NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT outclass_production_app TO migration_operator; ALTER SCHEMA public OWNER TO migration_operator; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated`);
 for(const n of names.filter(n=>n<name))await db.exec(fs.readFileSync(path.join(dir,n,'migration.sql'),'utf8'));
 for(const {tablename} of (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`)).rows)await db.exec(`ALTER TABLE public."${tablename}" OWNER TO outclass_production_app`);
 await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','o@virginia.edu'),('rev','r@virginia.edu'),('s1','s1@virginia.edu'),('other','x@virginia.edu');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other'),('club2','club2','QB','','','#142d45','Other');
 INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('lead','club','owner','PRESIDENT'),('mem','club','rev','GENERAL_MEMBER'),('foreign','club2','other','GENERAL_MEMBER');
 INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0);
 INSERT INTO "Application"(id,"clubId","studentId","roundId",status) VALUES('a1','club','s1','round','INTERVIEWING');
 INSERT INTO "InterviewCollaboration"(id,"clubId","applicationId","roundId","roomKey",questions) VALUES('room','club','a1','round','panel:a1','[]');`);
 await db.exec('SET ROLE migration_operator');await db.exec(fs.readFileSync(path.join(dir,name,'migration.sql'),'utf8'));await db.exec('RESET ROLE');
 assert.equal((await db.query(`SELECT tableowner FROM pg_tables WHERE tablename='InterviewTimer'`)).rows[0].tableowner,'migration_operator');
 await db.exec('SET ROLE outclass_production_app');
 try{
  assert.equal((await db.query('SELECT current_user u')).rows[0].u,'outclass_production_app');
  // The guard's EXISTS over InterviewCollaboration and ClubMember runs as this role, under RLS on InterviewTimer.
  await db.exec(`INSERT INTO "InterviewTimer"("sessionId","durationMs","contextKey","updatedBy") VALUES('room',1200000,'round:club:round:20','mem')`);
  const updated=await db.query(`UPDATE "InterviewTimer" SET revision=revision+1,"startedAt"=NOW(),"updatedBy"='lead' WHERE "sessionId"='room' AND revision=1 RETURNING revision`);
  assert.deepEqual(updated.rows,[{revision:2}]);
  assert.deepEqual((await db.query(`SELECT revision,"updatedBy" FROM "InterviewTimer"`)).rows,[{revision:2,updatedBy:'lead'}]);
  await assert.rejects(db.exec(`UPDATE "InterviewTimer" SET revision=revision+2 WHERE "sessionId"='room'`),/identity\/revision mismatch/);
  await assert.rejects(db.exec(`UPDATE "InterviewTimer" SET revision=revision+1,"updatedBy"='foreign' WHERE "sessionId"='room'`),/member scope mismatch/);
  await assert.rejects(db.exec(`DELETE FROM "InterviewTimer"`),/permission denied/);
 }finally{await db.exec('RESET ROLE');}
 assert.deepEqual((await db.query(`SELECT revision,"updatedBy" FROM "InterviewTimer"`)).rows,[{revision:2,updatedBy:'lead'}]);
 }finally{await db.close();}
});
