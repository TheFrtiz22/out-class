const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const migrations = path.resolve(__dirname, '../prisma/migrations');
const repairName = '20261011002000_production_communications_runtime_access';
const repairSql = fs.readFileSync(path.join(migrations, repairName, 'migration.sql'), 'utf8');
const migrationNames = fs.readdirSync(migrations).filter(name => fs.existsSync(path.join(migrations, name, 'migration.sql'))).sort();
const newTables = ['SchoolRequest','InterviewCollaboration','InterviewPresence','InterviewMove','InterviewInvitation','ClubAnnouncement','UserNotification','UserNotificationPreference','ClubConversation','ClubMessage','NotificationEmailOutbox','NotificationEmailDelivery'];

test('production ownership repair preserves records and bounded-role protections while enabling announcement and notification transactions', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE migration_operator NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT outclass_production_app TO migration_operator; ALTER SCHEMA public OWNER TO migration_operator; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated`);
    for (const name of migrationNames.filter(name => name <= '20261007010000_profile_gpa_private_photos')) await db.exec(fs.readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8'));
    await db.exec(`INSERT INTO "User" (id,email,role) VALUES ('runtime-student','runtime-fixture@virginia.edu','STUDENT'); INSERT INTO "Club" (id,slug,name,tagline,description,color,category) VALUES ('runtime-club','runtime-club','Runtime Fixture','','','#142d4e','Academic'); INSERT INTO "PipelineRound" (id,"clubId",name,"order") VALUES ('runtime-round','runtime-club','Review',0); INSERT INTO "Application" (id,"studentId","clubId","roundId",status,"submittedAt") VALUES ('existing-application','runtime-student','runtime-club','runtime-round','SUBMITTED',NOW()); CREATE TABLE _prisma_migrations(id text primary key); INSERT INTO _prisma_migrations VALUES ('preserved-history')`);
    const originalTables = (await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations'`)).rows;
    for (const { tablename } of originalTables) await db.exec(`ALTER TABLE public."${tablename}" OWNER TO outclass_production_app`);
    for (const name of migrationNames.filter(name => name > '20261007010000_profile_gpa_private_photos' && name < repairName)) await db.exec(fs.readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8'));
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM "UserNotification"')).rows[0].count, 0, 'No historical notification backfill');
    const preservedBefore = (await db.query(`SELECT to_jsonb(a)::text AS data FROM "Application" a WHERE id='existing-application'`)).rows;
    await db.exec('SET ROLE outclass_production_app');
    await assert.rejects(db.query('SELECT * FROM "ClubAnnouncement"'), /permission denied/);
    await assert.rejects(db.exec(`UPDATE "Application" SET status='IN_REVIEW' WHERE id='existing-application'`), /permission denied/);
    await db.exec('RESET ROLE');
    for (const table of newTables) await db.exec(`ALTER TABLE public."${table}" OWNER TO migration_operator`);
    for (const { signature } of (await db.query(`SELECT p.oid::regprocedure::text AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('outclass_collaboration_scope','outclass_notification_email_outbox','outclass_notify','outclass_application_notification','outclass_booking_notification','outclass_task_notification','outclass_invitation_notification')`)).rows) await db.exec(`ALTER FUNCTION ${signature} OWNER TO migration_operator`);
    await db.exec('SET ROLE migration_operator');
    await db.exec(repairSql);
    await db.exec('RESET ROLE');
    assert.deepEqual((await db.query(`SELECT to_jsonb(a)::text AS data FROM "Application" a WHERE id='existing-application'`)).rows, preservedBefore);
    const permissions = (await db.query(`SELECT has_schema_privilege('outclass_production_app','public','CREATE') AS can_create,has_table_privilege('outclass_production_app','_prisma_migrations','SELECT') AS can_read_history,pg_has_role('outclass_production_app','migration_operator','MEMBER') AS can_be_migrator`)).rows[0];
    assert.deepEqual(permissions, { can_create: false, can_read_history: false, can_be_migrator: false });
    const attributes = (await db.query(`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname='outclass_production_app'`)).rows[0];
    assert.deepEqual(attributes, { rolsuper:false,rolbypassrls:false });
    const protectedTables = (await db.query(`SELECT c.relname AS table_name,c.relrowsecurity AS rls,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anon_access,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS authenticated_access FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN (${newTables.map(name=>"'"+name+"'").join(',')})`)).rows;
    assert.equal(protectedTables.length,12);
    assert.ok(protectedTables.every(row=>row.rls&&!row.anon_access&&!row.authenticated_access));
    const functions = (await db.query(`SELECT p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('outclass_collaboration_scope','outclass_notification_email_outbox','outclass_notify','outclass_application_notification','outclass_booking_notification','outclass_task_notification','outclass_invitation_notification')`)).rows;
    assert.equal(functions.length,7);
    assert.ok(functions.every(row=>!row.prosecdef&&!row.anon_execute&&!row.authenticated_execute));
    await db.exec('SET ROLE outclass_production_app');
    for (const table of newTables) await db.query(`SELECT * FROM public."${table}" LIMIT 1`);
    await db.exec(`BEGIN; INSERT INTO "ClubAnnouncement" (id,"clubId","authorId",title,body,audience,"requestKey") VALUES ('runtime-announcement','runtime-club','runtime-student','Runtime verification','One isolated in-app fixture','MEMBERS','runtime-request'); INSERT INTO "UserNotification" (id,"userId","clubId","announcementId","eventKey",type,title,body,href) VALUES ('runtime-notification','runtime-student','runtime-club','runtime-announcement','announcement:runtime-announcement','ANNOUNCEMENT','Runtime verification','One isolated fixture','/?workspace=student&view=inbox'); COMMIT`);
    assert.equal((await db.query(`SELECT count(*)::integer AS count FROM "NotificationEmailOutbox" WHERE "notificationId"='runtime-notification' AND status='PENDING'`)).rows[0].count,1);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM "NotificationEmailDelivery"')).rows[0].count,0);
    await db.exec(`UPDATE "UserNotification" SET "readAt"=NOW(),"archivedAt"=NOW() WHERE id='runtime-notification'; UPDATE "Application" SET status='IN_REVIEW' WHERE id='existing-application'`);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM "UserNotification"')).rows[0].count,2);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM "NotificationEmailOutbox"')).rows[0].count,2);
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM "UserNotification"'), /permission denied/);
    await assert.rejects(db.query(`SELECT outclass_notify('runtime-student','runtime-club','forged','ANNOUNCEMENT','Forged','Forged','/')`), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE migration_operator');
    await db.exec(repairSql);
    await db.exec('RESET ROLE');
    assert.equal((await db.query(`SELECT has_schema_privilege('outclass_production_app','public','CREATE') AS allowed`)).rows[0].allowed,false);
    assert.equal((await db.query('SELECT count(*)::integer AS count FROM "UserNotification"')).rows[0].count,2);
  } finally { await db.close(); }
});

test('the runtime-access migration is a no-op where the production role is absent', async () => {
  const db = new PGlite();
  try { await db.exec(repairSql); assert.equal((await db.query(`SELECT count(*)::integer AS count FROM pg_roles WHERE rolname='outclass_production_app'`)).rows[0].count,0); }
  finally { await db.close(); }
});
