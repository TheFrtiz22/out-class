// Foreign-key covering indexes on PGlite over the full migration chain: index-only and additive,
// every public foreign key ends up with an index on its columns, each new index matches an
// @@index entry in schema.prisma (Prisma default name and column order), re-running is a no-op,
// and grants and existing rows are unchanged.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite')

const NAME = '20261116210000_fk_covering_indexes'
const dir = 'prisma/migrations'
const sql = fs.readFileSync(path.join(dir, NAME, 'migration.sql'), 'utf8')
const statements = [...sql.matchAll(/^CREATE INDEX IF NOT EXISTS "([^"]+)" ON "([^"]+)"\(([^)]+)\);$/gm)]
  .map(([, name, table, cols]) => ({ name, table, cols: cols.split(',').map(c => c.trim().replace(/^"|"$/g, '')) }))

test('fk covering indexes: index-only statements that mirror schema.prisma', () => {
  assert.match(sql, /^BEGIN;\nSET LOCAL lock_timeout = '5s';/m)
  assert.ok(sql.trimEnd().endsWith('COMMIT;'))
  const body = sql.replace(/^--.*$/gm, '').replace(/^(BEGIN|COMMIT);$/gm, '').replace(/^SET LOCAL lock_timeout = '5s';$/m, '').trim()
  assert.equal(body.split('\n').filter(Boolean).length, statements.length, 'only CREATE INDEX IF NOT EXISTS statements')
  assert.doesNotMatch(body, /\b(DROP|GRANT|REVOKE|POLICY|TRIGGER|FUNCTION|ALTER|UNIQUE|CONCURRENTLY|UPDATE|DELETE|INSERT)\b/i)
  assert.equal(statements.length, 68)
  assert.equal(new Set(statements.map(s => s.name)).size, statements.length, 'no duplicate names')

  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
  for (const { name, table, cols } of statements) {
    assert.equal(name, `${table}_${cols.join('_')}_idx`, 'Prisma default index name')
    assert.ok(name.length <= 63, `${name} fits the identifier limit untruncated`)
    const block = schema.match(new RegExp(`model ${table} \\{([\\s\\S]*?)\\n\\}`))
    assert.ok(block, `model ${table}`)
    assert.ok(!/@@map\(/.test(block[1]), `${table} is not renamed`)
    assert.equal((block[1] + '\n').split(`\n  @@index([${cols.join(', ')}])\n`).length - 1, 1, `schema has @@index([${cols.join(', ')}]) on ${table}`)
  }
})

test('fk covering indexes: every foreign key covered, idempotent, rows and grants unchanged', { timeout: 300000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;')
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    assert.ok(names.indexOf(NAME) > names.indexOf('20261115180000_alumni_employer'), 'ordered after alumni employer')
    for (const n of names.filter(n => n < NAME)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))

    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu');
      INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','Club','','','#ffffff','Academic');`)
    const grants = `SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' ORDER BY 1,2,3`
    const grantsBefore = (await db.query(grants)).rows
    const uncovered = `SELECT c.conrelid::regclass::text AS tbl, c.conname FROM pg_constraint c JOIN pg_namespace ns ON ns.oid=c.connamespace
      WHERE c.contype='f' AND ns.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indpred IS NULL
        AND (i.indkey::int2[])[0:array_length(c.conkey,1)-1] @> c.conkey AND (i.indkey::int2[])[0:array_length(c.conkey,1)-1] <@ c.conkey) ORDER BY 1,2`
    assert.equal((await db.query(uncovered)).rows.length, statements.length, 'each new index covers a previously uncovered key')

    for (const n of names.filter(n => n >= NAME && n !== '20261127010000_postgres_owned_tables' /* changes grants and policies on purpose; see tests/postgres-owned-tables.test.cjs */)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    assert.deepEqual((await db.query(uncovered)).rows, [], 'every public foreign key has a covering index')
    for (const { name, table, cols } of statements) {
      const { rows } = await db.query(`SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname=$1`, [name])
      assert.equal(rows.length, 1, name)
      assert.equal(rows[0].indexdef, `CREATE INDEX "${name}" ON public."${table}" USING btree (${cols.map(c => `"${c}"`).join(', ')})`)
    }

    await db.exec(sql)
    assert.equal((await db.query(`SELECT count(*)::int n FROM pg_indexes WHERE schemaname='public' AND indexname = ANY($1)`, [statements.map(s => s.name)])).rows[0].n, statements.length, 're-run is a no-op')
    // Later migrations may add tables (with their own grants); every table that existed before keeps its grants.
    const tablesBefore = new Set(grantsBefore.map(row => row.table_name))
    assert.deepEqual((await db.query(grants)).rows.filter(row => tablesBefore.has(row.table_name)), grantsBefore, 'grants unchanged')
    assert.equal((await db.query(`SELECT count(*)::int n FROM "Club" WHERE id='club'`)).rows[0].n, 1, 'existing rows kept')
    await db.exec(`DELETE FROM "User" WHERE id='alice'`)
  } finally { await db.close() }
})
