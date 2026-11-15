// Alumni employer migration on PGlite over the full chain: nullable bounded text columns, two
// default-on preferences, existing rows unchanged, no browser-role access, deletion still cascades.
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
    for (const n of names.filter(n => n >= NAME)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))

    const columns = (await db.query(`SELECT column_name, is_nullable, column_default, data_type FROM information_schema.columns
      WHERE table_name='StudentProfile' AND column_name IN ('postGradEmployer','postGradRole','postGradPlacementKey','alumniDirectoryVisible','alumniPlacementShare') ORDER BY 1`)).rows
    assert.deepEqual(columns.map(c => [c.column_name, c.is_nullable, c.column_default, c.data_type]), [
      ['alumniDirectoryVisible', 'NO', 'true', 'boolean'],
      ['alumniPlacementShare', 'NO', 'true', 'boolean'],
      ['postGradEmployer', 'YES', null, 'text'],
      ['postGradPlacementKey', 'YES', null, 'text'],
      ['postGradRole', 'YES', null, 'text'],
    ])
    assert.deepEqual((await db.query(`SELECT "postGradEmployer","postGradRole","postGradPlacementKey","alumniDirectoryVisible","alumniPlacementShare" FROM "StudentProfile"`)).rows,
      [{ postGradEmployer: null, postGradRole: null, postGradPlacementKey: null, alumniDirectoryVisible: true, alumniPlacementShare: true }], 'existing rows: nothing backfilled, choices default on')

    await db.exec(`UPDATE "StudentProfile" SET "postGradEmployer"='${'x'.repeat(100)}', "postGradRole"='Analyst', "postGradPlacementKey"='x' WHERE id='p1'`)
    for (const [column, value] of [['postGradEmployer', 'x'.repeat(101)], ['postGradEmployer', ''], ['postGradRole', 'y'.repeat(101)], ['postGradPlacementKey', '']])
      await assert.rejects(db.exec(`UPDATE "StudentProfile" SET "${column}"='${value}' WHERE id='p1'`), new RegExp(`StudentProfile_${column}_length`), `${column} ${value.length}`)
    await assert.rejects(db.exec(`UPDATE "StudentProfile" SET "alumniDirectoryVisible"=NULL WHERE id='p1'`), /null/i)

    assert.deepEqual((await db.query(`SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name='StudentProfile' ORDER BY 1,2`)).rows, grantsBefore, 'grants unchanged')
    for (const role of ['anon', 'authenticated'])
      assert.equal((await db.query(`SELECT has_table_privilege($1,'"StudentProfile"','SELECT') ok`, [role])).rows[0].ok, false, `${role} cannot read StudentProfile`)
    await db.exec(`DELETE FROM "User" WHERE id='alice'`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "StudentProfile"`)).rows[0].n, 0, 'account deletion removes the new columns with the profile')
  } finally { await db.close() }
})
