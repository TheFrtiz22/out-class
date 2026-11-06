const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('hand-raise migration: current-applicant only, retained history, runtime-only access',{timeout:240000},async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
 for(const n of fs.readdirSync('prisma/migrations').filter(n=>fs.existsSync(path.join('prisma/migrations',n,'migration.sql'))).sort())await db.exec(fs.readFileSync(path.join('prisma/migrations',n,'migration.sql'),'utf8'));
 await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','o@virginia.edu'),('voter','v@virginia.edu'),('s1','s1@virginia.edu'),('s2','s2@virginia.edu');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other');
 INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('lead','club','owner','PRESIDENT'),('mem','club','voter','GENERAL_MEMBER');
 INSERT INTO "RecruitmentCycle"(id,"clubId",name) VALUES('cycle','club','QA'); INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0);
 INSERT INTO "Application"(id,"clubId","studentId","roundId","recruitmentCycleId",status) VALUES('a1','club','s1','round','cycle','IN_REVIEW'),('a2','club','s2','round','cycle','IN_REVIEW');
 INSERT INTO "VotingSession"(id,"clubId","roundId","cycleId",mode,"leaderMemberIds","targetSize","createdBy","updatedAt") VALUES('live','club','round','cycle','LIVE',ARRAY['lead'],1,'owner',NOW());
 INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('live','a1',0,'IN_REVIEW'),('live','a2',1,'IN_REVIEW');
 INSERT INTO "VotingParticipant"("sessionId","memberId") VALUES('live','lead'),('live','mem');
 INSERT INTO "VotingPass"("sessionId",number) VALUES('live',1); INSERT INTO "VotingPassCandidate"("sessionId","passNumber","applicationId",position) VALUES('live',1,'a1',0),('live',1,'a2',1);
 UPDATE "VotingSession" SET state='OPEN',"currentPass"=1,"activeApplicationId"='a1',"startedAt"=NOW(),"joinOpenedAt"=NOW() WHERE id='live';`);
 const raise=(app,member='mem')=>db.exec(`INSERT INTO "VotingHandRaise"("sessionId","passNumber","applicationId","memberId") VALUES('live',1,'${app}','${member}')`);
 await assert.rejects(raise('a2'),/currently being discussed/);
 await assert.rejects(raise('a1','outsider'),/foreign key/i);
 await raise('a1');await assert.rejects(raise('a1'),/duplicate|unique/i);
 await db.exec(`UPDATE "VotingHandRaise" SET "acknowledgedAt"=NOW() WHERE "memberId"='mem'`);
 await db.exec(`UPDATE "VotingHandRaise" SET "clearedAt"=NOW() WHERE "memberId"='mem'`);
 await db.exec(`UPDATE "VotingSession" SET "activeApplicationId"='a2' WHERE id='live'`);
 await assert.rejects(db.exec(`UPDATE "VotingHandRaise" SET "clearedAt"=NULL WHERE "memberId"='mem'`),/currently being discussed/,'an old request cannot be revived for a different applicant');
 await assert.rejects(db.exec(`UPDATE "VotingHandRaise" SET "applicationId"='a2'`),/immutable/);
 await assert.rejects(db.exec(`DELETE FROM "VotingHandRaise"`),/retained/);
 assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='VotingHandRaise'`)).rows[0].relrowsecurity,true);
 for(const role of ['anon','authenticated'])for(const p of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege($1,'"VotingHandRaise"',$2) ok`,[role,p])).rows[0].ok,false);
 assert.deepEqual(await Promise.all(['SELECT','INSERT','UPDATE','DELETE'].map(async p=>(await db.query(`SELECT has_table_privilege('outclass_production_app','"VotingHandRaise"',$1) ok`,[p])).rows[0].ok)),[true,true,true,false]);
 }finally{await db.close();}
});
