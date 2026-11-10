// Opt-in native PostgreSQL test for 20261109130000_new_user_trigger_execute. The Supabase-managed
// function, its trigger and roles are recreated with minimal stand-ins inside one transaction that is
// rolled back. The ACL behaviour does not depend on the function body.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const databaseUrl = process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;
const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261109130000_new_user_trigger_execute/migration.sql'), 'utf8');
const ROLLBACK = Symbol('rollback');

test('native PostgreSQL: only owners and service_role can execute the new-user trigger function, and the trigger still fires', { skip: !databaseUrl, timeout: 60000 }, async t => {
  const url = new URL(databaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/outclass_security_test', 'Only an isolated local outclass_security_test database is allowed');
  const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient({ datasourceUrl: databaseUrl }); t.after(() => prisma.$disconnect());
  const block = migration.match(/DO \$grants\$[\s\S]*\$grants\$;/)?.[0];
  assert.ok(block, 'migration body found');
  await assert.rejects(prisma.$transaction(async tx => {
    const run = sql => tx.$executeRawUnsafe(sql);
    const rows = sql => tx.$queryRawUnsafe(sql);
    const can = async role => (await rows(`SELECT has_function_privilege('${role}', 'public.handle_new_user()', 'EXECUTE') AS ok`))[0].ok;
    if (!(await rows(`SELECT to_regprocedure('public.handle_new_user()') IS NOT NULL AS ok`))[0].ok) {
      await run(block); // absent function: no-op (the Prisma-only migration chain)
    }
    for (const role of ['anon', 'authenticated', 'service_role', 'supabase_auth_admin', 'outclass_test_fn_owner', 'outclass_test_other_grantor'])
      await run(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF; END $$`);
    await run(`CREATE SCHEMA outclass_test_auth`);
    await run(`CREATE TABLE outclass_test_auth.users (id uuid PRIMARY KEY, email text)`);
    await run(`CREATE TABLE outclass_test_auth.created (id uuid PRIMARY KEY, email text)`);
    await run(`CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
      BEGIN INSERT INTO outclass_test_auth.created VALUES (NEW.id, lower(NEW.email)); RETURN NEW; END $$`);
    await run(`CREATE TRIGGER on_test_user_created AFTER INSERT ON outclass_test_auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()`);
    await run(`GRANT USAGE ON SCHEMA outclass_test_auth TO supabase_auth_admin`);
    await run(`GRANT INSERT ON outclass_test_auth.users TO supabase_auth_admin`);
    await run(`GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated, service_role`);
    assert.deepEqual([await can('anon'), await can('authenticated')], [true, true], 'baseline: Supabase default grants');

    await run(block); await run(block); // owner applies; idempotent
    assert.deepEqual([await can('anon'), await can('authenticated'), await can('supabase_auth_admin')], [false, false, false], 'no EXECUTE directly or through PUBLIC');
    assert.equal(await can('service_role'), true, 'service_role keeps EXECUTE');
    for (const role of ['anon', 'authenticated']) {
      await run(`SAVEPOINT direct_${role}`);
      await run(`SET LOCAL ROLE ${role}`);
      await assert.rejects(rows(`SELECT public.handle_new_user()`), /permission denied/, `${role} cannot call it`);
      await run(`ROLLBACK TO SAVEPOINT direct_${role}`);
    }
    await run(`SET LOCAL ROLE supabase_auth_admin`);
    await run(`INSERT INTO outclass_test_auth.users VALUES ('00000000-0000-4000-8000-000000000001', 'New.Student@Virginia.edu')`);
    await run(`RESET ROLE`);
    assert.deepEqual(await rows(`SELECT email FROM outclass_test_auth.created`), [{ email: 'new.student@virginia.edu' }], 'the trigger still fires for a role without EXECUTE');

    // A grant made by another role survives a REVOKE by the owner: the migration warns instead of failing,
    // so a recorded failure can never block later deploys.
    await run(`ALTER FUNCTION public.handle_new_user() OWNER TO outclass_test_fn_owner`);
    await run(`GRANT EXECUTE ON FUNCTION public.handle_new_user() TO outclass_test_other_grantor WITH GRANT OPTION`);
    await run(`SET LOCAL ROLE outclass_test_other_grantor`);
    await run(`GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon`);
    await run(`RESET ROLE`);
    await run(`SET LOCAL ROLE outclass_test_fn_owner`);
    await run(block);
    await run(`RESET ROLE`);
    assert.equal(await can('anon'), true, 'documented limitation: the other grantor must revoke its own grant');
    throw ROLLBACK;
  }), error => error === ROLLBACK);
});
