const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {load,sessionId}=require('./helpers/voting-harness.cjs');
const presentation=load('lib/voting-presentation.ts');
test('QR links contain only a UUID, scope Demo explicitly and reuse safe sign-in return handling',()=>{
 assert.equal(presentation.votingJoinPath(sessionId),`/voting/${sessionId}/join`);assert.equal(presentation.votingJoinPath(sessionId,true),`/voting/${sessionId}/join?demo=1`);assert.throws(()=>presentation.votingJoinPath('1'));
 const auth=load('lib/auth.ts');assert.equal(auth.signInReturnPath(presentation.votingJoinPath(sessionId)),presentation.votingJoinPath(sessionId));assert.equal(auth.safeReturnPath('//evil.example'),'/');
});
test('migration adds snapshots/check-in/candidate state without erasing history and enforces locked snapshots',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE TYPE "AppStatus" AS ENUM ('IN_REVIEW','ACCEPTED','REJECTED','WAITLISTED');CREATE TABLE "Club"(id TEXT PRIMARY KEY);CREATE TABLE "PipelineRound"(id TEXT PRIMARY KEY,"applicantDisplay" JSONB);CREATE TABLE "ClubMember"(id TEXT PRIMARY KEY);CREATE TABLE "Application"(id TEXT PRIMARY KEY);INSERT INTO "Club" VALUES ('c');INSERT INTO "PipelineRound" VALUES ('r','{"version":1,"fields":["name","photo","biography","gpa","act"]}');INSERT INTO "ClubMember" VALUES ('m');INSERT INTO "Application" VALUES ('a');`);
 await db.exec(fs.readFileSync('prisma/migrations/20261003010000_durable_voting/migration.sql','utf8'));
 await db.exec(`INSERT INTO "VotingSession"(id,"clubId","roundId","targetSize","createdBy","updatedAt","startedAt",state,"currentPass") VALUES ('s','c','r',1,'u',NOW(),NOW(),'OPEN',1);INSERT INTO "VotingParticipant" VALUES ('s','m');INSERT INTO "VotingCandidate" VALUES ('s','a',0,'IN_REVIEW',NULL);INSERT INTO "VotingPass"("sessionId",number) VALUES ('s',1);INSERT INTO "VotingPassCandidate"("sessionId","passNumber","applicationId",position) VALUES ('s',1,'a',0);INSERT INTO "VotingBallot"(id,"sessionId","passNumber","applicationId","memberId",decision) VALUES ('b','s',1,'a','m','HOLD');`);
 await db.exec(fs.readFileSync('prisma/migrations/20261004000000_voting_presentation_join/migration.sql','utf8'));
 const row=(await db.query('SELECT * FROM "VotingSession"')).rows[0];assert.deepEqual(row.displayConfig.fields,['name','photo','biography','gpa','act']);assert.equal(row.activeApplicationId,'a');assert.ok(row.joinOpenedAt);
 await db.exec(`UPDATE "PipelineRound" SET "applicantDisplay"='{"version":1,"fields":[]}'`);assert.deepEqual((await db.query('SELECT "displayConfig" FROM "VotingSession"')).rows[0].displayConfig.fields,row.displayConfig.fields);
 await assert.rejects(db.exec(`UPDATE "VotingSession" SET "displayConfig"='{}'`),/locked/);await assert.rejects(db.exec(`UPDATE "VotingSession" SET "activeApplicationId"='outside'`),/current pass/);
 await db.exec(`UPDATE "VotingParticipant" SET "joinedAt"=NOW()`);await assert.rejects(db.exec(`INSERT INTO "VotingParticipant"("sessionId","memberId") VALUES ('s','m')`),/unique/);
 assert.equal((await db.query('SELECT decision FROM "VotingBallot"')).rows[0].decision,'HOLD');assert.equal((await db.query('SELECT number FROM "VotingPass"')).rows[0].number,1);
 }finally{await db.close()}
});

test('session labels distinguish setup, joinable lobby, active voting, finished and published',()=>{
 assert.equal(presentation.votingSessionStage({state:'DRAFT'}),'Session setup');assert.match(presentation.votingSessionStage({state:'DRAFT',joinOpenedAt:new Date()}),/Lobby/);assert.equal(presentation.votingSessionStage({state:'OPEN'}),'Voting active');assert.equal(presentation.votingSessionStage({state:'COMPLETED'}),'Session finished');assert.equal(presentation.votingSessionStage({state:'COMPLETED',publishedAt:new Date()}),'Decisions published');
});
