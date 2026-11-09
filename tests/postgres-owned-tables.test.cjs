// 20261110090000_postgres_owned_tables: the server role owns no table and works through
// explicit grants and policies. Runs on an in-process PGlite database; no hosted service.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite');
const dir = path.resolve('prisma/migrations'), target = '20261110090000_postgres_owned_tables';
const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort();
const sql = n => fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8');
const runtime = 'outclass_production_app';
const explicit = ['VotingBallotRule', 'VotingObservationReference', 'VotingSlideLock', 'VotingHandRaise', 'VotingRuleDefault', 'VotingSlidePreparation'];

async function build(mode) {
  const db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  if (mode !== 'no-server-role') await db.exec(`CREATE ROLE ${runtime} NOLOGIN NOSUPERUSER NOBYPASSRLS;`);
  for (const n of names.filter(n => n < target)) await db.exec(sql(n));
  if (mode === 'production') {
    // Production's starting point: the server role owns every table that has no explicit server-role policy.
    const { rows } = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations'`);
    for (const { tablename } of rows) if (!explicit.includes(tablename)) await db.exec(`ALTER TABLE public."${tablename}" OWNER TO ${runtime}`);
  }
  return db;
}
const asRole = async (db, role, statement) => { await db.exec(`SET ROLE ${role}`); try { return await db.query(statement); } finally { await db.exec('RESET ROLE'); } };
const seed = `INSERT INTO "User"(id,email,role) VALUES ('u','u@virginia.edu','STUDENT');
 INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES ('c','c','C','','','#ffffff','Academic');
 INSERT INTO "ClubMember"(id,"clubId","userId",role) VALUES ('m','c','u','PRESIDENT');
 INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES ('r','c','Review',0);
 INSERT INTO "Application"(id,"studentId","clubId","roundId",status) VALUES ('a','u','c','r','IN_REVIEW');`;

