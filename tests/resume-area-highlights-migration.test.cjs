const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
const name='20261111180000_resume_area_highlights',file=path.join('prisma/migrations',name,'migration.sql');

test('area highlight migration source: additive, LF, bounded lock, no new grants or tables',()=>{
 const sql=fs.readFileSync(file,'utf8');
 assert.ok(!sql.includes('\r'),'LF line endings');
 assert.match(sql,/^BEGIN;\nSET LOCAL lock_timeout = '5s';\n/);assert.match(sql,/COMMIT;\n$/);
 assert.doesNotMatch(sql.replace(/--.*$/gm,''),/CREATE TABLE|ADD COLUMN|GRANT|REVOKE|POLICY|DROP TABLE|DROP COLUMN|UPDATE "|DELETE FROM/i);
 const later=fs.readdirSync('prisma/migrations').filter(n=>fs.existsSync(path.join('prisma/migrations',n,'migration.sql'))&&n!==name);
 assert.ok(later.every(n=>n<name),'timestamp is later than every other migration');
});

test('area highlight migration: existing rows kept, rect checks enforced, foundation guards and RLS unchanged',{timeout:240000},async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;');
 const names=fs.readdirSync('prisma/migrations').filter(n=>fs.existsSync(path.join('prisma/migrations',n,'migration.sql'))).sort();
 for(const n of names.filter(n=>n<name))await db.exec(fs.readFileSync(path.join('prisma/migrations',n,'migration.sql'),'utf8'));
 await db.exec(`INSERT INTO "User"(id,email) VALUES ('u','u@virginia.edu'),('s','s@virginia.edu');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES ('c','c','C','','','#142d45','Other');
 INSERT INTO "ClubMember"(id,"userId","clubId") VALUES ('m','u','c');
 INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES ('r','c','Interview',1);
 INSERT INTO "Application"(id,"studentId","clubId","roundId",status) VALUES ('a','s','c','r','INTERVIEWING');
 INSERT INTO "InterviewResumeDocument"(id,"applicationId","roundId","sourcePath","contentHash",content) VALUES ('doc','a','r','s/cv.pdf',repeat('a',64),decode('255044462d','hex'));
 INSERT INTO "InterviewResumeAnnotation"(id,"documentId","authorId",kind,anchor,comment,"updatedAt") VALUES
  ('text','doc','m','TEXT_HIGHLIGHT','{"page":1,"start":0,"end":4,"quote":"Ada ","prefix":"","suffix":"","rectangles":[]}','Quoted',NOW()),
  ('note','doc','m','GENERAL_NOTE',NULL,'General',NOW());`);
 // Before: the foundation rejects an area highlight.
 const area=(id,anchor)=>db.query(`INSERT INTO "InterviewResumeAnnotation"(id,"documentId","authorId",kind,anchor,comment,"updatedAt") VALUES ($1,'doc','m','AREA_HIGHLIGHT',$2::jsonb,'Scanned award',NOW())`,[id,JSON.stringify(anchor)]);
 await assert.rejects(area('early',{page:1,rect:{x:.1,y:.1,width:.2,height:.2}}),/check/i);
 await db.exec(fs.readFileSync(file,'utf8'));
 assert.equal((await db.query(`SELECT count(*)::int n FROM "InterviewResumeAnnotation"`)).rows[0].n,2,'existing rows retained');
 await area('area',{page:2,rect:{x:.1234,y:0,width:.8766,height:1}});
 for(const [id,anchor] of [
  ['zero-w',{page:1,rect:{x:.1,y:.1,width:0,height:.2}}],['zero-h',{page:1,rect:{x:.1,y:.1,width:.2,height:0}}],
  ['neg',{page:1,rect:{x:-.1,y:.1,width:.2,height:.2}}],['over-x',{page:1,rect:{x:.9,y:.1,width:.2,height:.2}}],
  ['over-y',{page:1,rect:{x:.1,y:.95,width:.2,height:.1}}],['page0',{page:0,rect:{x:.1,y:.1,width:.2,height:.2}}],
  ['no-rect',{page:1}],['string',{page:1,rect:{x:'0.1',y:.1,width:.2,height:.2}}],
  // An area can never carry quotation fields.
  ['quote',{page:1,quote:'Fake OCR',start:0,end:8,rect:{x:.1,y:.1,width:.2,height:.2}}],
 ])await assert.rejects(area(id,anchor),/check|invalid/i,id);
 await assert.rejects(db.exec(`INSERT INTO "InterviewResumeAnnotation"(id,"documentId","authorId",kind,anchor,comment,"updatedAt") VALUES ('bad-kind','doc','m','IMAGE','{}','x',NOW())`),/check/i);
 await assert.rejects(db.exec(`INSERT INTO "InterviewResumeAnnotation"(id,"documentId","authorId",kind,anchor,comment,"updatedAt") VALUES ('null-area','doc','m','AREA_HIGHLIGHT',NULL,'x',NOW())`),/check/i);
 await assert.rejects(db.exec(`INSERT INTO "InterviewResumeAnnotation"(id,"documentId","authorId",kind,anchor,comment,"updatedAt") VALUES ('bad-text','doc','m','TEXT_HIGHLIGHT','{"page":1,"start":4,"end":4,"quote":"x"}','x',NOW())`),/check/i);
 // Editing an area keeps the foundation's preserved-history and tombstone rules.
 await assert.rejects(db.exec(`UPDATE "InterviewResumeAnnotation" SET anchor='{"page":2,"rect":{"x":0.2,"y":0.2,"width":0.3,"height":0.3}}',revision=1 WHERE id='area'`),/history/);
 await db.exec(`INSERT INTO "InterviewAnnotationRevision"(id,"annotationId","actorId",revision,content) VALUES ('h0','area','u',0,'{"kind":"AREA_HIGHLIGHT"}');
  UPDATE "InterviewResumeAnnotation" SET anchor='{"page":2,"rect":{"x":0.2,"y":0.2,"width":0.3,"height":0.3}}',revision=1 WHERE id='area';`);
 await assert.rejects(db.exec(`DELETE FROM "InterviewResumeAnnotation" WHERE id='area'`),/tombstoned/);
 const checks=(await db.query(`SELECT conname FROM pg_constraint WHERE conrelid='"InterviewResumeAnnotation"'::regclass AND contype='c' ORDER BY conname`)).rows.map(r=>r.conname);
 assert.deepEqual(checks,['InterviewResumeAnnotation_anchor_check','InterviewResumeAnnotation_comment_check','InterviewResumeAnnotation_kind_check','InterviewResumeAnnotation_revision_check']);
 const rls=(await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='InterviewResumeAnnotation'`)).rows[0];assert.equal(rls.relrowsecurity,true);
 for(const role of ['anon','authenticated'])for(const p of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege($1,'"InterviewResumeAnnotation"',$2) AS ok`,[role,p])).rows[0].ok,false,`${role} ${p}`);
 }finally{await db.close();}
});
