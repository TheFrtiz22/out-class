const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('observation migration preserves legacy rows, revisions and frozen presentation evidence with private SQL access',{timeout:180000},async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
 const runtimeMigration='20261103200000_additional_observation_runtime_access';
 for(const n of fs.readdirSync('prisma/migrations').filter(n=>n!==runtimeMigration&&fs.existsSync(path.join('prisma/migrations',n,'migration.sql'))).sort())await db.exec(fs.readFileSync(path.join('prisma/migrations',n,'migration.sql'),'utf8'));
 await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','owner@virginia.edu'),('student','student@virginia.edu'); INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other'); INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('member','club','owner','PRESIDENT'); INSERT INTO "RecruitmentCycle"(id,"clubId",name) VALUES('cycle','club','QA'); INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0); INSERT INTO "Application"(id,"clubId","studentId","roundId","recruitmentCycleId",status) VALUES('app','club','student','round','cycle','IN_REVIEW'); INSERT INTO "ApplicantObservation"(id,"applicationId","authorId",kind,body,"anonymousReview","updatedAt") VALUES('legacy','app','owner','PRO','Preserved legacy pro',false,NOW());
 INSERT INTO "VotingSession"(id,"clubId","roundId","cycleId",mode,"leaderMemberIds","targetSize","createdBy","updatedAt") VALUES('live','club','round','cycle','LIVE',ARRAY['member'],1,'owner',NOW()); INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('live','app',0,'IN_REVIEW');`);
 const history=[{revision:1,requestId:'request-1',body:'Specific firsthand observation.',interactionContext:'Club event',actorId:'owner',at:new Date().toISOString(),removed:false,reason:''}];
 const insert=async(body,scope='club')=>db.query(`INSERT INTO "ApplicantObservation"(id,"applicationId","authorId",kind,body,"anonymousReview","updatedAt","clubId","cycleId","roundId","interactionContext",history) VALUES($1,'app','owner','ADDITIONAL',$2,false,NOW(),$3,'cycle','round','Club event',$4::jsonb)`,['additional',body,scope,JSON.stringify([{...history[0],body}])]);
 await assert.rejects(insert('x '.repeat(51)),/50 words/);await assert.rejects(insert('x\u00a0'.repeat(51)),/50 words/);await assert.rejects(insert('Specific firsthand observation.','other-club'),/context/);await insert(history[0].body);
 const snapshot={id:'additional',revision:1,body:history[0].body,interactionContext:'Club event',author:'QA Reviewer',roundId:'round',roundName:'QA',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 await db.query(`INSERT INTO "VotingObservationReference"("sessionId","observationId","applicationId",revision,snapshot) VALUES('live','additional','app',1,$1::jsonb)`,[JSON.stringify(snapshot)]);
 const before=(await db.query(`SELECT snapshot FROM "VotingObservationReference"`)).rows[0].snapshot;
 await assert.rejects(db.exec(`UPDATE "ApplicantObservation" SET body='Silent change' WHERE id='additional'`),/immutable/);
 const next=[...history,{...history[0],revision:2,requestId:'request-2',body:'A recorded correction.',reason:'Moderated factual correction.'}];
 await db.query(`UPDATE "ApplicantObservation" SET body=$1,revision=2,history=$2::jsonb WHERE id='additional'`,[next[1].body,JSON.stringify(next)]);assert.deepEqual((await db.query(`SELECT snapshot FROM "VotingObservationReference"`)).rows[0].snapshot,before);
 await assert.rejects(db.exec(`DELETE FROM "ApplicantObservation" WHERE id='additional'`),/retained/);await assert.rejects(db.exec(`UPDATE "VotingObservationReference" SET revision=2`),/immutable/);await assert.rejects(db.exec(`DELETE FROM "VotingObservationReference"`),/immutable/);
 assert.equal((await db.query(`SELECT body FROM "ApplicantObservation" WHERE id='legacy'`)).rows[0].body,'Preserved legacy pro');
 for(const role of ['anon','authenticated'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege($1,'"VotingObservationReference"',$2) AS allowed`,[role,privilege])).rows[0].allowed,false);
 assert.equal((await db.query(`SELECT has_table_privilege('outclass_production_app','"VotingObservationReference"','SELECT') AS allowed`)).rows[0].allowed,true);
 assert.equal((await db.query(`SELECT has_table_privilege('outclass_production_app','"VotingObservationReference"','UPDATE') AS allowed`)).rows[0].allowed,false);
 // Match production's bounded role ownership of the three existing core tables.
 // The new reference table deliberately remains postgres-owned with RLS enabled.
 await db.exec(`GRANT CREATE ON SCHEMA public TO outclass_production_app; ALTER TABLE "VotingSession" OWNER TO outclass_production_app; ALTER TABLE "VotingCandidate" OWNER TO outclass_production_app; ALTER TABLE "ApplicantObservation" OWNER TO outclass_production_app; REVOKE CREATE ON SCHEMA public FROM outclass_production_app;
 INSERT INTO "VotingSession"(id,"clubId","roundId","cycleId",mode,"leaderMemberIds","targetSize","createdBy","updatedAt") VALUES('live2','club','round','cycle','LIVE',ARRAY['member'],1,'owner',NOW()); INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('live2','app',0,'IN_REVIEW');`);
 const second={...snapshot,revision:2,body:next[1].body};const insertReference=()=>db.query(`INSERT INTO "VotingObservationReference"("sessionId","observationId","applicationId",revision,snapshot) VALUES('live2','additional','app',2,$1::jsonb)`,[JSON.stringify(second)]);
 await db.exec('SET ROLE outclass_production_app');assert.equal((await db.query('SELECT * FROM "VotingObservationReference"')).rows.length,0,'Original grants alone cannot read existing references');
 await assert.rejects(insertReference(),/row-level security/);await db.exec('RESET ROLE');
 await db.exec(fs.readFileSync(path.join('prisma/migrations',runtimeMigration,'migration.sql'),'utf8'));
 await db.exec('SET ROLE outclass_production_app');await insertReference();assert.equal((await db.query('SELECT * FROM "VotingObservationReference"')).rows.length,2);await assert.rejects(db.exec('UPDATE "VotingObservationReference" SET revision=3'),/permission denied/);await db.exec('RESET ROLE');
 for(const role of ['anon','authenticated']){assert.equal((await db.query(`SELECT has_table_privilege($1,'"VotingObservationReference"','SELECT,INSERT,UPDATE,DELETE') AS allowed`,[role])).rows[0].allowed,false);}
 }finally{await db.close();}
});
