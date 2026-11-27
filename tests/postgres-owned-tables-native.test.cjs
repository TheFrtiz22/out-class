// DB-OWN-2 rehearsal on real PostgreSQL (node scripts/run-disposable-postgres.cjs security).
// Builds its own scratch database on the disposable cluster, shaped like production on
// 2026-11-26: a non-superuser BYPASSRLS operator that owns the ledger and runs Prisma, and a
// server role that owns every table without its own "<table>_runtime_<command>" policies.
// Then: a held lock makes the migration fail fast and change nothing; it applies through
// `prisma migrate deploy`; it is safe to repeat; the emergency rollback and a re-apply work.
// Never touches the suite's main database or any hosted service.
'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const databaseUrl = process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;
const target = '20261127010000_postgres_owned_tables';
const runtime = 'outclass_production_app', operator = 'outclass_rehearsal_operator', scratch = 'outclass_ownership_rehearsal';
const prismaCli = path.resolve('node_modules/prisma/build/index.js');
const migrationFile = path.resolve('prisma/migrations', target, 'migration.sql');
const rollbackFile = path.resolve('scripts/db/rollback-postgres-owned-tables.sql');

const state = `SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,
  (SELECT string_agg(r.rolname || '=' || x.p, ',' ORDER BY r.rolname, x.p) FROM pg_roles r CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) AS x(p)
    WHERE r.rolname IN ('${runtime}','anon','authenticated') AND has_table_privilege(r.oid, c.oid, x.p)) AS privileges,
  COALESCE((SELECT string_agg(p.polname || ':' || p.polpermissive || ':' || p.polcmd || ':' || p.polroles::regrole[]::text || ':' || COALESCE(pg_get_expr(p.polqual,p.polrelid),'') || ':' || COALESCE(pg_get_expr(p.polwithcheck,p.polrelid),''), '|' ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid=c.oid),'') AS policies
  FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p') ORDER BY c.relname`;

