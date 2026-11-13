// Applicant phone migration on PGlite: the whole history applies, the column is nullable and
// additive, the stored format is constrained, and browser roles gain nothing.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite')

test('student profile phone migration: nullable, E.164 only, no browser-role access', { timeout: 240000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;')
    const dir = 'prisma/migrations', target = '20261112200000_student_profile_phone'
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    assert.ok(names.indexOf(target) > names.indexOf('20261112090000_terms_acceptance'), 'ordered after the history that preceded it')
    for (const n of names.slice(0, names.indexOf(target))) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu'),('bob','b@virginia.edu')`)
    const profile = (id, user, extra = '', values = '') => db.exec(`INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear"${extra}) VALUES('${id}','${user}','A','B','${user}','Math',2028${values})`)
    await profile('p-alice', 'alice')
    const privileges = async () => (await db.query(`SELECT has_table_privilege('anon','"StudentProfile"','SELECT') AS anon, has_table_privilege('authenticated','"StudentProfile"','SELECT') AS auth, has_column_privilege('authenticated','"StudentProfile"','id','SELECT') AS col`)).rows[0]
    const before = await privileges()
    await db.exec(fs.readFileSync(path.join(dir, target, 'migration.sql'), 'utf8'))
    // Existing rows keep NULL; nothing is backfilled.
    assert.equal((await db.query(`SELECT phone FROM "StudentProfile" WHERE id='p-alice'`)).rows[0].phone, null)
    const column = (await db.query(`SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='StudentProfile' AND column_name='phone'`)).rows[0]
    assert.deepEqual(column, { data_type: 'text', is_nullable: 'YES', column_default: null })
    for (const good of ['+14345550123', '+442079460958', '+8613800138000']) await db.exec(`UPDATE "StudentProfile" SET phone='${good}' WHERE id='p-alice'`)
    for (const bad of ['', '4345550123', '(434) 555-0123', '+0434555012', '+1434555012x', '+123', '+1234567890123456', ' +14345550123'])
      await assert.rejects(db.exec(`UPDATE "StudentProfile" SET phone='${bad}' WHERE id='p-alice'`), /StudentProfile_phone_e164/, JSON.stringify(bad))
    await profile('p-bob', 'bob', ',phone', `,'+14345550199'`)
    await db.exec(`UPDATE "StudentProfile" SET phone=NULL WHERE id='p-bob'`)
    // The migration changes no privilege: whatever browser roles could read before, they can read after, and no more.
    const after = await privileges()
    assert.deepEqual(after, before)
    assert.equal((await db.query(`SELECT has_column_privilege('anon','"StudentProfile"','phone','SELECT') AS anon, has_column_privilege('authenticated','"StudentProfile"','phone','SELECT') AS auth`)).rows[0].anon, before.anon)
    assert.equal(before.anon, false, 'anon cannot read StudentProfile')
    assert.equal(before.auth, false, 'authenticated cannot read StudentProfile directly')
    // Later migrations (none today) still apply on top.
    for (const n of names.slice(names.indexOf(target) + 1)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
  } finally { await db.close() }
})
