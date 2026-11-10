// Opt-in native PostgreSQL test for 20261109190000_clear_unproven_password. A minimal auth.users stand-in is
// created inside one transaction that is rolled back. The real Supabase Auth flow (pre-registration, email
// code, repeated signup, recovery) is exercised separately on a disposable Supabase stack.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const databaseUrl = process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;
const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261109190000_clear_unproven_password/migration.sql'), 'utf8');
const ROLLBACK = Symbol('rollback');

test('migration is transactional and the trigger fires only on the first confirmation', () => {
  const sql = migration.replace(/--[^\n]*/g, '').trim();
  assert.ok(sql.startsWith('BEGIN;') && sql.endsWith('COMMIT;'));
  assert.match(sql, /WHEN \(OLD\.email_confirmed_at IS NULL AND NEW\.email_confirmed_at IS NOT NULL\)/);
  assert.match(sql, /SET search_path = ''/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.outclass_clear_unproven_password\(\) FROM PUBLIC/);
});

test('native PostgreSQL: first confirmation clears a pre-set password; everything else keeps it', { skip: !databaseUrl, timeout: 60000 }, async t => {
  const url = new URL(databaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/outclass_security_test', 'Only an isolated local outclass_security_test database is allowed');
  const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient({ datasourceUrl: databaseUrl }); t.after(() => prisma.$disconnect());
  const body = migration.replace(/^\s*BEGIN;\s*$/m, '').replace(/^\s*COMMIT;\s*$/m, '');
  const statements = [body.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$fn\$;/)[0], body.match(/REVOKE ALL[^;]*;/)[0], body.match(/DO \$trg\$[\s\S]*\$trg\$;/)[0]];
  await assert.rejects(prisma.$transaction(async tx => {
    const run = sql => tx.$executeRawUnsafe(sql);
    const rows = sql => tx.$queryRawUnsafe(sql);
    const pw = async id => (await rows(`SELECT encrypted_password AS p FROM auth.users WHERE id = '${id}'`))[0].p;
    if ((await rows(`SELECT to_regclass('auth.users') IS NULL AS absent`))[0].absent) {
      for (const s of statements) await run(s); // no auth.users: function only, no trigger
      assert.equal((await rows(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'outclass_clear_unproven_password'`))[0].n, 0);
      await run(`CREATE SCHEMA IF NOT EXISTS auth`);
      await run(`CREATE TABLE auth.users (id text PRIMARY KEY, email text, encrypted_password text, email_confirmed_at timestamptz)`);
    }
    for (const s of statements) await run(s);
    for (const s of statements) await run(s); // idempotent
    assert.equal((await rows(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'outclass_clear_unproven_password' AND tgrelid = 'auth.users'::regclass`))[0].n, 1);
    await run(`INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) VALUES
      ('pre', 'pre@virginia.edu', 'hash-from-first-signup', NULL),
      ('op', 'op@virginia.edu', 'old', NULL),
      ('done', 'done@virginia.edu', 'owner-hash', now()),
      ('wait', 'wait@virginia.edu', 'pending-hash', NULL)`);
    await run(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = 'pre'`);
    assert.equal(await pw('pre'), '', 'first confirmation clears the pre-set password');
    await run(`UPDATE auth.users SET email_confirmed_at = now(), encrypted_password = 'set-while-confirming' WHERE id = 'op'`);
    assert.equal(await pw('op'), 'set-while-confirming', 'a password written in the same statement is kept');
    await run(`UPDATE auth.users SET encrypted_password = 'owner-set-after' WHERE id = 'pre'`);
    assert.equal(await pw('pre'), 'owner-set-after', 'the confirmed owner can set a password afterwards');
    await run(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = 'done'`);
    assert.equal(await pw('done'), 'owner-hash', 'already-confirmed accounts are untouched');
    await run(`UPDATE auth.users SET encrypted_password = 'changed' WHERE id = 'wait'`);
    assert.equal(await pw('wait'), 'changed', 'updates without confirmation are untouched');
    throw ROLLBACK;
  }), error => error === ROLLBACK);
});
