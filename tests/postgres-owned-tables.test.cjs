// 20261127010000_postgres_owned_tables (DB-OWN-2): the server role owns no table and works
// through explicit grants and policies. Runs on in-process PGlite; no hosted service.
// Nothing here hard-codes a table count: expectations are read from the catalog before the
// migration and compared with the catalog after it.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite');
const dir = path.resolve('prisma/migrations'), target = '20261127010000_postgres_owned_tables';
const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort();
const sql = n => fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8');
const rollback = fs.readFileSync('scripts/db/rollback-postgres-owned-tables.sql', 'utf8');
const runtime = 'outclass_production_app';
const DML = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

const tablesQuery = `SELECT c.oid::int AS oid, c.relname, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls, c.relforcerowsecurity AS force,
  EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polpermissive AND p.polname<>'outclass_runtime_access' AND (SELECT oid FROM pg_roles WHERE rolname='${runtime}') = ANY(p.polroles)) AS own_policies
  FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p') AND c.relname<>'_prisma_migrations' ORDER BY c.relname`;
const policiesQuery = `SELECT tablename, policyname, permissive, cmd, roles::text[] AS roles, qual, with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname`;
const privilegesQuery = `SELECT c.relname, x.p AS privilege FROM pg_class c CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) AS x(p)
  WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p') AND has_table_privilege('${runtime}', c.oid, x.p) ORDER BY 1, 2`;
const functionsQuery = `SELECT p.oid::regprocedure::text AS f, pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.proacl::text AS acl FROM pg_proc p WHERE p.pronamespace='public'::regnamespace ORDER BY 1`;
const defaultsQuery = `SELECT pg_get_userbyid(defaclrole) AS role, defaclnamespace::regnamespace::text AS ns, defaclobjtype::text AS kind, defaclacl::text AS acl FROM pg_default_acl ORDER BY 1,2,3`;
const rows = async (db, q) => (await db.query(q)).rows;
const asRole = async (db, role, statement) => { await db.exec(`SET ROLE ${role}`); try { return await db.query(statement); } finally { await db.exec('RESET ROLE'); } };

// mode 'production': the catalog split found in production on 2026-11-26. The server role owns
// every table except those that carry their own "<table>_runtime_<command>" policies, which the
// operator owns; deny-everyone policies still name PUBLIC.
async function build(mode) {
  const db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  if (mode !== 'no-server-role') await db.exec(`CREATE ROLE ${runtime} NOLOGIN NOSUPERUSER NOBYPASSRLS;`);
  for (const n of names.filter(n => n < target)) await db.exec(sql(n));
  if (mode === 'production') {
    for (const t of await rows(db, tablesQuery)) if (!t.own_policies) await db.exec(`ALTER TABLE public."${t.relname}" OWNER TO ${runtime}`);
  }
  return db;
}
const seed = `INSERT INTO "User"(id,email,role) VALUES ('u','u@virginia.edu','STUDENT');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES ('c','c','C','','','#ffffff','Academic');
 INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES ('m','c','u','PRESIDENT');
 INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES ('r','c','Review',0);
 INSERT INTO "Application"(id,"studentId","clubId","roundId",status) VALUES ('a','u','c','r','IN_REVIEW');`;

