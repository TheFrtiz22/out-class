// Alumni status migration on PGlite over the full chain: four nullable columns, existing rows
// untouched (current students and members), no default, no browser grant, catalog-only change.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite')

const NAME = '20261112150000_alumni_status'

test('alumni status migration: additive nullable columns, rows unchanged, server-only access kept', { timeout: 240000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;')
    const dir = 'prisma/migrations'
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    assert.ok(names.indexOf(NAME) > names.indexOf('20261112090000_terms_acceptance'), 'ordered after the existing history')
    const sql = fs.readFileSync(path.join(dir, NAME, 'migration.sql'), 'utf8')
    assert.match(sql, /^BEGIN;\nSET LOCAL lock_timeout = '5s';/m)
    assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /\b(DROP|GRANT|REVOKE|POLICY|UPDATE|DELETE|DEFAULT|NOT NULL|INDEX|TRIGGER)\b/i, 'additive only: no backfill, default, index, grant or policy')

    // Apply everything before this migration, seed rows, then apply it.
    for (const n of names.filter(n => n < NAME)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu');
      INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear") VALUES('p1','alice','A','L','al1a','Economics',2025);
      INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('club','club','Club','','','#142d4e','Academic');
      INSERT INTO "ClubMember"(id,"clubId","userId") VALUES('m1','club','alice');`)
    const grantsBefore = (await db.query(`SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE table_name IN ('StudentProfile','ClubMember') ORDER BY 1,2,3`)).rows
    for (const n of names.filter(n => n >= NAME)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))

    const columns = (await db.query(`SELECT table_name, column_name, is_nullable, column_default, data_type FROM information_schema.columns
      WHERE (table_name='StudentProfile' AND column_name IN ('graduatedAt','graduationConfirmedAt','graduationPromptDismissedAt')) OR (table_name='ClubMember' AND column_name='alumniSince') ORDER BY 1,2`)).rows
    assert.deepEqual(columns.map(c => [c.table_name, c.column_name, c.is_nullable, c.column_default, c.data_type]), [
      ['ClubMember', 'alumniSince', 'YES', null, 'timestamp without time zone'],
      ['StudentProfile', 'graduatedAt', 'YES', null, 'timestamp without time zone'],
      ['StudentProfile', 'graduationConfirmedAt', 'YES', null, 'timestamp without time zone'],
      ['StudentProfile', 'graduationPromptDismissedAt', 'YES', null, 'timestamp without time zone'],
    ])
    assert.deepEqual((await db.query(`SELECT "graduatedAt","graduationConfirmedAt","graduationPromptDismissedAt" FROM "StudentProfile"`)).rows, [{ graduatedAt: null, graduationConfirmedAt: null, graduationPromptDismissedAt: null }], 'no backfill: the job decides after deploy')
    assert.deepEqual((await db.query(`SELECT status, "alumniSince" FROM "ClubMember"`)).rows, [{ status: 'ACTIVE', alumniSince: null }])
    assert.deepEqual((await db.query(`SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE table_name IN ('StudentProfile','ClubMember') ORDER BY 1,2,3`)).rows, grantsBefore, 'grants unchanged')
    for (const role of ['anon', 'authenticated']) for (const table of ['"StudentProfile"', '"ClubMember"'])
      assert.equal((await db.query(`SELECT has_table_privilege($1,$2,'SELECT') ok`, [role, table])).rows[0].ok, false, `${role} cannot read ${table}`)
    await db.exec(`UPDATE "StudentProfile" SET "graduatedAt"='2025-08-01 04:00:00' WHERE id='p1'; UPDATE "ClubMember" SET "alumniSince"='2025-08-01 04:00:00' WHERE id='m1'`)
    await db.exec(`DELETE FROM "User" WHERE id='alice'`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "ClubMember"`)).rows[0].n, 0, 'account deletion still cascades')
  } finally { await db.close() }
})
