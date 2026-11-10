const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('recusal migration: same-club only, one row per member and applicant, runtime-only access',{timeout:240000},async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
 for(const n of fs.readdirSync('prisma/migrations').filter(n=>fs.existsSync(path.join('prisma/migrations',n,'migration.sql'))).sort())await db.exec(fs.readFileSync(path.join('prisma/migrations',n,'migration.sql'),'utf8'));
 await db.exec(`INSERT INTO "User"(id,email) VALUES('owner','o@virginia.edu'),('rev','r@virginia.edu'),('s1','s1@virginia.edu'),('other','x@virginia.edu');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','QA','','','#142d45','Other'),('club2','club2','QB','','','#142d45','Other');
 INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES('lead','club','owner','PRESIDENT'),('mem','club','rev','GENERAL_MEMBER'),('foreign','club2','other','GENERAL_MEMBER');
 INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('round','club','QA',0);
 INSERT INTO "Application"(id,"clubId","studentId","roundId",status) VALUES('a1','club','s1','round','IN_REVIEW');`);
 const add=(member,club='club')=>db.exec(`INSERT INTO "ApplicantRecusal"(id,"clubId","applicationId","memberId","createdById") VALUES(gen_random_uuid()::text,'${club}','a1','${member}','owner')`);
 await add('mem');
 await assert.rejects(add('mem'),/duplicate|unique/i);
 await assert.rejects(add('foreign'),/foreign key/i,'a member of another club cannot be attached');
 await assert.rejects(add('foreign','club2'),/foreign key/i,'the application must belong to the same club');
 await assert.rejects(db.exec(`UPDATE "ApplicantRecusal" SET "liftedAt"=NOW()`),/lift_consistent/,'lifting records who lifted it');
 await db.exec(`UPDATE "ApplicantRecusal" SET "liftedAt"=NOW(),"liftedById"='owner'`);
 assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='ApplicantRecusal'`)).rows[0].relrowsecurity,true);
 for(const role of ['anon','authenticated'])for(const p of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege($1,'"ApplicantRecusal"',$2) ok`,[role,p])).rows[0].ok,false);
 assert.deepEqual(await Promise.all(['SELECT','INSERT','UPDATE','DELETE'].map(async p=>(await db.query(`SELECT has_table_privilege('outclass_production_app','"ApplicantRecusal"',$1) ok`,[p])).rows[0].ok)),[true,true,true,false]);
 await db.exec(`DELETE FROM "Application" WHERE id='a1'`);
 assert.equal((await db.query(`SELECT count(*)::int n FROM "ApplicantRecusal"`)).rows[0].n,0,'removed with the application');
 }finally{await db.close();}
});