async function assertModel(db, before) {
  const tables = await rows(db, tablesQuery), policies = await rows(db, policiesQuery), privileges = await rows(db, privilegesQuery);
  const has = (table, privilege) => privileges.some(p => p.relname === table && p.privilege === privilege);
  assert.deepEqual(tables.filter(t => t.owner === runtime).map(t => t.relname), [], 'server role still owns tables');
  assert.equal(new Set(tables.map(t => t.owner)).size, 1, 'application tables have one owner');
  assert.deepEqual(tables.map(t => t.relname), before.tables.map(t => t.relname), 'the set of tables is unchanged');
  for (const t of tables) {
    const was = before.tables.find(b => b.relname === t.relname), mine = policies.filter(p => p.tablename === t.relname);
    assert.equal(t.rls, true, `${t.relname}: RLS is off`);
    assert.equal(t.force, was.force, `${t.relname}: FORCE RLS changed`);
    for (const privilege of ['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) assert.equal(has(t.relname, privilege), false, `server role has ${privilege} on ${t.relname}`);
    for (const role of ['anon', 'authenticated']) for (const privilege of DML)
      assert.equal((await db.query(`SELECT has_table_privilege($1,$2::oid,$3) a`, [role, t.oid, privilege])).rows[0].a, false, `${role} can ${privilege} ${t.relname}`);
    // No policy that applies to every role may deny the server role.
    assert.deepEqual(mine.filter(p => p.permissive === 'RESTRICTIVE' && (p.roles.includes('public') || p.roles.includes(runtime))), [], `${t.relname}: a restrictive policy applies to the server role`);
    if (was.own_policies) {
      // Tables already in the target model: grants and policies are byte-for-byte what they were.
      assert.deepEqual(mine, before.policies.filter(p => p.tablename === t.relname), `${t.relname}: explicit policies changed`);
      assert.deepEqual(privileges.filter(p => p.relname === t.relname), before.privileges.filter(p => p.relname === t.relname), `${t.relname}: explicit grants changed`);
    } else {
      assert.deepEqual(mine.filter(p => p.policyname === 'outclass_runtime_access').map(p => [p.permissive, p.cmd, p.roles, p.qual, p.with_check]), [['PERMISSIVE', 'ALL', [runtime], 'true', 'true']], `${t.relname}: server-role policy`);
      assert.deepEqual(mine.filter(p => p.permissive === 'PERMISSIVE').map(p => p.policyname), ['outclass_runtime_access'], `${t.relname}: duplicate or conflicting permissive policy`);
      for (const privilege of DML) assert.equal(has(t.relname, privilege), true, `server role lost ${privilege} on ${t.relname}`);
      // Exactly one browser denial: the table's earlier deny policy, rescoped, or the new one.
      const deny = mine.filter(p => p.permissive === 'RESTRICTIVE' && p.cmd === 'ALL' && p.qual === 'false' && p.with_check === 'false' && ['anon', 'authenticated'].every(r => p.roles.includes(r)));
      const earlier = before.policies.filter(p => p.tablename === t.relname && p.permissive === 'RESTRICTIVE' && p.qual === 'false' && p.cmd === 'ALL').map(p => p.policyname);
      assert.deepEqual(deny.map(p => p.policyname), earlier.length ? earlier : ['outclass_browser_deny'], `${t.relname}: browser denial`);
    }
  }
  // Every privilege the server role had on a row operation, as owner or by grant, it still has.
  for (const p of before.privileges.filter(p => DML.includes(p.privilege) && p.relname !== '_prisma_migrations')) assert.equal(has(p.relname, p.privilege), true, `server role lost ${p.privilege} on ${p.relname}`);
  // Untouched: the ledger and its deny policies, functions (owner, SECURITY DEFINER, ACL) and default privileges.
  assert.deepEqual(policies.filter(p => p.tablename === '_prisma_migrations'), before.policies.filter(p => p.tablename === '_prisma_migrations'));
  assert.deepEqual(privileges.filter(p => p.relname === '_prisma_migrations'), []);
  assert.deepEqual(await rows(db, functionsQuery), before.functions, 'function ownership or EXECUTE changed');
  assert.deepEqual(await rows(db, defaultsQuery), before.defaults, 'default privileges changed');
  for (const f of ['handle_new_user', 'outclass_signal_inbox']) assert.equal(before.functions.filter(x => x.f.startsWith(f + '(')).every(x => x.prosecdef), true, `${f} is SECURITY DEFINER`);
}
const snapshot = async db => ({ tables: await rows(db, tablesQuery), policies: await rows(db, policiesQuery), privileges: await rows(db, privilegesQuery), functions: await rows(db, functionsQuery), defaults: await rows(db, defaultsQuery) });

for (const mode of ['production', 'fresh']) test(`server role owns no table and keeps its row access: ${mode}`, { timeout: 300000 }, async () => {
  const db = await build(mode);
  try {
    const before = await snapshot(db);
    if (mode === 'production') {
      // The fixture reproduces both halves of production's split, including the narrower voting tables.
      const owned = before.tables.filter(t => t.owner === runtime), explicit = before.tables.filter(t => t.own_policies);
      assert.ok(owned.length > 50 && explicit.length > 10 && owned.length + explicit.length === before.tables.length, `fixture split ${owned.length}/${explicit.length}`);
      assert.ok(explicit.filter(t => t.relname.startsWith('Voting')).length >= 6, 'narrower voting tables are part of the fixture');
      assert.ok(before.policies.some(p => p.permissive === 'RESTRICTIVE' && p.roles.includes('public') && p.qual === 'false'), 'deny-everyone policies are part of the fixture');
      await db.exec(`SET ROLE ${runtime}`); try { await db.exec(seed); } finally { await db.exec('RESET ROLE'); }
    } else await db.exec(seed);

    await db.exec(sql(target));
    await assertModel(db, before);
    const applied = await snapshot(db);
    await db.exec(sql(target)); // safe to repeat: nothing changes
    assert.deepEqual(await snapshot(db), applied);

    // The server role still reads and writes existing rows, on a table that had a deny policy and one that had none.
    assert.equal((await asRole(db, runtime, `SELECT count(*)::int n FROM "User"`)).rows[0].n, 1);
    assert.equal((await asRole(db, runtime, `SELECT count(*)::int n FROM "Application"`)).rows[0].n, 1);
    assert.equal((await asRole(db, runtime, `UPDATE "Club" SET tagline='t' WHERE id='c' RETURNING id`)).rows.length, 1);
    assert.equal((await asRole(db, runtime, `INSERT INTO "User"(id,email,role) VALUES ('u2','u2@virginia.edu','STUDENT') ON CONFLICT (id) DO UPDATE SET role='STUDENT' RETURNING id`)).rows.length, 1);
    assert.equal((await asRole(db, runtime, `SELECT id FROM "User" WHERE id='u2' FOR UPDATE`)).rows.length, 1);
    assert.equal((await asRole(db, runtime, `DELETE FROM "User" WHERE id='u2' RETURNING id`)).rows.length, 1);
    // Foreign keys still hold for the server role, and cascades still reach rows it can see.
    await assert.rejects(asRole(db, runtime, `INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES ('m2','missing','u','PRESIDENT')`), /foreign key/);
    // ...and it can no longer change structure, policies or ownership.
    for (const ddl of [`ALTER TABLE "User" DISABLE ROW LEVEL SECURITY`, `DROP TABLE "AuditLog"`, `TRUNCATE "ClubMember"`, `ALTER TABLE "Club" ADD COLUMN x int`,
      `CREATE POLICY x ON "User" FOR ALL TO anon USING (true)`, `DROP POLICY outclass_runtime_access ON "User"`, `ALTER TABLE "User" OWNER TO ${runtime}`,
      `CREATE TRIGGER x BEFORE INSERT ON "User" FOR EACH ROW EXECUTE FUNCTION public.outclass_audit_immutable()`, `CREATE INDEX x ON "User"(email)`, `CREATE TABLE public.x(id int)`])
      await assert.rejects(asRole(db, runtime, ddl), /must be owner|permission denied/, ddl);
    // An accidental browser grant plus permissive policy is still denied, with and without an earlier deny policy.
    await db.exec(`BEGIN; GRANT SELECT ON "User" TO authenticated; CREATE POLICY accidental ON "User" FOR SELECT TO authenticated USING (true)`);
    assert.equal((await asRole(db, 'authenticated', `SELECT count(*)::int n FROM "User"`)).rows[0].n, 0);
    await db.exec(`GRANT SELECT ON "Application" TO anon; CREATE POLICY accidental ON "Application" FOR SELECT TO anon USING (true)`);
    assert.equal((await asRole(db, 'anon', `SELECT count(*)::int n FROM "Application"`)).rows[0].n, 0);
    await db.exec('ROLLBACK');

    // Later migrations (including any merged after this one) must keep the model.
    for (const n of names.filter(n => n > target)) await db.exec(sql(n));
    const after = await rows(db, tablesQuery);
    assert.deepEqual(after.filter(t => t.owner === runtime).map(t => t.relname), [], 'a later migration gave a table to the server role');
    const unreachable = await rows(db, `SELECT c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p') AND c.relname<>'_prisma_migrations' AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname AND p.permissive='PERMISSIVE' AND p.roles::text[] @> ARRAY['${runtime}'])`);
    assert.deepEqual(unreachable, [], 'tables the server role cannot reach (add explicit grants and a policy in the migration that creates them)');

    // Emergency rollback gives ownership back; the forward migration then returns to the same state.
    await db.exec(rollback);
    const rolledBack = await rows(db, tablesQuery);
    assert.deepEqual(rolledBack.filter(t => !t.own_policies && t.owner !== runtime).map(t => t.relname), [], 'rollback left a table with the operator');
    assert.deepEqual(rolledBack.filter(t => t.own_policies && t.owner === runtime).map(t => t.relname), [], 'rollback moved a table that was never moved');
    assert.equal((await db.query(`SELECT has_schema_privilege('${runtime}','public','CREATE') a`)).rows[0].a, false);
    assert.equal((await asRole(db, runtime, `SELECT count(*)::int n FROM "User"`)).rows[0].n, 1);
    await db.exec(sql(target));
    if (!names.some(n => n > target)) assert.deepEqual(await snapshot(db), applied, 'rollback then re-apply differs from the first apply');
    assert.deepEqual((await rows(db, tablesQuery)).filter(t => t.owner === runtime), []);
  } finally { await db.close(); }
});

test('the migration aborts and changes nothing when the server role would be locked out or left with too much', { timeout: 300000 }, async () => {
  const db = await build('production');
  try {
    const before = await snapshot(db);
    const refuses = async (setup, pattern, undo) => {
      await db.exec(setup);
      const start = await snapshot(db);
      await assert.rejects(db.exec(sql(target)), pattern);
      await db.exec('ROLLBACK').catch(() => {});
      assert.deepEqual(await snapshot(db), start, `a failed run changed the catalog: ${pattern}`);
      await db.exec(undo);
    };
    // A restrictive policy with a real condition would start to apply to a role that used to bypass it.
    await refuses(`CREATE POLICY narrowing ON "Club" AS RESTRICTIVE FOR SELECT TO PUBLIC USING (id <> 'hidden')`, /restrictive policy would still block/, `DROP POLICY narrowing ON "Club"`);
    // A CHECK helper the server role cannot execute would fail every write to that table (the grant from 20261127000000).
    await refuses(`REVOKE ALL ON FUNCTION public.outclass_scholar_status_valid(jsonb) FROM PUBLIC, ${runtime}`, /cannot execute a CHECK or default helper/, `GRANT EXECUTE ON FUNCTION public.outclass_scholar_status_valid(jsonb) TO ${runtime}`);
    // A structural privilege reached through PUBLIC cannot be revoked from the role alone.
    await refuses(`GRANT TRUNCATE ON "AuditLog" TO PUBLIC`, /keeps a structural privilege/, `REVOKE TRUNCATE ON "AuditLog" FROM PUBLIC`);
    // The server role must not run it, own other kinds of objects, or inherit the owner.
    await refuses(`CREATE VIEW public.runtime_view AS SELECT 1 AS x; ALTER VIEW public.runtime_view OWNER TO ${runtime}`, /owns objects this migration does not move/, `DROP VIEW public.runtime_view`);
    await refuses(`GRANT postgres TO ${runtime}`, /must not be, or be a member of, the table owner/, `REVOKE postgres FROM ${runtime}`);
    // Only the ledger's owner may run it, so every table ends with one owner.
    await refuses(`CREATE ROLE other_operator SUPERUSER; CREATE TABLE public._prisma_migrations(id text); ALTER TABLE public._prisma_migrations OWNER TO other_operator`, /owner of the migration ledger/, `DROP TABLE public._prisma_migrations; DROP ROLE other_operator`);
    // After each refusal was undone the migration applies cleanly.
    // (The helper's ACL is now explicit rather than default, so functions are compared from here.)
    const functions = await rows(db, functionsQuery);
    await db.exec(sql(target));
    await assertModel(db, { ...before, functions });
  } finally { await db.close(); }
});

test('sequences keep working for the server role, including one it owned', { timeout: 300000 }, async () => {
  const db = await build('production');
  try {
    await db.exec(`CREATE TABLE public."SerialFixture"(id serial PRIMARY KEY, note text); ALTER TABLE public."SerialFixture" ENABLE ROW LEVEL SECURITY; ALTER TABLE public."SerialFixture" OWNER TO ${runtime};
      CREATE SEQUENCE public.fixture_counter; ALTER SEQUENCE public.fixture_counter OWNER TO ${runtime};
      CREATE SEQUENCE public.fixture_granted; GRANT USAGE ON SEQUENCE public.fixture_granted TO ${runtime}; CREATE SEQUENCE public.fixture_private;`);
    await db.exec(sql(target));
    assert.deepEqual(await rows(db, `SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='S' AND pg_get_userbyid(relowner)='${runtime}'`), []);
    assert.equal((await asRole(db, runtime, `INSERT INTO "SerialFixture"(note) VALUES ('a') RETURNING id`)).rows[0].id, 1);
    assert.equal(Number((await asRole(db, runtime, `SELECT nextval('public.fixture_counter') n`)).rows[0].n), 1);
    assert.equal(Number((await asRole(db, runtime, `SELECT setval('public.fixture_counter', 5) n`)).rows[0].n), 5);
    assert.equal(Number((await asRole(db, runtime, `SELECT nextval('public.fixture_granted') n`)).rows[0].n), 1);
    await assert.rejects(asRole(db, runtime, `SELECT nextval('public.fixture_private')`), /permission denied/); // nothing new is granted
    await assert.rejects(asRole(db, runtime, `ALTER SEQUENCE public.fixture_counter RESTART`), /must be owner/);
    // An owned table that also has its own narrower policies needs a decision, not a guess.
    // (Last: handing a table to the server role and back discards its explicit grants.)
    const explicit = (await rows(db, tablesQuery)).find(t => t.own_policies).relname;
    await db.exec(`ALTER TABLE public."${explicit}" OWNER TO ${runtime}`);
    await assert.rejects(db.exec(sql(target)), /also has its own server-role policies/);
    await db.exec('ROLLBACK');
  } finally { await db.close(); }
});

test('without the server role nothing changes', { timeout: 300000 }, async () => {
  const db = await build('no-server-role');
  try {
    const state = async () => [await rows(db, policiesQuery), await rows(db, `SELECT relname, pg_get_userbyid(relowner) o, relacl::text FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p','S') ORDER BY 1`)];
    const before = await state();
    await db.exec(sql(target));
    assert.deepEqual(await state(), before);
  } finally { await db.close(); }
});

test('no migration from this one on hands a table to the server role, and the fixtures do not either', () => {
  for (const n of names.filter(n => n >= target)) assert.doesNotMatch(sql(n).replace(/--.*$/gm, ''), new RegExp(`OWNER\\s+TO\\s+"?${runtime}`, 'i'), `${n} gives ownership to the server role`);
  for (const f of ['scripts/run-disposable-postgres.cjs', 'scripts/run-contention-benchmark.cjs', 'scripts/test-communication-schedules-local.cjs', 'scripts/test-decision-publication-local.cjs',
    'scripts/test-decision-transactions-local.cjs', 'scripts/test-recipient-audiences-local.cjs', 'scripts/test-scheduler-polling-local.cjs'])
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /OWNER TO outclass_production_app/, `${f} re-owns tables after migrating`);
  // The rollback is a script for a person to run, never part of the migration history.
  assert.equal(names.some(n => /rollback/i.test(n)), false);
  const body = sql(target);
  assert.match(body, /^BEGIN;\s*SET LOCAL lock_timeout = '2s';\s*SET LOCAL statement_timeout = '15s';/m);
  assert.match(body, /COMMIT;\s*$/);
  assert.doesNotMatch(body.replace(/--.*$/gm, ''), /\b(INSERT INTO|UPDATE\s+public|DELETE FROM|DROP TABLE|TRUNCATE\s+(TABLE|public))/i);
});
