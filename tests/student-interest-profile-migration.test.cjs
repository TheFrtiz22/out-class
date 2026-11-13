// Club-interest survey migration on PGlite: one row per student, bounded answers, server-only access
// (browser roles locked out despite Supabase's default grants), runtime role under RLS, cascade on
// account deletion.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite')

test('student interest profile migration: private, bounded, one row per user, cascades with the account', { timeout: 240000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;')
    const dir = 'prisma/migrations'
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    assert.ok(names.indexOf('20261112140000_student_interest_profile') > names.indexOf('20261112090000_terms_acceptance'), 'ordered after the existing history')
    for (const n of names) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu'),('bob','b@virginia.edu')`)
    const put = (user, interests = "ARRAY[]::text[]", goals = "ARRAY[]::text[]", hours = 'NULL', sel = 'NULL') =>
      db.exec(`INSERT INTO "StudentInterestProfile"("userId",interests,goals,"weeklyHours",selectivity) VALUES('${user}',${interests},${goals},${hours},${sel})`)
    await put('alice', `ARRAY['consulting','tech']`, `ARRAY['career']`, `'3-5'`, `'either'`)
    const row = (await db.query(`SELECT * FROM "StudentInterestProfile" WHERE "userId"='alice'`)).rows[0]
    assert.deepEqual(row.interests, ['consulting', 'tech']); assert.equal(row.revision, 0); assert.equal(row.completedAt, null); assert.equal(row.dismissedAt, null)
    await assert.rejects(put('alice'), /duplicate|unique/i, 'one row per student')
    await assert.rejects(put('bob', `ARRAY['a','b','c','d','e','f','g']`), /interests_bounded/, 'at most six interests')
    await assert.rejects(put('bob', `ARRAY['Consulting; DROP']`), /interests_bounded/, 'ids only')
    await assert.rejects(put('bob', `ARRAY['tech',NULL]`), /interests_bounded/, 'no NULL entries')
    await assert.rejects(put('bob', `ARRAY['aa,bb']`), /interests_bounded/, 'no commas hidden inside one entry')
    await assert.rejects(put('bob', `ARRAY['tech','']`), /interests_bounded/, 'no empty entries')
    await assert.rejects(put('bob', undefined, `ARRAY['career,service']`), /goals_bounded/, 'goals: no commas inside one entry')
    await assert.rejects(put('bob', undefined, `ARRAY['x','y','z','u','v','w','q']`), /goals_bounded/)
    await assert.rejects(put('bob', undefined, undefined, `'10+'`), /weeklyHours/)
    await assert.rejects(put('bob', undefined, undefined, 'NULL', `'maybe'`), /selectivity/)
    await assert.rejects(put('nobody'), /foreign key/i)
    await put('bob')

    assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='StudentInterestProfile'`)).rows[0].relrowsecurity, true)
    const can = async (role, p) => (await db.query(`SELECT has_table_privilege($1,'"StudentInterestProfile"',$2) ok`, [role, p])).rows[0].ok
    for (const role of ['anon', 'authenticated']) for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
      assert.equal(await can(role, p), false, `${role} ${p} despite default grants`)
    for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) assert.equal(await can('outclass_production_app', p), true, `runtime ${p}`)
    assert.deepEqual((await db.query(`SELECT polname, polcmd FROM pg_policy WHERE polrelid='"StudentInterestProfile"'::regclass ORDER BY 1`)).rows,
      [{ polname: 'student_interest_runtime_delete', polcmd: 'd' }, { polname: 'student_interest_runtime_insert', polcmd: 'a' }, { polname: 'student_interest_runtime_read', polcmd: 'r' }, { polname: 'student_interest_runtime_update', polcmd: 'w' }])

    await db.exec('SET ROLE outclass_production_app')
    await db.exec(`UPDATE "StudentInterestProfile" SET goals=ARRAY['service'], revision=revision+1 WHERE "userId"='bob'`)
    assert.equal((await db.query(`SELECT revision FROM "StudentInterestProfile" WHERE "userId"='bob'`)).rows[0].revision, 1)
    await db.exec('RESET ROLE')
    await db.exec('SET ROLE authenticated')
    await assert.rejects(db.query(`SELECT * FROM "StudentInterestProfile"`), /permission denied/)
    await db.exec('RESET ROLE')

    await db.exec(`DELETE FROM "User" WHERE id='alice'`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "StudentInterestProfile" WHERE "userId"='alice'`)).rows[0].n, 0, 'deleted with the account')
    assert.equal((await db.query(`SELECT count(*)::int n FROM "StudentInterestProfile"`)).rows[0].n, 1, 'other students keep theirs')
  } finally { await db.close() }
})
