const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), { PGlite } = require('@electric-sql/pglite');
const repair = '20261016030000_event_flyer_deletion_runtime_access';
async function beforeRepair() {
  const db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app; ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated;');
  for (const name of fs.readdirSync('prisma/migrations').sort()) {
    const file = `prisma/migrations/${name}/migration.sql`;
    if (name !== repair && fs.existsSync(file)) await db.exec(fs.readFileSync(file, 'utf8'));
  }
  return db;
}
const applyRepair = db => db.exec(fs.readFileSync(`prisma/migrations/${repair}/migration.sql`, 'utf8'));

test('flyer queue is invisible to the runtime schema gate before repair; bounded ownership restores access without schema CREATE', async t => {
  const db = await beforeRepair(); t.after(() => db.close());
  await db.exec('SET ROLE outclass_production_app');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='EventFlyerDeletion'")).rows[0].n, 0);
  await assert.rejects(db.query('SELECT * FROM "EventFlyerDeletion"'), /permission denied/);
  await db.exec('RESET ROLE'); await applyRepair(db);
  await db.exec('SET ROLE outclass_production_app');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='EventFlyerDeletion'")).rows[0].n, 2);
  await db.exec('INSERT INTO "EventFlyerDeletion"(path) VALUES (\'retry.png\')');
  assert.equal((await db.query('SELECT * FROM "EventFlyerDeletion"')).rows.length, 1);
  await db.exec('DELETE FROM "EventFlyerDeletion"');
  const role = (await db.query("SELECT rolsuper, rolbypassrls, has_schema_privilege(current_user,'public','CREATE') AS can_create FROM pg_roles WHERE rolname=current_user")).rows[0];
  assert.deepEqual(role, { rolsuper: false, rolbypassrls: false, can_create: false });
  await db.exec('RESET ROLE');
  for (const role of ['anon', 'authenticated']) {
    const grants = (await db.query(`SELECT has_table_privilege('${role}','"EventFlyerDeletion"','SELECT') AS read, has_table_privilege('${role}','"EventFlyerDeletion"','INSERT') AS write`)).rows[0];
    assert.deepEqual(grants, { read: false, write: false });
  }
  await db.exec('INSERT INTO "EventFlyerDeletion"(path) VALUES (\'private.png\'); GRANT ALL ON "EventFlyerDeletion" TO anon, authenticated; CREATE POLICY broad_legacy ON "EventFlyerDeletion" FOR ALL TO PUBLIC USING(true) WITH CHECK(true);');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    assert.equal((await db.query('SELECT * FROM "EventFlyerDeletion"')).rows.length, 0);
    assert.equal((await db.query('DELETE FROM "EventFlyerDeletion" RETURNING *')).rows.length, 0);
    await assert.rejects(db.exec('INSERT INTO "EventFlyerDeletion"(path) VALUES (\'forged.png\')'), /row-level security/);
    await db.exec('RESET ROLE');
  }
});

test('flyer replacement and event cascade deletion enqueue work under the actual bounded runtime role', async t => {
  const db = await beforeRepair(); t.after(() => db.close()); await applyRepair(db);
  // Existing production event tables are already owned by this runtime role.
  await db.exec('GRANT CREATE ON SCHEMA public TO outclass_production_app; ALTER TABLE "Event" OWNER TO outclass_production_app; ALTER TABLE "EventPublication" OWNER TO outclass_production_app; ALTER TABLE "EventFlyer" OWNER TO outclass_production_app; REVOKE CREATE ON SCHEMA public FROM outclass_production_app;');
  await db.exec(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES ('club','runtime-fixture','Runtime','','','#142d45','Arts');
    INSERT INTO "Event"(id,"clubId",title,date,"endDate",location) VALUES ('event','club','Evening',CURRENT_TIMESTAMP+interval '1 day',CURRENT_TIMESTAMP+interval '1 day 1 hour','Hall');
    INSERT INTO "EventFlyer"(id,"eventId",path,mime,size,"createdBy") VALUES ('first','event','first.png','image/png',100,'manager'),('second','event','second.png','image/png',100,'manager');
    INSERT INTO "EventPublication"("eventId","flyerId","updatedAt") VALUES ('event','first',CURRENT_TIMESTAMP);`);
  await db.exec('SET ROLE outclass_production_app');
  await db.exec(`UPDATE "EventPublication" SET "flyerId"='second' WHERE "eventId"='event'`);
  assert.deepEqual((await db.query('SELECT path FROM "EventFlyerDeletion" ORDER BY path')).rows, [{ path: 'first.png' }]);
  await db.exec(`DELETE FROM "Event" WHERE id='event'`);
  assert.deepEqual((await db.query('SELECT path FROM "EventFlyerDeletion" ORDER BY path')).rows, [{ path: 'first.png' }, { path: 'second.png' }]);
  await db.exec('DELETE FROM "EventFlyerDeletion"');
});
