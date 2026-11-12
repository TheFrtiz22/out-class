const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('staged decisions and grading columns: same-club only, one per application, consistent targets, runtime-only access',{timeout:240000},async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
 for(const n of fs.readdirSync('prisma/migrations').filter(n=>fs.existsSync(path.join('prisma/migrations',n,'migration.sql'))).sort())await db.exec(fs.readFileSync(path.join('prisma/migrations',n,'migration.sql'),'utf8'));
 await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','o@virginia.edu'),('s1','s1@virginia.edu'),('other','x@virginia.edu');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other'),('club2','club2','QB','','','#142d45','Other');
 INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('lead','club','owner','PRESIDENT'),('foreign','club2','other','GENERAL_MEMBER');
 INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0),('round2','club','QB',1);
 INSERT INTO "Application"(id,"clubId","studentId","roundId",status) VALUES('a1','club','s1','round','IN_REVIEW');`);
 const add=(values)=>db.exec(`INSERT INTO "StagedDecision"(id,"clubId","applicationId",outcome,"targetStatus","targetRoundId","expectedStatus","expectedRoundId","stagedById","updatedAt") VALUES(gen_random_uuid()::text,${values},NOW())`);
 await add(`'club','a1','REJECT','REJECTED',NULL,'IN_REVIEW','round','lead'`);
 await assert.rejects(add(`'club','a1','HOLD','IN_REVIEW',NULL,'IN_REVIEW','round','lead'`),/duplicate|unique/i,'one staged decision per application');
 await db.exec(`DELETE FROM "StagedDecision"`);
 await assert.rejects(add(`'club','a1','ROUND','ACCEPTED','round2','IN_REVIEW','round','lead'`),/target_consistent/,'a round move keeps the applicant pending');
 await assert.rejects(add(`'club','a1','SHIP','ACCEPTED',NULL,'IN_REVIEW','round','lead'`),/outcome_known/);
 await assert.rejects(add(`'club','a1','REJECT','REJECTED',NULL,'IN_REVIEW','round','foreign'`),/foreign key/i,'a member of another club cannot stage');
 await add(`'club','a1','ROUND','IN_REVIEW','round2','IN_REVIEW','round','lead'`);
 assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='StagedDecision'`)).rows[0].relrowsecurity,true);
 for(const role of ['anon','authenticated'])for(const p of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege($1,'"StagedDecision"',$2) ok`,[role,p])).rows[0].ok,false);
 assert.deepEqual(await Promise.all(['SELECT','INSERT','UPDATE','DELETE'].map(async p=>(await db.query(`SELECT has_table_privilege('outclass_production_app','"StagedDecision"',$1) ok`,[p])).rows[0].ok)),[true,true,true,true]);
 await assert.rejects(db.exec(`UPDATE "Club" SET "reviewRubric"='[1]' WHERE id='club'`),/reviewRubric_object/);
 await db.exec(`UPDATE "Club" SET "reviewRubric"='{"categories":[]}' WHERE id='club'`);
 await db.exec(`DELETE FROM "Application" WHERE id='a1'`);
 assert.equal((await db.query(`SELECT count(*)::int n FROM "StagedDecision"`)).rows[0].n,0,'removed with the application');
 }finally{await db.close();}
});
