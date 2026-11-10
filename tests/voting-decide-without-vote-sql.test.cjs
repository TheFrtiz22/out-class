const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('database guards accept the atomic decide-without-vote sequence, keep cast ballots, and refuse late ballots',{timeout:240000},async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
 for(const n of fs.readdirSync('prisma/migrations').filter(n=>fs.existsSync(path.join('prisma/migrations',n,'migration.sql'))).sort())await db.exec(fs.readFileSync(path.join('prisma/migrations',n,'migration.sql'),'utf8'));
 await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','owner@virginia.edu'),('voter','voter@virginia.edu'),('s1','s1@virginia.edu'),('s2','s2@virginia.edu');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other');
 INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('lead','club','owner','PRESIDENT'),('mem','club','voter','GENERAL_MEMBER');
 INSERT INTO "RecruitmentCycle"(id,"clubId",name) VALUES('cycle','club','QA'); INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0);
 INSERT INTO "Application"(id,"clubId","studentId","roundId","recruitmentCycleId",status) VALUES('a1','club','s1','round','cycle','IN_REVIEW'),('a2','club','s2','round','cycle','IN_REVIEW');
 INSERT INTO "VotingSession"(id,"clubId","roundId","cycleId",mode,"leaderMemberIds","targetSize","createdBy","updatedAt") VALUES('live','club','round','cycle','LIVE',ARRAY['lead'],1,'owner',NOW());
 INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('live','a1',0,'IN_REVIEW'),('live','a2',1,'IN_REVIEW');
 INSERT INTO "VotingParticipant"("sessionId","memberId") VALUES('live','lead'),('live','mem');
 INSERT INTO "VotingPass"("sessionId",number) VALUES('live',1); INSERT INTO "VotingPassCandidate"("sessionId","passNumber","applicationId",position) VALUES('live',1,'a1',0),('live',1,'a2',1);
 UPDATE "VotingSession" SET state='OPEN',"currentPass"=1,"activeApplicationId"='a1',"startedAt"=NOW(),"joinOpenedAt"=NOW() WHERE id='live';`);
 const key=`"sessionId"='live' AND "passNumber"=1`;
 // Applicant 1: voting open with one ballot, then the leader decides without a vote.
 await db.exec(`UPDATE "VotingPassCandidate" SET "ballotState"='OPEN',"openedAt"=NOW() WHERE ${key} AND "applicationId"='a1'`);
 await db.exec(`INSERT INTO "VotingBallot"(id,"sessionId","passNumber","applicationId","memberId",decision) VALUES('b1','live',1,'a1','mem','PASS')`);
 await db.exec(`BEGIN;
  UPDATE "VotingPassCandidate" SET "ballotState"='CLOSED',"closedAt"=NOW() WHERE ${key} AND "applicationId"='a1';
  UPDATE "VotingPassCandidate" SET "ballotState"='CONFIRMED',"confirmedDecision"='NOT_PASS',"confirmedBy"='owner',"confirmedAt"=NOW(),override='NOT_PASS',"overrideBy"='owner',"overrideAt"=NOW() WHERE ${key} AND "applicationId"='a1';
  COMMIT;`);
 const row=(await db.query(`SELECT "ballotState","confirmedDecision",override,"withoutVote" FROM "VotingPassCandidate" WHERE ${key} AND "applicationId"='a1'`)).rows[0];
 assert.deepEqual(row,{ballotState:'CONFIRMED',confirmedDecision:'NOT_PASS',override:'NOT_PASS',withoutVote:false});
 assert.equal((await db.query(`SELECT decision FROM "VotingBallot" WHERE "applicationId"='a1'`)).rows[0].decision,'PASS','cast ballot preserved');
 await assert.rejects(db.exec(`INSERT INTO "VotingBallot"(id,"sessionId","passNumber","applicationId","memberId",decision) VALUES('b2','live',1,'a1','lead','PASS')`),'late ballot refused');
 // Applicant 2: pending, decided without a vote (open+close+confirm in one transaction), no ballots.
 await db.exec(`UPDATE "VotingSession" SET "activeApplicationId"='a2' WHERE id='live'`);
 await db.exec(`BEGIN;
  UPDATE "VotingPassCandidate" SET "ballotState"='OPEN',"openedAt"=NOW() WHERE ${key} AND "applicationId"='a2';
  UPDATE "VotingPassCandidate" SET "ballotState"='CLOSED',"closedAt"=NOW() WHERE ${key} AND "applicationId"='a2';
  UPDATE "VotingPassCandidate" SET "ballotState"='CONFIRMED',"confirmedDecision"='PASS',"confirmedBy"='owner',"confirmedAt"=NOW(),override='PASS',"overrideBy"='owner',"overrideAt"=NOW() WHERE ${key} AND "applicationId"='a2';
  COMMIT;`);
 assert.equal((await db.query(`SELECT count(*)::int n FROM "VotingBallot" WHERE "applicationId"='a2'`)).rows[0].n,0,'no synthetic ballots');
 // A confirmed outcome cannot be moved back to open or rewritten into a different state outside Undo/Correct.
 await assert.rejects(db.exec(`UPDATE "VotingPassCandidate" SET "ballotState"='OPEN' WHERE ${key} AND "applicationId"='a2'`),/Invalid ballot transition/);
 }finally{await db.close();}
});
