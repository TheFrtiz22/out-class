const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('setup migration preserves legacy publication and permits only explicitly scoped pre-pass roster replacement',{timeout:180000},async()=>{
 const db=new PGlite(),dir='prisma/migrations';try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 for(const name of fs.readdirSync(dir).filter(n=>fs.existsSync(path.join(dir,n,'migration.sql'))).sort())await db.exec(fs.readFileSync(path.join(dir,name,'migration.sql'),'utf8'));
 await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','owner@virginia.edu'),('student','student@virginia.edu'); INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other'); INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('member','club','owner','PRESIDENT'); INSERT INTO "RecruitmentCycle"(id,"clubId",name) VALUES('cycle','club','QA'); INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0); INSERT INTO "Application"(id,"clubId","studentId","roundId","recruitmentCycleId",status) VALUES('app','club','student','round','cycle','IN_REVIEW');
 INSERT INTO "VotingSession"(id,"clubId","roundId","targetSize","createdBy","updatedAt") VALUES('legacy','club','round',1,'owner',NOW()); INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('legacy','app',0,'IN_REVIEW'); UPDATE "VotingCandidate" SET "publishedStatus"='ACCEPTED' WHERE "sessionId"='legacy';
 INSERT INTO "VotingSession"(id,"clubId","roundId","cycleId",mode,"leaderMemberIds","targetSize","createdBy","updatedAt","presentationOptions") VALUES('live','club','round','cycle','LIVE',ARRAY['member'],1,'owner',NOW(),jsonb_build_object('fields',jsonb_build_array('name'),'highlights','{}'::jsonb,'meeting',jsonb_build_object('status','SCHEDULED','plannedAt',(NOW()+interval '1 day')::text)));
 INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('live','app',0,'IN_REVIEW'); INSERT INTO "VotingParticipant"("sessionId","memberId") VALUES('live','member');`);
 await assert.rejects(db.exec(`DELETE FROM "VotingParticipant" WHERE "sessionId"='live'`),/frozen/);
 await assert.rejects(db.exec(`DELETE FROM "VotingCandidate" WHERE "sessionId"='live'`),/frozen/);
 await db.exec(`BEGIN; SELECT set_config('outclass.voting_setup_edit','confirmed',true); DELETE FROM "VotingParticipant" WHERE "sessionId"='live'; DELETE FROM "VotingCandidate" WHERE "sessionId"='live'; INSERT INTO "VotingParticipant"("sessionId","memberId") VALUES('live','member'); INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('live','app',0,'IN_REVIEW'); COMMIT;`);
 await assert.rejects(db.exec(`UPDATE "VotingSession" SET state='OPEN',"startedAt"=NOW() WHERE id='live'`),/early voting/);
 await db.exec(`BEGIN; SELECT set_config('outclass.voting_early_start','confirmed',true); INSERT INTO "VotingPass"("sessionId",number) VALUES('live',1); UPDATE "VotingSession" SET state='OPEN',"currentPass"=1,"startedAt"=NOW() WHERE id='live'; COMMIT;`);
 await db.exec('BEGIN');await db.exec(`SELECT set_config('outclass.voting_setup_edit','confirmed',true)`);await assert.rejects(db.exec(`DELETE FROM "VotingCandidate" WHERE "sessionId"='live'`),/frozen/);await db.exec('ROLLBACK');
 assert.equal((await db.query(`SELECT "publishedStatus" FROM "VotingCandidate" WHERE "sessionId"='legacy'`)).rows[0].publishedStatus,'ACCEPTED');
 assert.equal((await db.query(`SELECT has_table_privilege('authenticated','"VotingSession"','SELECT') AS allowed`)).rows[0].allowed,false);
 assert.equal((await db.query(`SELECT has_function_privilege('anon','outclass_voting_meeting_guard()','EXECUTE') AS allowed`)).rows[0].allowed,false);
 }finally{await db.close();}
});
