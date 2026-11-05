const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('voting rules migration: retained revisioned defaults, insert-only ballot snapshots, runtime-only access',{timeout:240000},async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
 for(const n of fs.readdirSync('prisma/migrations').filter(n=>fs.existsSync(path.join('prisma/migrations',n,'migration.sql'))).sort())await db.exec(fs.readFileSync(path.join('prisma/migrations',n,'migration.sql'),'utf8'));
 await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','owner@virginia.edu'),('student','student@virginia.edu');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other'),('other','other','Other','','','#142d45','Other');
 INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('member','club','owner','PRESIDENT');
 INSERT INTO "RecruitmentCycle"(id,"clubId",name) VALUES('cycle','club','QA');
 INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0),('foreign','other','Other',0);
 INSERT INTO "Application"(id,"clubId","studentId","roundId","recruitmentCycleId",status) VALUES('app','club','student','round','cycle','IN_REVIEW');
 INSERT INTO "VotingSession"(id,"clubId","roundId","cycleId",mode,"leaderMemberIds","targetSize","createdBy","updatedAt") VALUES('live','club','round','cycle','LIVE',ARRAY['member'],1,'owner',NOW());
 INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('live','app',0,'IN_REVIEW');
 INSERT INTO "VotingParticipant"("sessionId","memberId") VALUES('live','member');
 INSERT INTO "VotingPass"("sessionId",number) VALUES('live',1); INSERT INTO "VotingPassCandidate"("sessionId","passNumber","applicationId",position) VALUES('live',1,'app',0);`);
 const rule=JSON.stringify({mode:'THRESHOLD',threshold:{numerator:2,denominator:3},denominator:'BALLOTS_CAST',minimumParticipation:{numerator:1,denominator:2},belowThreshold:'HOLD',reviewed:true});
 // Defaults: one per club and per round, revisioned, retained, same-club rounds only.
 await db.query(`INSERT INTO "VotingRuleDefault"(id,"clubId",rules,"updatedBy") VALUES('d1','club',$1::jsonb,'owner')`,[rule]);
 await assert.rejects(db.query(`INSERT INTO "VotingRuleDefault"(id,"clubId",rules,"updatedBy") VALUES('d2','club',$1::jsonb,'owner')`,[rule]),/unique|duplicate/i);
 await db.query(`INSERT INTO "VotingRuleDefault"(id,"clubId","roundId",rules,"updatedBy") VALUES('d3','club','round','{"mode":"LEADER_CONFIRMS"}','owner')`);
 await assert.rejects(db.query(`INSERT INTO "VotingRuleDefault"(id,"clubId","roundId",rules,"updatedBy") VALUES('d4','club','foreign','{"mode":"LEADER_CONFIRMS"}','owner')`),/another club/);
 await assert.rejects(db.query(`INSERT INTO "VotingRuleDefault"(id,"clubId",rules,"updatedBy") VALUES('d5','other','{"mode":"AUTO"}','owner')`),/check/i);
 await assert.rejects(db.exec(`UPDATE "VotingRuleDefault" SET rules='{"mode":"LEADER_CONFIRMS"}' WHERE id='d1'`),/concurrently/);
 await db.exec(`UPDATE "VotingRuleDefault" SET rules='{"mode":"LEADER_CONFIRMS"}',revision=2 WHERE id='d1'`);await assert.rejects(db.exec(`DELETE FROM "VotingRuleDefault"`),/retained/);
 // Ballot snapshots: only while that ballot is open, before any ballot; resolutions only remove voters, keep the rule, need a reason.
 const snap=(v,electorate,reason=null,r=rule)=>db.query(`INSERT INTO "VotingBallotRule"("sessionId","passNumber","applicationId",version,rules,electorate,reason,"createdBy") VALUES('live',1,'app',$1,$2::jsonb,$3,$4,'owner')`,[v,r,electorate,reason]);
 await assert.rejects(snap(1,['member','b']),/only while that ballot is open/);
 await db.exec(`UPDATE "VotingSession" SET state='OPEN',"currentPass"=1,"activeApplicationId"='app',"startedAt"=NOW(),"joinOpenedAt"=NOW() WHERE id='live'`);
 await db.exec(`UPDATE "VotingPassCandidate" SET "ballotState"='OPEN',"openedAt"=NOW()`);
 await snap(1,['member','b','c']);
 await db.exec(`INSERT INTO "VotingBallot"(id,"sessionId","passNumber","applicationId","memberId",decision) VALUES('b1','live',1,'app','member','PASS')`);
 await assert.rejects(snap(2,['member','b','c','d'],'Add'),/only remove voters/);await assert.rejects(snap(2,['member','b']),/reason/);
 await assert.rejects(snap(2,['member','b'],'Changed rule','{"mode":"LEADER_CONFIRMS"}'),/keep the rule/);
 await snap(2,['member','b'],'Lost eligibility');
 await assert.rejects(db.exec(`UPDATE "VotingBallotRule" SET reason='x'`),/immutable/);await assert.rejects(db.exec(`DELETE FROM "VotingBallotRule"`),/immutable/);
 await db.exec(`UPDATE "VotingPassCandidate" SET "ballotState"='CLOSED',"closedAt"=NOW()`);
 await assert.rejects(snap(3,['member'],'After close'),/only while that ballot is open/);
 assert.deepEqual((await db.query(`SELECT version,electorate FROM "VotingBallotRule" ORDER BY version`)).rows.map(r=>[r.version,r.electorate.length]),[[1,3],[2,2]]);
 // RLS, browser denial, runtime grants and policies.
 for(const t of ['VotingRuleDefault','VotingBallotRule']){assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname=$1`,[t])).rows[0].relrowsecurity,true);
  for(const role of ['anon','authenticated'])for(const p of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege($1,$2,$3) AS ok`,[role,`"${t}"`,p])).rows[0].ok,false,`${role} ${p} ${t}`);}
 const grant=async(t,p)=>(await db.query(`SELECT has_table_privilege('outclass_production_app',$1,$2) AS ok`,[`"${t}"`,p])).rows[0].ok;
 assert.deepEqual(await Promise.all(['SELECT','INSERT','UPDATE','DELETE'].map(p=>grant('VotingRuleDefault',p))),[true,true,true,false]);
 assert.deepEqual(await Promise.all(['SELECT','INSERT','UPDATE','DELETE'].map(p=>grant('VotingBallotRule',p))),[true,true,false,false]);
 }finally{await db.close();}
});
