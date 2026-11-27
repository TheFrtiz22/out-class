// Alumni employer migration on PGlite over the full chain: nullable bounded text columns, two
// default-on preferences, a bounded shared-club list (empty by default), existing rows unchanged, no browser-role access, deletion still cascades.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite')

const NAME = '20261115180000_alumni_employer'

test('alumni employer migration: additive, bounded, default-on choices, server-only access kept', { timeout: 240000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;')
    const dir = 'prisma/migrations'
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    assert.ok(names.indexOf(NAME) > names.indexOf('20261112150000_alumni_status'), 'ordered after alumni status')
    const sql = fs.readFileSync(path.join(dir, NAME, 'migration.sql'), 'utf8')
    assert.match(sql, /^BEGIN;\nSET LOCAL lock_timeout = '5s';/m)
    assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /\b(DROP|GRANT|REVOKE|POLICY|UPDATE|DELETE|INDEX|TRIGGER|CREATE TABLE)\b/i, 'additive only')

    for (const n of names.filter(n => n < NAME)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu');
      INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear") VALUES('p1','alice','A','L','al1a','Economics',2026);`)
    const grantsBefore = (await db.query(`SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='StudentProfile' ORDER BY 1,2`)).rows
    for (const n of names.filter(n => n >= NAME && n !== '20261127010000_postgres_owned_tables' /* changes grants and policies on purpose; see tests/postgres-owned-tables.test.cjs */)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))

    const columns = (await db.query(`SELECT column_name, is_nullable, column_default, data_type FROM information_schema.columns
      WHERE table_name='StudentProfile' AND column_name IN ('postGradEmployer','postGradRole','alumniPlacementClubIds','alumniDirectoryVisible','alumniPlacementShare') ORDER BY 1`)).rows
    assert.deepEqual(columns.map(c => [c.column_name, c.is_nullable, c.data_type]), [
      ['alumniDirectoryVisible', 'NO', 'boolean'],
      ['alumniPlacementClubIds', 'NO', 'ARRAY'],
      ['alumniPlacementShare', 'NO', 'boolean'],
      ['postGradEmployer', 'YES', 'text'],
      ['postGradRole', 'YES', 'text'],
    ])
    assert.deepEqual([columns[0], columns[2], columns[3], columns[4]].map(c => c.column_default), ['true', 'true', null, null])
    assert.match(String(columns[1].column_default), /ARRAY\[\]|'\{\}'/, 'shared-club list defaults to empty')
    assert.deepEqual((await db.query(`SELECT "postGradEmployer","postGradRole","alumniPlacementClubIds","alumniDirectoryVisible","alumniPlacementShare" FROM "StudentProfile"`)).rows,
      [{ postGradEmployer: null, postGradRole: null, alumniPlacementClubIds: [], alumniDirectoryVisible: true, alumniPlacementShare: true }], 'existing rows: nothing backfilled, choices default on, nothing shared')

    await db.exec(`UPDATE "StudentProfile" SET "postGradEmployer"='${'x'.repeat(100)}', "postGradRole"='Analyst', "alumniPlacementClubIds"=ARRAY['c1','c2'] WHERE id='p1'`)
    for (const [column, value] of [['postGradEmployer', 'x'.repeat(101)], ['postGradEmployer', ''], ['postGradRole', 'y'.repeat(101)]])
      await assert.rejects(db.exec(`UPDATE "StudentProfile" SET "${column}"='${value}' WHERE id='p1'`), new RegExp(`StudentProfile_${column}_length`), `${column} ${value.length}`)
    await db.exec(`UPDATE "StudentProfile" SET "alumniPlacementClubIds"=array_fill('c'::text, ARRAY[1000]) WHERE id='p1'`)
    await assert.rejects(db.exec(`UPDATE "StudentProfile" SET "alumniPlacementClubIds"=array_fill('c'::text, ARRAY[1001]) WHERE id='p1'`), /StudentProfile_alumniPlacementClubIds_size/)
    for (const column of ['alumniDirectoryVisible', 'alumniPlacementClubIds'])
      await assert.rejects(db.exec(`UPDATE "StudentProfile" SET "${column}"=NULL WHERE id='p1'`), /null/i, column)

    assert.deepEqual((await db.query(`SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='StudentProfile' ORDER BY 1,2`)).rows, grantsBefore, 'grants unchanged')
    for (const role of ['anon', 'authenticated'])
      assert.equal((await db.query(`SELECT has_table_privilege($1,'"StudentProfile"','SELECT') ok`, [role])).rows[0].ok, false, `${role} cannot read StudentProfile`)
    await db.exec(`DELETE FROM "User" WHERE id='alice'`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "StudentProfile"`)).rows[0].n, 0, 'account deletion removes the new columns with the profile')
  } finally { await db.close() }
})
