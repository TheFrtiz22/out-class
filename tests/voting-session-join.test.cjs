const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,load,uuid,clubId,roundId,ids,sessionId,memberId,otherId}=require('./helpers/voting-harness.cjs');
const presentation=load('lib/voting-presentation.ts');
test('display selection persists as a session snapshot; setup edits and lobby/start/history locks are enforced',async()=>{
 const h=harness();await h.api.createVotingSession({clubId,roundId,applicationIds:ids,participantIds:[memberId],targetSize:3,displayConfig:{version:1,fields:['name','photo','act']}});
 assert.deepEqual((await h.read()).session.displayConfig.fields,['name','photo','act']);
 await h.command('CONFIGURE',{displayConfig:{version:1,fields:['name','major']}});await h.command('OPEN_JOIN');
 await assert.rejects(h.command('CONFIGURE',{displayConfig:{version:1,fields:['gpa']}}),/locked/);
 await h.command('START_PASS');await h.vote(ids[0],'PASS');await h.command('COMPLETE_PASS');await h.command('FINISH');await h.command('REOPEN');
 await assert.rejects(h.command('CONFIGURE',{displayConfig:{version:1,fields:[]}}),/locked/);
 assert.deepEqual((await h.read()).session.displayConfig.fields,['name','major']);
 assert.equal(h.state().sessions[0].passes[0].candidates[0].ballots[0].decision,'PASS');
});
test('configuration rejects oversized/duplicated content, ACT subsections, duplicate fields and unauthorized participants',async()=>{
 for(const fields of [['major','graduationYear','gpa','sat','act','answers','pros','cons','feedback'],['actEnglish'],['name','name'],['resume','experiences']])assert.equal(presentation.votingDisplaySchema.safeParse({version:1,fields}).success,false);
 assert.equal(presentation.votingDisplaySchema.safeParse({version:1,fields:['experiences','pros','cons']}).success,true);
 const h=harness();await h.create();h.as(otherId);await assert.rejects(h.command('CONFIGURE',{displayConfig:{version:1,fields:['gpa']}}),/Denied/);await assert.rejects(h.command('OPEN_JOIN'),/Denied/);await assert.rejects(h.api.createVotingSession({clubId:uuid(99),roundId,applicationIds:ids,participantIds:[otherId],targetSize:1}),/Denied/);
});
test('QR links contain only a UUID, scope Demo explicitly and reuse safe sign-in return handling',()=>{
 assert.equal(presentation.votingJoinPath(sessionId),`/voting/${sessionId}/join`);assert.equal(presentation.votingJoinPath(sessionId,true),`/voting/${sessionId}/join?demo=1`);assert.throws(()=>presentation.votingJoinPath('1'));
 const auth=load('lib/auth.ts');assert.equal(auth.signInReturnPath(presentation.votingJoinPath(sessionId)),presentation.votingJoinPath(sessionId));assert.equal(auth.safeReturnPath('//evil.example'),'/');
});
test('join verifies existence, authentication, membership, capabilities, joinability, and reuses participants',async()=>{
 const h=harness();await h.create();assert.equal((await h.api.getVotingJoinInfo(uuid(100))).status,'NOT_FOUND');assert.equal((await h.api.getVotingJoinInfo(sessionId)).status,'NOT_JOINABLE');await assert.rejects(h.api.joinVotingSession(sessionId),/not joinable/);
 h.as(null);await assert.rejects(h.api.getVotingJoinInfo(sessionId),/Unauthenticated/);h.as(memberId);await h.command('OPEN_JOIN');h.as(otherId);
 h.members[1].clubId=uuid(99);assert.equal((await h.api.getVotingJoinInfo(sessionId)).status,'UNAUTHORIZED');await assert.rejects(h.api.joinVotingSession(sessionId));h.members[1].clubId=clubId;
 for(const cap of ['applications.review','decisions.vote','applicants.identify']){const old=[...h.members[1].permissions];h.members[1].permissions=old.filter(c=>c!==cap);assert.equal((await h.api.getVotingJoinInfo(sessionId)).status,'UNAUTHORIZED');h.members[1].permissions=old}
 const joins=await Promise.all([h.api.joinVotingSession(sessionId),h.api.joinVotingSession(sessionId)]);assert.equal(joins.filter(j=>j.alreadyJoined).length,1);assert.equal(h.state().sessions[0].participants.filter(p=>p.memberId===otherId).length,1);
 assert.equal((await h.api.getVotingJoinInfo(sessionId)).status,'ALREADY_JOINED');h.as(memberId);assert.equal((await h.read()).joinedParticipants.find(p=>p.id===otherId).joinedAt instanceof Date,true);h.as(otherId);assert.deepEqual((await h.read()).joinedParticipants,[]);
});
test('the voting roster freezes at start, invited members may check in late, finished sessions reject joins and reopened sessions permit them',async()=>{
 const h=harness();await h.create([memberId,otherId]);await h.command('OPEN_JOIN');await h.api.joinVotingSession(sessionId);await h.command('START_PASS');h.as(otherId);await h.api.joinVotingSession(sessionId);h.as(memberId);await h.command('COMPLETE_PASS');await h.command('FINISH');assert.equal((await h.api.getVotingJoinInfo(sessionId)).status,'FINISHED');await assert.rejects(h.api.joinVotingSession(sessionId));await h.command('REOPEN');assert.equal((await h.api.getVotingJoinInfo(sessionId)).status,'ALREADY_JOINED');await h.api.joinVotingSession(sessionId);
 const locked=harness();await locked.create();await locked.command('START_PASS');locked.as(otherId);assert.equal((await locked.api.getVotingJoinInfo(sessionId)).status,'ROSTER_LOCKED');await assert.rejects(locked.api.joinVotingSession(sessionId));
});
test('active candidate is persisted, synchronized, permission checked and rejects stale ordinary-member ballots',async()=>{
 const h=harness();await h.create([memberId,otherId]);await h.command('START_PASS');assert.equal((await h.read()).session.activeApplicationId,ids[0]);await h.command('SET_CANDIDATE',{applicationId:ids[1]});h.as(otherId);assert.equal((await h.read()).session.activeApplicationId,ids[1]);await assert.rejects(h.vote(ids[0],'PASS'),/changed/);await h.vote(ids[1],'HOLD');await assert.rejects(h.command('SET_CANDIDATE',{applicationId:ids[2]}),/Denied/);h.as(memberId);await assert.rejects(h.command('SET_CANDIDATE',{applicationId:uuid(999)}),/active pass/);await h.command('COMPLETE_PASS');await h.command('START_PASS',{applicationIds:[ids[2]]});assert.equal((await h.read()).session.activeApplicationId,ids[2]);assert.equal(h.state().sessions[0].passes[0].candidates[1].ballots[0].decision,'HOLD');
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
