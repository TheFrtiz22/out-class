const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261101160000_private_prisma_migration_history/migration.sql'), 'utf8');

test('Prisma ledger denies browser CRUD while preserving owner migration operations and history', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE trusted_migrator;
      CREATE TABLE public._prisma_migrations(id text PRIMARY KEY, migration_name text NOT NULL);
      INSERT INTO public._prisma_migrations VALUES ('old','original');
      GRANT ALL ON public._prisma_migrations TO anon, authenticated;
      GRANT SELECT ON public._prisma_migrations TO PUBLIC;
      GRANT ALL ON public._prisma_migrations TO trusted_migrator;
      ALTER TABLE public._prisma_migrations OWNER TO trusted_migrator;`);
    await db.exec('SET ROLE anon');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public._prisma_migrations')).rows[0].n, 1);
    await db.exec('RESET ROLE');
    await db.exec(sql);
    await db.exec(sql);
    const flags = (await db.query(`SELECT relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid='public._prisma_migrations'::regclass`)).rows[0];
    assert.deepEqual(flags, { relrowsecurity:true, relforcerowsecurity:false, owner:'trusted_migrator' });
    for (const role of ['anon','authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      for (const query of [`SELECT * FROM public._prisma_migrations`, `INSERT INTO public._prisma_migrations VALUES ('forged','forged')`, `UPDATE public._prisma_migrations SET migration_name='forged'`, `DELETE FROM public._prisma_migrations`]) {
        await assert.rejects(db.query(query), /permission denied/);
      }
      await db.exec('RESET ROLE');
    }
    // Existing and future permissive policies/grants cannot reopen browser access.
    await db.exec(`CREATE POLICY accidental_allow ON public._prisma_migrations FOR ALL TO PUBLIC USING (true) WITH CHECK (true); GRANT ALL ON public._prisma_migrations TO anon,authenticated`);
    for (const role of ['anon','authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      assert.equal((await db.query('SELECT * FROM public._prisma_migrations')).rows.length, 0);
      assert.equal((await db.query(`UPDATE public._prisma_migrations SET migration_name='forged' RETURNING id`)).rows.length, 0);
      assert.equal((await db.query('DELETE FROM public._prisma_migrations RETURNING id')).rows.length, 0);
      await assert.rejects(db.query(`INSERT INTO public._prisma_migrations VALUES ('forged','forged')`), /row-level security/);
      await db.exec('RESET ROLE');
    }
    await db.exec(`SET ROLE trusted_migrator; INSERT INTO public._prisma_migrations VALUES ('new','next'); UPDATE public._prisma_migrations SET migration_name='next-finished' WHERE id='new'`);
    assert.deepEqual((await db.query('SELECT * FROM public._prisma_migrations ORDER BY id')).rows, [{id:'new',migration_name:'next-finished'},{id:'old',migration_name:'original'}]);
    await db.exec(`DELETE FROM public._prisma_migrations WHERE id='new'; RESET ROLE`);
  } finally { await db.close(); }
});

test('SQL-only rehearsals without a Prisma ledger do not manufacture migration history', async () => {
  const db = new PGlite();
  try { await db.exec(sql); assert.equal((await db.query(`SELECT to_regclass('public._prisma_migrations') AS ledger`)).rows[0].ledger,null); }
  finally { await db.close(); }
});