test('native PostgreSQL: ownership migration on a production-shaped database, as a non-superuser operator', { skip: !databaseUrl, timeout: 600000 }, async t => {
  const base = new URL(databaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname) && base.pathname === '/outclass_security_test', 'Requires the disposable local outclass_security_test database');
  const urlFor = (role, database) => { const u = new URL(databaseUrl); u.username = role; u.pathname = '/' + database; return u.toString(); };
  const { PrismaClient } = require('@prisma/client');
  const admin = new PrismaClient({ datasourceUrl: databaseUrl });
  const clients = [admin];
  const client = url => { const c = new PrismaClient({ datasourceUrl: url }); clients.push(c); return c; };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'outclass-ownership-'));
  t.after(async () => {
    for (const c of clients.slice(1)) await c.$disconnect().catch(() => {});
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`).catch(() => {});
    await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS ${operator}`).catch(() => {});
    await admin.$disconnect();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const [version] = await admin.$queryRawUnsafe(`SELECT current_setting('server_version_num')::int AS n`);
  assert.ok(version.n >= 170000, 'production runs PostgreSQL 17');
  // Production's operator: no superuser, BYPASSRLS, owns the database, can act as the server role.
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`);
  await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS ${operator}`);
  await admin.$executeRawUnsafe(`CREATE ROLE ${operator} LOGIN NOSUPERUSER BYPASSRLS CREATEROLE`);
  await admin.$executeRawUnsafe(`GRANT ${runtime} TO ${operator}`);
  await admin.$executeRawUnsafe(`CREATE DATABASE ${scratch} OWNER ${operator}`);
  const scratchAdmin = client(urlFor(base.username, scratch));
  await scratchAdmin.$executeRawUnsafe(`CREATE SCHEMA auth AUTHORIZATION ${operator}`);
  await scratchAdmin.$executeRawUnsafe(`CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz)`);
  await scratchAdmin.$executeRawUnsafe(`ALTER TABLE auth.sessions OWNER TO ${operator}`);
  await scratchAdmin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA auth TO ${runtime}`);
  await scratchAdmin.$executeRawUnsafe(`GRANT SELECT ON auth.sessions TO ${runtime}`);
  await scratchAdmin.$executeRawUnsafe(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);

  const operatorUrl = urlFor(operator, scratch), env = { ...process.env, DATABASE_URL: operatorUrl };
  const names = fs.readdirSync('prisma/migrations').filter(n => fs.existsSync(path.join('prisma/migrations', n, 'migration.sql'))).sort();
  const schemaWith = (label, keep) => {
    const dir = path.join(root, label); fs.mkdirSync(path.join(dir, 'migrations'), { recursive: true });
    fs.copyFileSync('prisma/schema.prisma', path.join(dir, 'schema.prisma'));
    fs.copyFileSync('prisma/migrations/migration_lock.toml', path.join(dir, 'migrations/migration_lock.toml'));
    for (const n of names.filter(keep)) fs.cpSync(path.join('prisma/migrations', n), path.join(dir, 'migrations', n), { recursive: true });
    return path.join(dir, 'schema.prisma');
  };
  const deploy = schema => { const r = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schema], { env, encoding: 'utf8' }); assert.equal(r.status, 0, r.stdout + r.stderr); };
  const execute = file => new Promise(resolve => {
    const child = spawn(process.execPath, [prismaCli, 'db', 'execute', '--file', file, '--url', operatorUrl], { env });
    let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
    child.on('close', status => resolve({ status, output }));
  });
  const op = client(operatorUrl), app = client(urlFor(runtime, scratch));
  const snapshot = () => op.$queryRawUnsafe(state);

  // Every migration before this one, applied by the operator through Prisma, as production's history was.
  deploy(schemaWith('before', n => n < target));
  const [who] = await op.$queryRawUnsafe(`SELECT current_user AS name, rolsuper, rolbypassrls, (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public._prisma_migrations'::regclass) AS ledger_owner FROM pg_roles WHERE rolname=current_user`);
  assert.deepEqual(who, { name: operator, rolsuper: false, rolbypassrls: true, ledger_owner: operator });
  // Production's split: the server role owns every table that has no server-role policy of its own.
  const moved = await scratchAdmin.$queryRawUnsafe(`SELECT c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname<>'_prisma_migrations'
    AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polpermissive AND '${runtime}'::regrole::oid = ANY(p.polroles))`);
  for (const { relname } of moved) await scratchAdmin.$executeRawUnsafe(`ALTER TABLE public."${relname}" OWNER TO ${runtime}`);
  const before = await snapshot();
  const owned = before.filter(r => r.owner === runtime).length, explicit = before.filter(r => r.owner === operator && r.relname !== '_prisma_migrations').length;
  assert.ok(owned > 50 && explicit > 10 && owned + explicit + 1 === before.length, `production-shaped split ${owned}/${explicit}`);
  console.log(`Rehearsal split: ${owned} tables owned by the server role, ${explicit} by the operator, plus the ledger.`);
  // Rows written by the server role while it still owned its tables.
  const user = await app.user.create({ data: { email: 'ownership-rehearsal@virginia.edu' } });

  await t.test('a lock held by a running request makes it fail within the lock timeout and change nothing', async () => {
    const started = Date.now();
    const result = await app.$transaction(async tx => {
      await tx.$queryRawUnsafe(`SELECT id FROM "Club" LIMIT 1`); // ACCESS SHARE on Club until this transaction ends
      return execute(migrationFile);
    }, { timeout: 60000, maxWait: 10000 });
    assert.notEqual(result.status, 0, 'the migration must not succeed while a table is locked');
    assert.match(result.output, /lock timeout|lock_timeout|55P03/i);
    assert.ok(Date.now() - started < 15000, 'it gives up within the bounded wait');
    assert.deepEqual(await snapshot(), before);
  });

  await t.test('applies through prisma migrate deploy; the server role keeps row access and loses structure', async () => {
    deploy(schemaWith('all', () => true));
    const after = await snapshot();
    assert.deepEqual(after.filter(r => r.owner !== operator).map(r => r.relname), [], 'every table belongs to the operator');
    for (const row of after.filter(r => before.find(b => b.relname === r.relname)?.owner === operator)) assert.deepEqual(row, before.find(b => b.relname === row.relname), `${row.relname}: an already operator-owned table changed`);
    assert.equal((await app.user.findUniqueOrThrow({ where: { id: user.id } })).email, user.email);
    await app.user.update({ where: { id: user.id }, data: { firstName: 'Kept' } });
    const second = await app.user.create({ data: { email: 'ownership-rehearsal-2@virginia.edu' } });
    await app.user.delete({ where: { id: second.id } });
    assert.equal((await app.$queryRawUnsafe(`SELECT id FROM "User" WHERE id='${user.id}' FOR UPDATE`)).length, 1);
    for (const ddl of [`TRUNCATE "AuditLog"`, `ALTER TABLE "User" DISABLE ROW LEVEL SECURITY`, `ALTER TABLE "Club" ADD COLUMN rehearsal int`, `DROP POLICY outclass_runtime_access ON "User"`, `ALTER TABLE "User" OWNER TO ${runtime}`, `CREATE TABLE public.rehearsal(id int)`, `SELECT * FROM "_prisma_migrations"`])
      await assert.rejects(app.$executeRawUnsafe(ddl), /must be owner|permission denied/, ddl);
    const [role] = await app.$queryRawUnsafe(`SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    assert.deepEqual(role, { name: runtime, rolsuper: false, rolbypassrls: false });
  });

  await t.test('is safe to repeat, rolls back with the emergency script, and re-applies to the same state', async () => {
    const applied = await snapshot();
    let result = await execute(migrationFile); assert.equal(result.status, 0, result.output);
    assert.deepEqual(await snapshot(), applied);
    result = await execute(rollbackFile); assert.equal(result.status, 0, result.output);
    const rolledBack = await snapshot();
    assert.equal(rolledBack.filter(r => r.owner === runtime).length, owned, 'rollback returns exactly the tables that were moved');
    assert.equal((await app.user.findUniqueOrThrow({ where: { id: user.id } })).firstName, 'Kept');
    const [create] = await op.$queryRawUnsafe(`SELECT has_schema_privilege('${runtime}','public','CREATE') AS allowed`);
    assert.equal(create.allowed, false);
    result = await execute(migrationFile); assert.equal(result.status, 0, result.output);
    assert.deepEqual(await snapshot(), applied);
    assert.equal((await app.user.findUniqueOrThrow({ where: { id: user.id } })).firstName, 'Kept');
  });
});
