// Opt-in native PostgreSQL test for the live inbox signal migration. Supabase's
// realtime.send / realtime.topic() / auth.uid() are replaced by minimal stand-ins
// with the same signatures; everything runs in one transaction that is rolled back.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const databaseUrl = process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;
const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261104230000_inbox_realtime_signal/migration.sql'), 'utf8');
const ROLLBACK = Symbol('rollback');

test('native PostgreSQL: inbox writes signal only their owners, and browsers can neither read other topics nor send', { skip: !databaseUrl, timeout: 60000 }, async t => {
  const url = new URL(databaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/outclass_security_test', 'Only an isolated local outclass_security_test database is allowed');
  const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient({ datasourceUrl: databaseUrl }); t.after(() => prisma.$disconnect());
  const block = migration.match(/DO \$migration\$[\s\S]*\$migration\$;/)?.[0];
  assert.ok(block, 'migration body found');
  const [a, b, failing] = [randomUUID(), randomUUID(), randomUUID()];
  await assert.rejects(prisma.$transaction(async tx => {
    const run = sql => tx.$executeRawUnsafe(sql);
    const rows = sql => tx.$queryRawUnsafe(sql);
    // Absent Realtime: the migration is a no-op (plain PostgreSQL, the migration test chain).
    await run(block.replace('RAISE NOTICE', 'RAISE NOTICE'));
    assert.equal((await rows(`SELECT count(*)::int n FROM pg_trigger WHERE tgname LIKE 'outclass_inbox_signal_%'`))[0].n, 0);

    await run(`CREATE SCHEMA realtime`);
    await run(`CREATE TABLE realtime.messages (id bigserial PRIMARY KEY, topic text NOT NULL, extension text NOT NULL, event text, payload jsonb, private boolean)`);
    await run(`CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('realtime.topic', true) $$`);
    await run(`CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$
      BEGIN IF topic = 'inbox:${failing}' THEN RAISE EXCEPTION 'realtime down'; END IF;
      INSERT INTO realtime.messages(topic, extension, event, payload, private) VALUES (topic, 'broadcast', event, payload, private); END $$`);
    await run(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$`);
    await run(`GRANT USAGE ON SCHEMA realtime, auth TO authenticated`);
    await run(`GRANT SELECT, INSERT ON realtime.messages TO authenticated`);
    await run(`GRANT USAGE ON SEQUENCE realtime.messages_id_seq TO authenticated`);
    await run(`GRANT EXECUTE ON FUNCTION realtime.topic(), auth.uid() TO authenticated`);

    // RLS must already be on: the migration refuses to install an unconfined channel.
    await run(`SAVEPOINT no_rls`);
    await assert.rejects(run(block), /row-level security/);
    await run(`ROLLBACK TO SAVEPOINT no_rls`);
    await run(`ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY`);
    await run(block); await run(block); // idempotent

    for (const id of [a, b, failing]) await run(`INSERT INTO "User"(id, email) VALUES ('${id}', 'live${id.slice(0, 8)}@virginia.edu')`);
    const signals = async () => (await rows(`SELECT topic, event, payload::text, private FROM realtime.messages ORDER BY id`));
    await run(`DELETE FROM realtime.messages`);
    // One fan-out statement: three rows for A, one for B -> one signal each.
    await run(`INSERT INTO "UserNotification"(id, "userId", "eventKey", type, title, body, href) VALUES
      ('${randomUUID()}', '${a}', 'k1', 'ANNOUNCEMENT', 't', 'b', '/'), ('${randomUUID()}', '${a}', 'k2', 'ANNOUNCEMENT', 't', 'b', '/'),
      ('${randomUUID()}', '${a}', 'k3', 'ANNOUNCEMENT', 't', 'b', '/'), ('${randomUUID()}', '${b}', 'k1', 'ANNOUNCEMENT', 't', 'b', '/')`);
    assert.deepEqual((await signals()).map(s => s.topic).sort(), [`inbox:${a}`, `inbox:${b}`].sort());
    assert.ok((await signals()).every(s => s.event === 'inbox' && s.payload === '{}' && s.private === true), 'signals carry no data and are private');
    await run(`DELETE FROM realtime.messages`);
    await run(`UPDATE "UserNotification" SET "readAt" = now() WHERE "userId" = '${a}'`);
    assert.deepEqual((await signals()).map(s => s.topic), [`inbox:${a}`], 'read state signals once');
    await run(`DELETE FROM realtime.messages`);
    await run(`DELETE FROM "UserNotification" WHERE "userId" = '${b}'`);
    assert.deepEqual((await signals()).map(s => s.topic), [`inbox:${b}`], 'deletes signal');
    await run(`UPDATE "UserNotification" SET "readAt" = now() WHERE false`);
    assert.equal((await signals()).length, 1, 'an update touching no rows sends nothing');

    // A failing Realtime send never rolls back the notification itself.
    await run(`INSERT INTO "UserNotification"(id, "userId", "eventKey", type, title, body, href) VALUES ('${randomUUID()}', '${failing}', 'k1', 'TASK', 't', 'b', '/')`);
    assert.equal((await rows(`SELECT count(*)::int n FROM "UserNotification" WHERE "userId" = '${failing}'`))[0].n, 1);

    // A later, broader permissive policy must still not let browsers send on inbox topics.
    await run(`CREATE POLICY fixture_any_send ON realtime.messages FOR INSERT TO authenticated WITH CHECK (true)`);
    await run(`SET LOCAL ROLE authenticated`);
    await run(`SELECT set_config('request.jwt.claim.sub', '${a}', true)`);
    await run(`SELECT set_config('realtime.topic', 'inbox:${a}', true)`);
    assert.ok((await rows(`SELECT count(*)::int n FROM realtime.messages`))[0].n > 0, 'the owner may receive on their own topic');
    await run(`SELECT set_config('realtime.topic', 'inbox:${b}', true)`);
    assert.equal((await rows(`SELECT count(*)::int n FROM realtime.messages`))[0].n, 0, "another user's topic is denied");
    await run(`SELECT set_config('request.jwt.claim.sub', '', true)`);
    await run(`SELECT set_config('realtime.topic', 'inbox:', true)`);
    assert.equal((await rows(`SELECT count(*)::int n FROM realtime.messages`))[0].n, 0, 'no identity, no topic');
    await run(`SAVEPOINT spoof`);
    await assert.rejects(run(`INSERT INTO realtime.messages(topic, extension, event, payload) VALUES ('inbox:${b}', 'broadcast', 'inbox', '{}')`), /row-level security/);
    await run(`ROLLBACK TO SAVEPOINT spoof`);
    await run(`INSERT INTO realtime.messages(topic, extension, event, payload) VALUES ('room:other', 'broadcast', 'x', '{}')`);
    // Browser roles still have no access to the notification table itself.
    await run(`SAVEPOINT table_denied`);
    await assert.rejects(rows(`SELECT 1 FROM "UserNotification" LIMIT 1`), /permission denied|row-level security/);
    await run(`ROLLBACK TO SAVEPOINT table_denied`);
    await run(`RESET ROLE`);
    // Trigger functions are not callable by browser roles.
    assert.equal((await rows(`SELECT has_function_privilege('authenticated', 'public.outclass_signal_inbox()', 'EXECUTE') ok`))[0].ok, false);
    throw ROLLBACK;
  }, { timeout: 30000 }), e => e === ROLLBACK);
  assert.equal((await prisma.$queryRawUnsafe(`SELECT to_regclass('realtime.messages')::text r`))[0].r, null, 'nothing persisted');
});
