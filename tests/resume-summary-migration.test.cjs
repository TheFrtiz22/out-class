// Résumé summary cache migration on PGlite: shape and bounds, one row per user, file hash and parser
// version, runtime role reads/appends/deletes but never rewrites, browser roles locked out, cascade on
// account deletion.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite')
const hash = c => c.repeat(64)

test('résumé summary migration: bounded cache rows, server-only access, deleted with the account', { timeout: 240000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;')
    const dir = 'prisma/migrations'
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    assert.ok(names.indexOf('20261113160000_resume_summary') > names.indexOf('20261112140000_student_interest_profile'), 'ordered after the existing history')
    for (const n of names) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu'),('bob','b@virginia.edu')`)
    const put = (id, user, h = hash('a'), version = 1, summary = '{"sections":[],"confidence":0,"parserVersion":1}', confidence = 0.8) =>
      db.query(`INSERT INTO "ResumeSummary"(id,"userId","contentHash","parserVersion",summary,confidence) VALUES($1,$2,$3,$4,$5::jsonb,$6)`, [id, user, h, version, summary, confidence])
    await put('s1', 'alice')
    assert.ok((await db.query(`SELECT "createdAt" FROM "ResumeSummary" WHERE id='s1'`)).rows[0].createdAt instanceof Date)
    await assert.rejects(put('s2', 'alice'), /duplicate|unique/i, 'one row per user, file and parser version')
    await put('s3', 'alice', hash('a'), 2)
    await put('s4', 'bob', hash('a'))
    await assert.rejects(put('s5', 'bob', 'not-a-hash'), /ResumeSummary_contentHash/)
    await assert.rejects(put('s6', 'bob', hash('b'), 0), /ResumeSummary_parserVersion/)
    await assert.rejects(put('s7', 'bob', hash('b'), 1, undefined, 1.5), /ResumeSummary_confidence/)
    await assert.rejects(put('s8', 'bob', hash('b'), 1, JSON.stringify({ x: 'y'.repeat(33000) })), /ResumeSummary_summary_bounded/)
    await assert.rejects(put('s9', 'bob', hash('b'), 1, '[]'), /ResumeSummary_summary_bounded/)
    await assert.rejects(put('s10', 'nobody', hash('b')), /foreign key/i)

    assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='ResumeSummary'`)).rows[0].relrowsecurity, true)
    const can = async (role, p) => (await db.query(`SELECT has_table_privilege($1,'"ResumeSummary"',$2) ok`, [role, p])).rows[0].ok
    for (const role of ['anon', 'authenticated']) for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
      assert.equal(await can(role, p), false, `${role} ${p} despite default grants`)
    for (const p of ['SELECT', 'INSERT', 'DELETE']) assert.equal(await can('outclass_production_app', p), true, `runtime ${p}`)
    assert.equal(await can('outclass_production_app', 'UPDATE'), false, 'cached summaries are never rewritten')
    assert.deepEqual((await db.query(`SELECT polname, polcmd FROM pg_policy WHERE polrelid='"ResumeSummary"'::regclass ORDER BY 1`)).rows,
      [{ polname: 'resume_summary_runtime_delete', polcmd: 'd' }, { polname: 'resume_summary_runtime_insert', polcmd: 'a' }, { polname: 'resume_summary_runtime_read', polcmd: 'r' }])

    await db.exec(`SET ROLE outclass_production_app`)
    await db.exec(`INSERT INTO "ResumeSummary"(id,"userId","contentHash","parserVersion",summary,confidence) VALUES('r1','bob','${hash('c')}',1,'{}',0.5) ON CONFLICT DO NOTHING`)
    await db.exec(`INSERT INTO "ResumeSummary"(id,"userId","contentHash","parserVersion",summary,confidence) VALUES('r2','bob','${hash('c')}',1,'{}',0.5) ON CONFLICT DO NOTHING`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "ResumeSummary" WHERE "contentHash"='${hash('c')}'`)).rows[0].n, 1)
    await assert.rejects(db.exec(`UPDATE "ResumeSummary" SET confidence=1 WHERE id='r1'`), /permission denied/)
    await db.exec(`DELETE FROM "ResumeSummary" WHERE "userId"='bob' AND "contentHash"='${hash('c')}'`)
    await db.exec(`RESET ROLE`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "ResumeSummary" WHERE "userId"='bob'`)).rows[0].n, 1)

    await db.exec(`DELETE FROM "User" WHERE id='alice'`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "ResumeSummary" WHERE "userId"='alice'`)).rows[0].n, 0)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "ResumeSummary" WHERE "userId"='bob'`)).rows[0].n, 1, 'other users keep theirs')
  } finally { await db.close() }
})
