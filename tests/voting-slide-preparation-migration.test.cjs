const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('slide preparation migration: revisioned working copy, immutable pre-presentation locks, runtime-only access',{timeout:240000},async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
 for(const n of fs.readdirSync('prisma/migrations').filter(n=>fs.existsSync(path.join('prisma/migrations',n,'migration.sql'))).sort())await db.exec(fs.readFileSync(path.join('prisma/migrations',n,'migration.sql'),'utf8'));
 await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','owner@virginia.edu'),('student','student@virginia.edu'),('student2','student2@virginia.edu');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other');
 INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('member','club','owner','PRESIDENT');
 INSERT INTO "RecruitmentCycle"(id,"clubId",name) VALUES('cycle','club','QA');
 INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0);
 INSERT INTO "Application"(id,"clubId","studentId","roundId","recruitmentCycleId",status) VALUES('app','club','student','round','cycle','IN_REVIEW'),('app2','club','student2','round','cycle','IN_REVIEW');
 INSERT INTO "VotingSession"(id,"clubId","roundId","cycleId",mode,"leaderMemberIds","targetSize","createdBy","updatedAt") VALUES('live','club','round','cycle','LIVE',ARRAY['member'],1,'owner',NOW());
 INSERT INTO "VotingCandidate"("sessionId","applicationId",position,"expectedStatus") VALUES('live','app',0,'IN_REVIEW'),('live','app2',1,'IN_REVIEW');
 INSERT INTO "VotingParticipant"("sessionId","memberId") VALUES('live','member');`);
 const h=text=>JSON.stringify([{id:'00000000-0000-4000-8000-000000000001',mode:'QUOTE',text,source:{type:'PROFILE',id:'profile:major:0',version:'a'.repeat(64),revision:null,label:'Major',author:null,roundId:null,roundName:null,text},writtenBy:null}]);
 await db.query(`INSERT INTO "VotingSlidePreparation"("sessionId","applicationId",highlights,"updatedBy") VALUES('live','app',$1::jsonb,'owner')`,[h('Economics')]);
 await assert.rejects(db.query(`INSERT INTO "VotingSlidePreparation"("sessionId","applicationId",highlights,"updatedBy",revision) VALUES('live','app2','[]','owner',2)`),/revision 1/);
 await assert.rejects(db.query(`UPDATE "VotingSlidePreparation" SET highlights=$1::jsonb WHERE "applicationId"='app'`,[h('Silent')]),/concurrently/);
 await assert.rejects(db.query(`UPDATE "VotingSlidePreparation" SET highlights=$1::jsonb,revision=2 WHERE "applicationId"='app'`,[JSON.stringify(Array(4).fill(JSON.parse(h('x'))[0]))]),/check/i);
 await assert.rejects(db.exec(`DELETE FROM "VotingSlidePreparation"`),/retained/);
 await assert.rejects(db.exec(`INSERT INTO "VotingSlidePreparation"("sessionId","applicationId","updatedBy") VALUES('live','not-a-candidate','owner')`),/foreign key/i);
 // Pass 1 starts: lock only the exact saved copy, before presentation.
 await db.exec(`INSERT INTO "VotingPass"("sessionId",number) VALUES('live',1); INSERT INTO "VotingPassCandidate"("sessionId","passNumber","applicationId",position) VALUES('live',1,'app',0),('live',1,'app2',1);`);
 await assert.rejects(db.query(`INSERT INTO "VotingSlideLock"("sessionId","passNumber","applicationId",highlights,"preparationRevision") VALUES('live',1,'app',$1::jsonb,1)`,[h('Tampered')]),/saved preparation/);
 await assert.rejects(db.query(`INSERT INTO "VotingSlideLock"("sessionId","passNumber","applicationId",highlights,"preparationRevision") VALUES('live',1,'app2',$1::jsonb,1)`,[h('Economics')]),/saved preparation/);
 await db.query(`INSERT INTO "VotingSlideLock"("sessionId","passNumber","applicationId",highlights,"preparationRevision") VALUES('live',1,'app',$1::jsonb,1)`,[h('Economics')]);
 // Later preparation edits do not alter the lock; locks cannot be changed or removed.
 await db.query(`UPDATE "VotingSlidePreparation" SET highlights=$1::jsonb,revision=2 WHERE "applicationId"='app'`,[h('Finance')]);
 assert.equal((await db.query(`SELECT highlights->0->>'text' AS t FROM "VotingSlideLock"`)).rows[0].t,'Economics');
 await assert.rejects(db.exec(`UPDATE "VotingSlideLock" SET "preparationRevision"=2`),/immutable/);await assert.rejects(db.exec(`DELETE FROM "VotingSlideLock"`),/immutable/);
 // A presented or voted applicant cannot be locked retroactively.
 await db.exec(`INSERT INTO "VotingPass"("sessionId",number) VALUES('live',2); INSERT INTO "VotingPassCandidate"("sessionId","passNumber","applicationId",position,"ballotState","openedAt") VALUES('live',2,'app',0,'OPEN',NOW());`);
 await assert.rejects(db.query(`INSERT INTO "VotingSlideLock"("sessionId","passNumber","applicationId",highlights,"preparationRevision") VALUES('live',2,'app',$1::jsonb,2)`,[h('Finance')]),/before its applicant/);
 // Finalized sessions are read only.
 await db.exec(`UPDATE "VotingPassCandidate" SET "ballotState"='CLOSED',"closedAt"=NOW() WHERE "passNumber"=2; UPDATE "VotingPass" SET state='COMPLETED',"completedAt"=NOW(); UPDATE "VotingSession" SET state='COMPLETED',"endedAt"=NOW(),"finalizedAt"=NOW() WHERE id='live'`);
 assert.ok((await db.query(`SELECT "finalizedAt" FROM "VotingSession" WHERE id='live'`)).rows[0].finalizedAt);
 await assert.rejects(db.query(`UPDATE "VotingSlidePreparation" SET highlights='[]',revision=3 WHERE "applicationId"='app'`),/closed/);
 // RLS on, browser roles denied, bounded runtime role has only the granted operations.
 const rls=(await db.query(`SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('VotingSlidePreparation','VotingSlideLock')`)).rows;assert.equal(rls.length,2);assert.ok(rls.every(r=>r.relrowsecurity));
 for(const role of ['anon','authenticated'])for(const t of ['VotingSlidePreparation','VotingSlideLock'])for(const p of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege($1,$2,$3) AS ok`,[role,`"${t}"`,p])).rows[0].ok,false,`${role} ${p} ${t}`);
 const grant=async(t,p)=>(await db.query(`SELECT has_table_privilege('outclass_production_app',$1,$2) AS ok`,[`"${t}"`,p])).rows[0].ok;
 assert.deepEqual(await Promise.all(['SELECT','INSERT','UPDATE','DELETE'].map(p=>grant('VotingSlidePreparation',p))),[true,true,true,false]);
 assert.deepEqual(await Promise.all(['SELECT','INSERT','UPDATE','DELETE'].map(p=>grant('VotingSlideLock',p))),[true,true,false,false]);
 const policies=(await db.query(`SELECT tablename,cmd FROM pg_policies WHERE tablename IN ('VotingSlidePreparation','VotingSlideLock') ORDER BY tablename,cmd`)).rows.map(r=>`${r.tablename}:${r.cmd}`);
 assert.deepEqual(policies,['VotingSlideLock:INSERT','VotingSlideLock:SELECT','VotingSlidePreparation:INSERT','VotingSlidePreparation:SELECT','VotingSlidePreparation:UPDATE']);
 }finally{await db.close();}
});