for (const mode of ['production', 'fresh']) test(`server role owns no table and keeps row access: ${mode}`, { timeout: 180000 }, async () => {
  const db = await build(mode);
  try {
    if (mode === 'production') {
      // Why the policies must change: without ownership, a deny-everyone policy blocks the server role.
      const before = await db.query(`SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public' WHERE c.relkind='r' AND pg_get_userbyid(c.relowner)=$1`, [runtime]);
      assert.ok(before.rows[0].n > 50, 'fixture did not reproduce production ownership');
    }
    // Rows written before the change, by the role that could write them then.
    if (mode === 'production') { await db.exec(`SET ROLE ${runtime}`); try { await db.exec(seed); } finally { await db.exec('RESET ROLE'); } } else await db.exec(seed);
    await db.exec(sql(target));
    await db.exec(sql(target)); // safe to repeat
    // Later migrations must keep the model: a new table needs its own server-role grants and policy.
    for (const n of names.filter(n => n > target)) await db.exec(sql(n));
    const unreachable = await db.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public' WHERE c.relkind='r' AND c.relname<>'_prisma_migrations' AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname AND p.permissive='PERMISSIVE' AND p.roles::text[] @> ARRAY[$1])`, [runtime]);
    assert.deepEqual(unreachable.rows, [], 'tables the server role cannot reach (add explicit grants and a policy in the migration that creates them)');

    const owned = await db.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public' WHERE c.relkind='r' AND pg_get_userbyid(c.relowner)=$1`, [runtime]);
    assert.deepEqual(owned.rows, [], 'server role still owns tables');

    const tables = (await db.query(`SELECT c.oid, c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public' WHERE c.relkind='r' AND c.relname<>'_prisma_migrations' ORDER BY 2`)).rows;
    for (const t of tables) {
      assert.equal(t.relrowsecurity, true, `${t.relname}: RLS is off`);
      for (const role of ['anon', 'authenticated']) for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
        assert.equal((await db.query(`SELECT has_table_privilege($1,$2::oid,$3) a`, [role, t.oid, privilege])).rows[0].a, false, `${role} can ${privilege} ${t.relname}`);
      for (const privilege of ['TRUNCATE', 'REFERENCES', 'TRIGGER'])
        assert.equal((await db.query(`SELECT has_table_privilege($1,$2::oid,$3) a`, [runtime, t.oid, privilege])).rows[0].a, false, `server role has ${privilege} on ${t.relname}`);
      const policies = (await db.query(`SELECT policyname, permissive, cmd, roles::text[] roles, qual FROM pg_policies WHERE schemaname='public' AND tablename=$1`, [t.relname])).rows;
      // No policy that applies to every role may deny the server role.
      assert.deepEqual(policies.filter(p => p.permissive === 'RESTRICTIVE' && p.roles.includes('public') && p.qual === 'false'), [], `${t.relname}: deny-everyone policy remains`);
      if (explicit.includes(t.relname)) {
        assert.equal(policies.some(p => p.policyname === 'outclass_runtime_access'), false, `${t.relname}: narrower explicit access was widened`);
        assert.equal((await db.query(`SELECT has_table_privilege($1,$2::oid,'DELETE') a`, [runtime, t.oid])).rows[0].a, false, `${t.relname}: server role gained DELETE`);
      } else {
        assert.deepEqual(policies.filter(p => p.policyname === 'outclass_runtime_access').map(p => [p.permissive, p.cmd, p.roles]), [['PERMISSIVE', 'ALL', [runtime]]], `${t.relname}: server-role policy`);
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
          assert.equal((await db.query(`SELECT has_table_privilege($1,$2::oid,$3) a`, [runtime, t.oid, privilege])).rows[0].a, true, `server role lost ${privilege} on ${t.relname}`);
      }
    }
    // Deny policies are kept for the browser roles they were written for.
    // Every one of those tables denies the browser roles: 36 rescoped policies and 43 new ones.
    const deny = (await db.query(`SELECT policyname='outclass_browser_deny' AS added, count(*)::int n FROM pg_policies WHERE schemaname='public' AND permissive='RESTRICTIVE' AND cmd='ALL' AND qual='false' AND with_check='false' AND roles::text[] @> ARRAY['anon','authenticated'] AND tablename<>'_prisma_migrations' GROUP BY 1 ORDER BY 1`)).rows;
    assert.deepEqual(deny, [{ added: false, n: 36 }, { added: true, n: 43 }]);

    // The server role still reads and writes existing rows, on a table that had a deny policy and one that had none.
    assert.equal((await asRole(db, runtime, `SELECT count(*)::int n FROM "User"`)).rows[0].n, 1);
    assert.equal((await asRole(db, runtime, `SELECT count(*)::int n FROM "Application"`)).rows[0].n, 1);
    assert.equal((await asRole(db, runtime, `UPDATE "Club" SET tagline='t' WHERE id='c' RETURNING id`)).rows.length, 1);
    assert.equal((await asRole(db, runtime, `INSERT INTO "User"(id,email,role) VALUES ('u2','u2@virginia.edu','STUDENT') RETURNING id`)).rows.length, 1);
    assert.equal((await asRole(db, runtime, `DELETE FROM "User" WHERE id='u2' RETURNING id`)).rows.length, 1);
    // ...and can no longer change structure, policies or ownership.
    for (const ddl of [`ALTER TABLE "User" DISABLE ROW LEVEL SECURITY`, `DROP TABLE "AuditLog"`, `TRUNCATE "ClubMember"`, `ALTER TABLE "Club" ADD COLUMN x int`,
      `CREATE POLICY x ON "User" FOR ALL TO anon USING (true)`, `DROP POLICY outclass_runtime_access ON "User"`, `ALTER TABLE "User" OWNER TO ${runtime}`])
      await assert.rejects(asRole(db, runtime, ddl), /must be owner|permission denied/, ddl);
    // An accidental browser grant plus permissive policy is still denied by the kept restrictive policy.
    await db.exec(`GRANT SELECT ON "User" TO authenticated; CREATE POLICY accidental ON "User" FOR SELECT TO authenticated USING (true)`);
    assert.equal((await asRole(db, 'authenticated', `SELECT count(*)::int n FROM "User"`)).rows[0].n, 0);
    // The same holds for a table that had no deny policy before this migration.
    await db.exec(`GRANT SELECT ON "Application" TO anon; CREATE POLICY accidental ON "Application" FOR SELECT TO anon USING (true)`);
    assert.equal((await asRole(db, 'anon', `SELECT count(*)::int n FROM "Application"`)).rows[0].n, 0);
  } finally { await db.close(); }
});

test('without the server role nothing changes', { timeout: 180000 }, async () => {
  const db = await build('no-server-role');
  try {
    const snapshot = async () => (await db.query(`SELECT (SELECT count(*) FROM pg_policies WHERE schemaname='public')::int policies, (SELECT string_agg(DISTINCT pg_get_userbyid(relowner),',') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public' WHERE relkind='r') owners`)).rows[0];
    const before = await snapshot();
    await db.exec(sql(target));
    assert.deepEqual(await snapshot(), before);
  } finally { await db.close(); }
});
