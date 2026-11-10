// Opt-in native PostgreSQL test for 20261109190000_clear_unproven_password. A minimal auth.users stand-in is
// created inside one transaction that is rolled back. A later transaction is simulated by clearing the
// transaction-local marker. The real Supabase Auth flows (signup, email code, recovery, admin create and
// update) are exercised separately on a disposable Supabase stack.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const databaseUrl = process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;
const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261109190000_clear_unproven_password/migration.sql'), 'utf8');
const ROLLBACK = Symbol('rollback');

test('migration is transactional, pinned, revoked from browser roles and lock-bounded', () => {
  const sql = migration.replace(/--[^\n]*/g, '').trim();
  assert.ok(sql.startsWith('BEGIN;') && sql.endsWith('COMMIT;'));
  assert.match(sql, /SET LOCAL lock_timeout = '5s';/);
  assert.match(sql, /LANGUAGE plpgsql SET search_path = ''/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.outclass_clear_unproven_password\(\) FROM PUBLIC/);
  assert.match(sql, /ARRAY\['anon', 'authenticated'\]/);
  assert.match(sql, /BEFORE INSERT OR UPDATE ON auth\.users/);
});

test('native PostgreSQL: a first confirmation by a later request clears the password; operator paths keep it', { skip: !databaseUrl, timeout: 60000 }, async t => {
  const url = new URL(databaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/outclass_security_test', 'Only an isolated local outclass_security_test database is allowed');
  const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient({ datasourceUrl: databaseUrl }); t.after(() => prisma.$disconnect());
  const body = migration.replace(/^\s*BEGIN;\s*$/m, '').replace(/^\s*COMMIT;\s*$/m, '').replace(/^\s*SET LOCAL lock_timeout[^\n]*$/m, '');
  const statements = [body.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$fn\$;/)[0], body.match(/REVOKE ALL ON FUNCTION[^;]*FROM PUBLIC;/)[0], body.match(/DO \$trg\$[\s\S]*\$trg\$;/)[0]];
  await assert.rejects(prisma.$transaction(async tx => {
    const run = sql => tx.$executeRawUnsafe(sql);
    const rows = sql => tx.$queryRawUnsafe(sql);
    const pw = async id => (await rows(`SELECT encrypted_password AS p FROM auth.users WHERE id = '${id}'`))[0].p;
    const laterRequest = () => run(`SELECT set_config('outclass.auth_password_set', '', true)`);
    for (const role of ['anon', 'authenticated', 'outclass_test_auth_admin'])
      await run(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF; END $$`);
    if ((await rows(`SELECT to_regclass('auth.users') IS NULL AS absent`))[0].absent) {
      for (const s of statements) await run(s); // no auth.users: function only, no trigger
      assert.equal((await rows(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'outclass_clear_unproven_password'`))[0].n, 0);
      await run(`CREATE SCHEMA IF NOT EXISTS auth`);
      await run(`CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, encrypted_password text, email_confirmed_at timestamptz, last_sign_in_at timestamptz)`);
    }
    for (const s of statements) await run(s);
    for (const s of statements) await run(s); // idempotent
    assert.equal((await rows(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'outclass_clear_unproven_password' AND tgrelid = 'auth.users'::regclass`))[0].n, 1);
    for (const role of ['anon', 'authenticated'])
      assert.equal((await rows(`SELECT has_function_privilege('${role}', 'public.outclass_clear_unproven_password()', 'EXECUTE') AS ok`))[0].ok, false, `${role} cannot execute`);

    const id = n => `00000000-0000-4000-8000-00000000000${n}`;
    // Operator create-and-confirm in one transaction keeps its password.
    await run(`INSERT INTO auth.users (id, email, encrypted_password) VALUES ('${id(1)}', 'op@virginia.edu', 'operator-hash')`);
    await run(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = '${id(1)}'`);
    assert.equal(await pw(id(1)), 'operator-hash', 'created in this transaction');

    // Signup in one request, first confirmation in a later one: cleared.
    await run(`INSERT INTO auth.users (id, email, encrypted_password) VALUES ('${id(2)}', 'pre@virginia.edu', 'first-signup-hash'),
      ('${id(3)}', 'set@virginia.edu', 'old-hash'), ('${id(4)}', 'done@virginia.edu', 'owner-hash'), ('${id(5)}', 'wait@virginia.edu', 'pending-hash')`);
    await run(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = '${id(4)}'`);
    await laterRequest();
    await run(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = '${id(2)}'`);
    assert.equal(await pw(id(2)), '', 'first confirmation by a later request clears the password');
    await run(`UPDATE auth.users SET encrypted_password = 'owner-set-after' WHERE id = '${id(2)}'`);
    assert.equal(await pw(id(2)), 'owner-set-after', 'the confirmed owner can set a password afterwards');

    // Operator sets a password and confirms in one transaction (separate statements): kept.
    await laterRequest();
    await run(`UPDATE auth.users SET encrypted_password = 'operator-set' WHERE id = '${id(3)}'`);
    await run(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = '${id(3)}'`);
    assert.equal(await pw(id(3)), 'operator-set');

    // Already confirmed, sign-in timestamps and unconfirmed password changes are untouched.
    await laterRequest();
    await run(`UPDATE auth.users SET last_sign_in_at = now(), email_confirmed_at = now() WHERE id = '${id(4)}'`);
    assert.equal(await pw(id(4)), 'owner-hash');
    await run(`UPDATE auth.users SET encrypted_password = 'changed' WHERE id = '${id(5)}'`);
    assert.equal(await pw(id(5)), 'changed');

    // Fires for a role without EXECUTE (Supabase Auth's role): trigger firing does not check EXECUTE.
    await laterRequest();
    await run(`INSERT INTO auth.users (id, email, encrypted_password) VALUES ('${id(6)}', 'role@virginia.edu', 'role-hash')`);
    await laterRequest();
    await run(`GRANT USAGE ON SCHEMA auth TO outclass_test_auth_admin`);
    await run(`GRANT SELECT, UPDATE ON auth.users TO outclass_test_auth_admin`);
    await run(`SET LOCAL ROLE outclass_test_auth_admin`);
    await run(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = '${id(6)}'`);
    await run(`RESET ROLE`);
    assert.equal(await pw(id(6)), '', 'cleared when fired by a role without EXECUTE');
    throw ROLLBACK;
  }), error => error === ROLLBACK);
});
