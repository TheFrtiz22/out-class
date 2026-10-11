const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('reconciled migration preserves current-main announcements, preferences, notifications and queued intent',{timeout:120000},async()=>{
 const db=new PGlite();try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  const dir='prisma/migrations',name='20261010190001_reconciled_decision_letters';
  for(const migration of fs.readdirSync(dir).filter(n=>n<name&&fs.existsSync(path.join(dir,n,'migration.sql'))).sort())await db.exec(fs.readFileSync(path.join(dir,migration,'migration.sql'),'utf8'));
  await db.exec(`INSERT INTO "User" (id,email) VALUES ('leader','leader@virginia.edu'),('student','student@virginia.edu');
   INSERT INTO "Club" (id,slug,name,tagline,description,color,category) VALUES ('club','club','Existing Club','','','#142d45','Other');
   INSERT INTO "ClubAnnouncement" (id,"clubId","authorId",title,body,audience,"requestKey") VALUES ('announcement','club','leader','Existing announcement','Keep this wording','MEMBERS','request');
   INSERT INTO "UserNotification" (id,"userId","clubId","announcementId","eventKey",type,title,body,href,"readAt") VALUES ('notification','student','club','announcement','existing-event','ANNOUNCEMENT','Existing announcement','Keep this wording','/?workspace=student&view=inbox',NOW());
   INSERT INTO "UserNotificationPreference" ("userId","emailAnnouncements","emailApplications","emailFrequency","updatedAt") VALUES ('student',false,false,'DAILY',NOW());`);
  const tables=['ClubAnnouncement','UserNotification','UserNotificationPreference','NotificationEmailOutbox'];const before={};for(const t of tables)before[t]=(await db.query(`SELECT * FROM "${t}"`)).rows;
  await db.exec(fs.readFileSync(path.join(dir,name,'migration.sql'),'utf8'));
  for(const t of tables)assert.deepEqual((await db.query(`SELECT * FROM "${t}"`)).rows,before[t],t+' preserved');
  assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='DecisionLetter'`)).rows[0].relrowsecurity,true);
  for(const role of ['anon','authenticated'])for(const action of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query(`SELECT has_table_privilege('${role}','"DecisionLetter"','${action}') AS allowed`)).rows[0].allowed,false);
 }finally{await db.close()}
});
