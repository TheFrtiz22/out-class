// Web Push migration (S1-8) on PGlite: shape, cascades, idempotency key and server-only access.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite')

test('web push migration: unique endpoint, one delivery per notification and subscription, runtime-only access', { timeout: 240000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    // Supabase grants browser roles everything on new public tables by default; the migration's REVOKE must win.
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;')
    const dir = 'prisma/migrations'
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    for (const n of names) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu'),('bob','b@virginia.edu');
      INSERT INTO "UserNotification"(id,"userId","eventKey",type,title,body,href) VALUES('n1','alice','test:1','ANNOUNCEMENT','t','b','/inbox');`)
    const sub = (id, user, endpoint) => db.exec(`INSERT INTO "WebPushSubscription"(id,"userId",endpoint,p256dh,auth) VALUES('${id}','${user}','${endpoint}','p','a')`)
    await sub('s1', 'alice', 'https://fcm.googleapis.com/fcm/send/1')
    await assert.rejects(sub('s2', 'bob', 'https://fcm.googleapis.com/fcm/send/1'), /duplicate|unique/i, 'endpoint is unique')
    await assert.rejects(sub('s3', 'bob', 'http://fcm.googleapis.com/x'), /endpoint_https/)
    const row = (await db.query(`SELECT "failureCount","lastSuccessAt","createdAt" FROM "WebPushSubscription" WHERE id='s1'`)).rows[0]
    assert.equal(row.failureCount, 0); assert.equal(row.lastSuccessAt, null); assert.ok(row.createdAt)

    // Idempotency key: one row per (notification, subscription); a claim matches once.
    await db.exec(`INSERT INTO "WebPushDelivery"("notificationId","subscriptionId") VALUES('n1','s1')`)
    await assert.rejects(db.exec(`INSERT INTO "WebPushDelivery"("notificationId","subscriptionId") VALUES('n1','s1')`), /duplicate|unique/i)
    await db.exec(`INSERT INTO "WebPushDelivery"("notificationId","subscriptionId") VALUES('n1','s1') ON CONFLICT DO NOTHING`)
    const claim = () => db.query(`UPDATE "WebPushDelivery" SET status='SENDING' WHERE "notificationId"='n1' AND "subscriptionId"='s1' AND status='PENDING'`)
    assert.equal((await claim()).affectedRows, 1)
    assert.equal((await claim()).affectedRows, 0, 'a second claim matches nothing')
    await assert.rejects(db.exec(`UPDATE "WebPushDelivery" SET status='RETRY'`), /WebPushDelivery_status/)

    for (const table of ['WebPushSubscription', 'WebPushDelivery']) for (const role of ['anon', 'authenticated'])
      assert.equal((await db.query(`SELECT has_table_privilege($1,$2,'SELECT') ok`, [role, `"${table}"`])).rows[0].ok, false, `${role} cannot SELECT ${table} despite default grants`)
    await db.exec('CREATE TABLE default_grant_probe(id int)')
    assert.equal((await db.query(`SELECT has_table_privilege('anon','default_grant_probe','SELECT') ok`)).rows[0].ok, true, 'the default grant is in effect for a table that does not revoke it')
    for (const table of ['WebPushSubscription', 'WebPushDelivery']) {
      assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname=$1`, [table])).rows[0].relrowsecurity, true)
      for (const role of ['anon', 'authenticated']) for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
        assert.equal((await db.query(`SELECT has_table_privilege($1,$2,$3) ok`, [role, `"${table}"`, p])).rows[0].ok, false, `${role} ${p} ${table}`)
      for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
        assert.equal((await db.query(`SELECT has_table_privilege('outclass_production_app',$1,$2) ok`, [`"${table}"`, p])).rows[0].ok, true, `runtime ${p} ${table}`)
    }

    // 404/410 cleanup deletes the subscription; its deliveries go with it. Account deletion removes both.
    await db.exec(`DELETE FROM "WebPushSubscription" WHERE id='s1'`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "WebPushDelivery"`)).rows[0].n, 0)
    await sub('s4', 'alice', 'https://web.push.apple.com/abc')
    await db.exec(`INSERT INTO "WebPushDelivery"("notificationId","subscriptionId") VALUES('n1','s4')`)
    await db.exec(`DELETE FROM "User" WHERE id='alice'`)
    assert.equal((await db.query(`SELECT (SELECT count(*) FROM "WebPushSubscription")::int s, (SELECT count(*) FROM "WebPushDelivery")::int d`)).rows[0].s, 0)
  } finally { await db.close() }
})
