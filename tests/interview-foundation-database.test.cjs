const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
test('disposable in-memory PostgreSQL enforces immutable finals, snapshots, scope, annotation evidence, scholar and score constraints',async()=>{
 // No URL, environment variable or filesystem database: this constructor creates a disposable WASM database.
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 const root='prisma/migrations',names=fs.readdirSync(root).filter(n=>fs.existsSync(`${root}/${n}/migration.sql`)).sort();
 for(const n of names.filter(n=>n<'20261004000000'))await db.exec(fs.readFileSync(`${root}/${n}/migration.sql`,'utf8'));
 await db.exec(`INSERT INTO "User"(id,email) VALUES ('u','u@virginia.edu'),('s','s@virginia.edu');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES ('c','c','C','','','',''),('other','other','Other','','','','');
 INSERT INTO "ClubMember"(id,"userId","clubId") VALUES ('m','u','c'),('foreign','u','other');
 INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES ('r','c','Interview',1),('r2','c','Interview',2),('foreign','other','Interview',1);
 INSERT INTO "Application"(id,"studentId","clubId","roundId",status) VALUES ('a','s','c','r','INTERVIEWING');
 INSERT INTO "Evaluation"(id,"applicationId","interviewerId",round,score,notes) VALUES ('legacy','a','m','Old round',8.25,'Preserve');
 INSERT INTO "InterviewRecord"(id,"applicationId","interviewerId","roundId",questions,draft,"anonymousReview","completedAt","updatedAt","evaluationId") VALUES ('old','a','m','r','[]','{"questionNotes":[],"additionalQuestions":[],"overallReview":"Original","score":8.25}',false,NOW(),NOW(),'legacy');`);
 await db.exec(fs.readFileSync(`${root}/20261004000000_interview_foundation/migration.sql`,'utf8'));
 assert.equal((await db.query(`SELECT score FROM "Evaluation" WHERE id='legacy'`)).rows[0].score,8.25);
 for(const sql of [`UPDATE "Evaluation" SET score=9 WHERE id='legacy'`,`UPDATE "Evaluation" SET notes='changed' WHERE id='legacy'`,`DELETE FROM "Evaluation" WHERE id='legacy'`,`UPDATE "InterviewRecord" SET "completedAt"=NULL WHERE id='old'`,`UPDATE "InterviewRecord" SET "evaluationId"=NULL WHERE id='old'`,`DELETE FROM "InterviewRecord" WHERE id='old'`,`DELETE FROM "Application" WHERE id='a'`])await assert.rejects(db.exec(sql),/immutable/);
 await assert.rejects(db.exec(`INSERT INTO "Evaluation"(id,"applicationId","interviewerId",round,"roundId",score) VALUES ('bad','a','m','Interview','r2',8.25)`),/half points/);
 await db.exec(`INSERT INTO "Evaluation"(id,"applicationId","interviewerId",round,"roundId",score,"submittedAt") VALUES ('new','a','m','Interview','r2',8.5,NOW());
 INSERT INTO "InterviewRecord"(id,"applicationId","interviewerId","roundId",questions,draft,"anonymousReview","completedAt","updatedAt","evaluationId") VALUES ('new','a','m','r2','[]','{}',false,NOW(),NOW(),'new');`);
 await assert.rejects(db.exec(`INSERT INTO "Evaluation"(id,"applicationId","interviewerId",round,"roundId",score) VALUES ('dup','a','m','renamed','r2',8)`),/unique/);
 await assert.rejects(db.exec(`INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ('bad','a','r','foreign','u')`),/scope/);
 await db.exec(`INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ('grant','a','r','m','u');
 INSERT INTO "InterviewResumeDocument"(id,"applicationId","roundId","sourcePath","contentHash",content) VALUES ('doc','a','r','s/cv.pdf',repeat('a',64),decode('255044462d','hex'));
 INSERT INTO "InterviewResumeAnnotation"(id,"documentId","authorId",kind,comment,"updatedAt") VALUES ('one','doc','m','GENERAL_NOTE','original',NOW()),('two','doc','m','GENERAL_NOTE','independent',NOW());`);
 await assert.rejects(db.exec(`UPDATE "InterviewResumeDocument" SET "sourcePath"='replacement' WHERE id='doc'`),/immutable/);
 await assert.rejects(db.exec(`UPDATE "InterviewResumeAnnotation" SET comment='lost',revision=1 WHERE id='one'`),/history/);
 await db.exec(`INSERT INTO "InterviewAnnotationRevision"(id,"annotationId","actorId",revision,content) VALUES ('history','one','u',0,'{"comment":"original"}');
 UPDATE "InterviewResumeAnnotation" SET comment='moderated',revision=1 WHERE id='one';`);
 assert.equal((await db.query(`SELECT comment FROM "InterviewResumeAnnotation" WHERE id='two'`)).rows[0].comment,'independent');
 assert.equal((await db.query(`UPDATE "InterviewResumeAnnotation" SET comment='stale',revision=1 WHERE id='one' AND revision=0 RETURNING id`)).rows.length,0);
 await assert.rejects(db.exec(`DELETE FROM "InterviewAnnotationRevision"`),/immutable/);
 await assert.rejects(db.exec(`UPDATE "InterviewResumeAnnotation" SET "authorId"='foreign',revision=2 WHERE id='one'`),/immutable/);
 await db.exec(`UPDATE "ClubMember" SET "interviewOffices"=ARRAY['PRESIDENT'], status='LEFT' WHERE id='m'`);
 assert.ok((await db.query(`SELECT "revokedAt" FROM "InterviewPanelAssignment" WHERE id='grant'`)).rows[0].revokedAt);
 assert.deepEqual((await db.query(`SELECT "interviewOffices" FROM "ClubMember" WHERE id='m'`)).rows[0].interviewOffices,[]);
 assert.equal((await db.query(`SELECT outclass_scholar_status_valid(NULL) AS valid`)).rows[0].valid,true);
 for(const value of [{selections:['NOT_APPLICABLE','ECHOLS'],other:''},{selections:['OTHER'],other:''},{selections:['RODMAN','RODMAN'],other:''}])assert.equal((await db.query(`SELECT outclass_scholar_status_valid($1::jsonb) AS valid`,[JSON.stringify(value)])).rows[0].valid,false);
 for(const table of ['InterviewPanelAssignment','InterviewResumeDocument','InterviewResumeAnnotation','InterviewAnnotationRevision']) for(const role of ['anon','authenticated'])assert.equal((await db.query(`SELECT has_table_privilege($1,$2,'SELECT') AS allowed`,[role,`"${table}"`])).rows[0].allowed,false);
 }finally{await db.close()}
});
