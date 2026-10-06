const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('additive settings migration retains application history, backfills order/capabilities, enforces types and restrictive RLS, and uses indexed lookup plans',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
 const migrate=async name=>db.exec(fs.readFileSync(path.join('prisma/migrations',name,'migration.sql'),'utf8'));
 for(const name of fs.readdirSync('prisma/migrations').sort())if(name<'20261005000000_club_settings'&&fs.existsSync(path.join('prisma/migrations',name,'migration.sql')))await migrate(name);
 await db.exec(`INSERT INTO "User"(id,email) VALUES('settings-owner','owner-settings@virginia.edu'),('settings-student','student-settings@virginia.edu');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('settings-club','settings-club','Settings Club','','','#ffffff','Academic');
 INSERT INTO "ClubMember"(id,"clubId","userId",permissions) VALUES('settings-member','settings-club','settings-owner',ARRAY['recruitment.manage']);
 INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('settings-r1','settings-club','Applied',0),('settings-r2','settings-club','Review',1);
 INSERT INTO "ApplicationQuestion"(id,"clubId",prompt,type) VALUES('settings-q2','settings-club','Second','ESSAY'),('settings-q1','settings-club','First','ESSAY');
 INSERT INTO "Application"(id,"studentId","clubId","roundId",status) VALUES('settings-app','settings-student','settings-club','settings-r1','SUBMITTED');
 INSERT INTO "ApplicationAnswer"(id,"applicationId","questionId",response) VALUES('settings-answer','settings-app','settings-q1','Keep this answer');`);
 // Invitation grants cannot be rewritten, and disabled owners remain valid historical rows.
 await db.exec(`INSERT INTO "ClubInvitation"(id,"clubId",email,"invitedBy","expiresAt",permissions) VALUES('settings-invite','settings-club','future-student@virginia.edu','settings-owner',CURRENT_TIMESTAMP+interval '7 days',ARRAY['recruitment.manage']);
 UPDATE "ClubMember" SET "isOwner"=true WHERE id='settings-member';
 INSERT INTO "User"(id,email) VALUES('disabled-settings-owner','disabled-owner-settings@virginia.edu');
 INSERT INTO "ClubMember"(id,"clubId","userId","isOwner",permissions) VALUES('disabled-settings-member','settings-club','disabled-settings-owner',true,ARRAY['recruitment.manage']);
 UPDATE "User" SET "disabledAt"=CURRENT_TIMESTAMP WHERE id='disabled-settings-owner';`);
 // A malformed historical kit must not make unrelated additive migration fail.
 await db.exec(`UPDATE \"PipelineRound\" SET \"interviewKit\"='{}' WHERE id='settings-r2'`);
 // Concrete dependencies on the first round must win over application-review fallback.
 await db.exec(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category)
 SELECT id,id,id,'','','#ffffff','Academic' FROM unnest(ARRAY['kit','room','record','vote','both','concrete','names']) id;
 INSERT INTO "PipelineRound"(id,"clubId",name,"order")
 SELECT c.id||'-'||r.id,c.id,'Interview Vote Application',r.position
 FROM "Club" c CROSS JOIN (VALUES('0',0),('1',1),('2',1)) r(id,position)
 WHERE c.id IN ('kit','room','record','vote','both','concrete','names');
 UPDATE "PipelineRound" SET "interviewKit"='[{}]' WHERE id IN ('kit-0','both-0','concrete-0');
 INSERT INTO "InterviewRoom"(id,"clubId","roundId",name,location,kind,timezone,duration)
 VALUES('legacy-room','room','room-0','Room','Hall','IN_PERSON','America/New_York',30);
 INSERT INTO "InterviewRecord"(id,"applicationId","interviewerId","roundId",questions,draft,"anonymousReview","updatedAt")
 VALUES('legacy-record','settings-app','settings-member','record-0','[]','{}',false,CURRENT_TIMESTAMP);
 INSERT INTO "VotingSession"(id,"clubId","roundId","targetSize","createdBy","updatedAt")
 VALUES('legacy-vote','vote','vote-0',1,'settings-owner',CURRENT_TIMESTAMP),
 ('legacy-both','both','both-0',1,'settings-owner',CURRENT_TIMESTAMP),
 ('legacy-concrete-1','concrete','concrete-1',1,'settings-owner',CURRENT_TIMESTAMP),
 ('legacy-concrete-2','concrete','concrete-2',1,'settings-owner',CURRENT_TIMESTAMP);`);
 await migrate('20261005000000_club_settings');
 const one=async(sql,params=[]) => (await db.query(sql,params)).rows[0];
 const club=await one(`SELECT * FROM "Club" WHERE id='settings-club'`);assert.equal(club.applicationOpen,true);assert.equal(club.isDiscoverable,true);assert.equal(club.invitationEmailEnabled,true);assert.equal(club.applicationVersion,0);
 assert.deepEqual((await db.query(`SELECT id,"order" FROM "ApplicationQuestion" WHERE "clubId"='settings-club' ORDER BY "order"`)).rows,[{id:'settings-q1',order:0},{id:'settings-q2',order:1}]);
 assert.ok((await one(`SELECT permissions FROM "ClubMember" WHERE id='settings-member'`)).permissions.includes('application.manage'));
 assert.deepEqual((await one(`SELECT permissions FROM "ClubInvitation" WHERE id='settings-invite'`)).permissions,['recruitment.manage']);
 assert.deepEqual((await one(`SELECT permissions FROM "ClubMember" WHERE id='disabled-settings-member'`)).permissions,['recruitment.manage']);
 await assert.rejects(db.exec(`UPDATE "ClubInvitation" SET permissions=ARRAY['recruitment.manage','application.manage'] WHERE id='settings-invite'`),/immutable/);
 assert.equal((await one(`SELECT type FROM "PipelineRound" WHERE id='settings-r1'`)).type,'APPLICATION_REVIEW');assert.equal((await one(`SELECT type FROM "PipelineRound" WHERE id='settings-r2'`)).type,'CUSTOM');
 for(const club of ['kit','room','record','vote','both','concrete','names']) {
  const expected=club==='concrete'?['INTERVIEW','VOTE','VOTE']:club==='names'?['APPLICATION_REVIEW','CUSTOM','CUSTOM']:[club==='vote'?'VOTE':'INTERVIEW','APPLICATION_REVIEW','CUSTOM'];
  assert.deepEqual((await db.query(`SELECT type FROM "PipelineRound" WHERE "clubId"=$1 ORDER BY "order",id`,[club])).rows.map(r=>r.type),expected,club);
 }
 await db.exec(`UPDATE "ApplicationQuestion" SET "archivedAt"=CURRENT_TIMESTAMP WHERE id='settings-q1'`);assert.equal((await one(`SELECT response FROM "ApplicationAnswer" WHERE id='settings-answer'`)).response,'Keep this answer');
 await assert.rejects(db.exec(`UPDATE "PipelineRound" SET type='INVALID' WHERE id='settings-r1'`),/check constraint/);
 for(const table of ['ApplicationQuestion','PipelineRound']) {
  await db.exec(`GRANT ALL ON "${table}" TO anon,authenticated;CREATE POLICY fixture_permissive ON "${table}" FOR ALL TO PUBLIC USING(true) WITH CHECK(true);`);
  for(const role of ['anon','authenticated']) {
   await db.exec(`SET ROLE ${role};`);
   assert.equal((await db.query(`SELECT * FROM "${table}"`)).rows.length,0);
   const field=table==='ApplicationQuestion'?'prompt':'name';
   assert.equal((await db.query(`UPDATE "${table}" SET "${field}"='Denied' RETURNING id`)).rows.length,0);
   assert.equal((await db.query(`DELETE FROM "${table}" RETURNING id`)).rows.length,0);
   const insert=table==='ApplicationQuestion'?`INSERT INTO "ApplicationQuestion"(id,"clubId",prompt,type) VALUES('denied-q','settings-club','Denied','ESSAY')`:`INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('denied-r','settings-club','Denied',3)`;
   await assert.rejects(db.exec(insert),/row-level security/);
   await db.exec('RESET ROLE;');
  }
  assert.ok((await db.query(`UPDATE "${table}" SET "archivedAt"="archivedAt" RETURNING id`)).rows.length>0,'trusted owner can still write');
 }
 // Synthetic identities only. This measures the actual planned SQL shape, not production latency.
 await db.exec(`INSERT INTO "User"(id,email) SELECT 'perf-user-'||i,'Perf'||i||'@virginia.edu' FROM generate_series(1,15000) i; ANALYZE "User";`);
 const plan=await one(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,email,"disabledAt" FROM "User" WHERE lower(email)=ANY(ARRAY['perf7000@virginia.edu'])`);const serialized=JSON.stringify(plan);assert.ok(serialized.includes('User_email_lower_idx'));t.diagnostic(serialized);
 const indexes=(await db.query(`SELECT indexname FROM pg_indexes WHERE tablename IN ('PipelineRound','ApplicationQuestion','Application')`)).rows.map(r=>r.indexname);for(const index of ['PipelineRound_clubId_archivedAt_order_idx','ApplicationQuestion_clubId_archivedAt_order_idx','Application_clubId_status_roundId_idx'])assert.ok(indexes.includes(index));
});
