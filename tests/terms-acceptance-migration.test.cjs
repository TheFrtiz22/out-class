// Terms acceptance migration on PGlite: shape, one row per user and version pair, evidence that
// the runtime role (under SET ROLE) can append but not rewrite or delete, browser roles locked out,
// cascade on account deletion. Rehearsed on a disposable PostgreSQL 16 as well (see the PR notes).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite')

test('terms acceptance migration: versions stored per user, append-only for the runtime role, server-only access', { timeout: 240000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    // Supabase grants browser roles everything on new public tables by default; the migration's REVOKE must win.
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;')
    const dir = 'prisma/migrations'
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    assert.ok(names.indexOf('20261112090000_terms_acceptance') > names.indexOf('20261111190000_resume_area_highlights'), 'forward migration ordered after the existing history')
    for (const n of names) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu'),('bob','b@virginia.edu')`)
    const accept = (id, user, terms, privacy, source = 'SIGNUP') => db.exec(`INSERT INTO "TermsAcceptance"(id,"userId","termsVersion","privacyVersion",source) VALUES('${id}','${user}','${terms}','${privacy}','${source}')`)
    await accept('t1', 'alice', '2026-11-30', '2026-11-30')
    const row = (await db.query(`SELECT "userId","termsVersion","privacyVersion",source,"acceptedAt" FROM "TermsAcceptance" WHERE id='t1'`)).rows[0]
    assert.deepEqual({ ...row, acceptedAt: undefined }, { userId: 'alice', termsVersion: '2026-11-30', privacyVersion: '2026-11-30', source: 'SIGNUP', acceptedAt: undefined })
    assert.ok(row.acceptedAt instanceof Date, 'accepted-at defaults to the insert time')
    await assert.rejects(accept('t2', 'alice', '2026-11-30', '2026-11-30', 'PROMPT'), /duplicate|unique/i, 'one row per user and version pair')
    await db.exec(`INSERT INTO "TermsAcceptance"(id,"userId","termsVersion","privacyVersion",source) VALUES('t2','alice','2026-11-30','2026-11-30','PROMPT') ON CONFLICT DO NOTHING`)
    await accept('t3', 'alice', '2027-02-01', '2026-11-30', 'PROMPT')
    assert.equal((await db.query(`SELECT count(*)::int n FROM "TermsAcceptance" WHERE "userId"='alice'`)).rows[0].n, 2, 'a version bump adds history')
    await assert.rejects(accept('t4', 'bob', '2026-11-30', '2026-11-30', 'ADMIN'), /TermsAcceptance_source/)
    await assert.rejects(accept('t5', 'bob', '', '2026-11-30'), /TermsAcceptance_versions_bounded/)
    await assert.rejects(accept('t6', 'nobody', '2026-11-30', '2026-11-30'), /foreign key/i)

    assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='TermsAcceptance'`)).rows[0].relrowsecurity, true)
    const can = async (role, p) => (await db.query(`SELECT has_table_privilege($1,'"TermsAcceptance"',$2) ok`, [role, p])).rows[0].ok
    for (const role of ['anon', 'authenticated']) for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
      assert.equal(await can(role, p), false, `${role} ${p} despite default grants`)
    await db.exec('CREATE TABLE default_grant_probe(id int)')
    assert.equal((await db.query(`SELECT has_table_privilege('anon','default_grant_probe','SELECT') ok`)).rows[0].ok, true, 'the default grant is in effect for a table that does not revoke it')
    for (const p of ['SELECT', 'INSERT']) assert.equal(await can('outclass_production_app', p), true, `runtime ${p}`)
    for (const p of ['UPDATE', 'DELETE']) assert.equal(await can('outclass_production_app', p), false, `evidence rows are never rewritten or removed by the app (${p})`)
    assert.deepEqual((await db.query(`SELECT polname, polcmd FROM pg_policy WHERE polrelid='"TermsAcceptance"'::regclass ORDER BY 1`)).rows,
      [{ polname: 'terms_acceptance_runtime_insert', polcmd: 'a' }, { polname: 'terms_acceptance_runtime_read', polcmd: 'r' }])
    assert.deepEqual((await db.query(`SELECT indexname FROM pg_indexes WHERE tablename='TermsAcceptance' ORDER BY 1`)).rows.map(r => r.indexname),
      ['TermsAcceptance_pkey', 'TermsAcceptance_userId_termsVersion_privacyVersion_key'], 'the unique index serves lookups; no extra index')

    // The runtime role, under RLS, reads and appends (ON CONFLICT DO NOTHING needs no UPDATE).
    await db.exec(`SET ROLE outclass_production_app`)
    assert.equal((await db.query(`SELECT current_user u`)).rows[0].u, 'outclass_production_app')
    await db.exec(`INSERT INTO "TermsAcceptance"(id,"userId","termsVersion","privacyVersion",source) VALUES('t7','bob','2026-11-30','2026-11-30','CLAIM') ON CONFLICT DO NOTHING`)
    await db.exec(`INSERT INTO "TermsAcceptance"(id,"userId","termsVersion","privacyVersion",source) VALUES('t8','bob','2026-11-30','2026-11-30','PROMPT') ON CONFLICT DO NOTHING`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "TermsAcceptance" WHERE "userId"='bob'`)).rows[0].n, 1)
    await assert.rejects(db.exec(`UPDATE "TermsAcceptance" SET "acceptedAt"=now() WHERE id='t7'`), /permission denied/)
    await assert.rejects(db.exec(`DELETE FROM "TermsAcceptance" WHERE id='t7'`), /permission denied/)
    await db.exec(`RESET ROLE`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "TermsAcceptance"`)).rows[0].n, 3, 'denied writes changed nothing')

    // Account deletion (by the table owner) cascades to the acceptance rows without a runtime DELETE grant.
    await db.exec(`DELETE FROM "User" WHERE id='alice'`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "TermsAcceptance" WHERE "userId"='alice'`)).rows[0].n, 0)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "TermsAcceptance" WHERE "userId"='bob'`)).rows[0].n, 1, 'other users keep theirs')
  } finally { await db.close() }
})
