// Issue/feedback report migration on PGlite: the widened kind check (ISSUE and FEEDBACK on top of
// the ACCOUNT_DELETION fix in 20261113110000), the bounded context column reserved for ISSUE and
// FEEDBACK, existing rows untouched, and the server-only access posture unchanged.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite')
const NAME = '20261113120000_platform_report_feedback'

test('platform report feedback migration: new kinds, bounded context, browser roles still locked out', { timeout: 240000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    const dir = 'prisma/migrations'
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    const PREVIOUS = '20261113110000_platform_report_account_deletion_kind'
    assert.ok(names.includes(PREVIOUS) && names.indexOf(NAME) > names.indexOf(PREVIOUS), 'sorts after 20261113110000_platform_report_account_deletion_kind')
    for (const n of names.filter(n => n < NAME)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu')`)
    const insert = (id, kind, context = null) => db.query(`INSERT INTO "PlatformReport"(id,kind,"targetId","reporterId",summary,"updatedAt",context) VALUES($1,$2,'/home','alice','Something broke on this page',now(),$3)`, [id, kind, context])
    const insertOld = (id, kind) => db.query(`INSERT INTO "PlatformReport"(id,kind,"targetId","reporterId",summary,"updatedAt") VALUES($1,$2,'t','alice','A report filed before the change',now())`, [id, kind])
    await insertOld('old-support', 'SUPPORT')
    await insertOld('old-content', 'CONTENT')
    await insertOld('pre-deletion', 'ACCOUNT_DELETION')
    for (const kind of ['ISSUE', 'FEEDBACK']) await assert.rejects(insertOld(`pre-${kind}`, kind), /check constraint/, 'before: ISSUE/FEEDBACK refused')

    for (const n of names.filter(n => n >= NAME)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    const kept = (await db.query(`SELECT id, kind, context FROM "PlatformReport" ORDER BY id`)).rows
    assert.deepEqual(kept, [{ id: 'old-content', kind: 'CONTENT', context: null }, { id: 'old-support', kind: 'SUPPORT', context: null }, { id: 'pre-deletion', kind: 'ACCOUNT_DELETION', context: null }], 'existing rows unchanged')

    const context = JSON.stringify({ path: '/home?tab=1', userAgent: 'Chrome 131 on macOS (desktop)', viewport: '1440×900', appVersion: 'abc123', screenshotPath: 'reports/alice/x.jpg' })
    await insert('issue', 'ISSUE', context)
    await insert('feedback', 'FEEDBACK')
    await insertOld('deletion', 'ACCOUNT_DELETION')
    for (const kind of ['USER', 'CLUB', 'EVENT', 'CONTENT', 'SUPPORT']) await insertOld(`k-${kind}`, kind)
    await assert.rejects(insert('bad-kind', 'BUG'), /PlatformReport_kind_check/)
    await assert.rejects(insert('ctx-on-support', 'SUPPORT', context), /PlatformReport_context_check/, 'only issues and feedback carry context')
    await assert.rejects(insert('ctx-array', 'ISSUE', '[]'), /PlatformReport_context_check/)
    await assert.rejects(insert('ctx-huge', 'ISSUE', JSON.stringify({ path: 'x'.repeat(5000) })), /PlatformReport_context_check/)
    await assert.rejects(db.query(`INSERT INTO "PlatformReport"(id,kind,"targetId","reporterId",summary,"updatedAt") VALUES('short','ISSUE','/','alice','short',now())`), /check constraint/, 'summary bounds still apply')
    assert.equal((await db.query(`SELECT context->>'path' p FROM "PlatformReport" WHERE id='issue'`)).rows[0].p, '/home?tab=1')
    // Account deletion's scrub: the screenshot reference goes, the rest of the context stays.
    await db.exec(`UPDATE "PlatformReport" SET "context" = "context" - 'screenshotPath' WHERE "reporterId" = 'alice' AND "context" ? 'screenshotPath'`)
    assert.deepEqual(Object.keys((await db.query(`SELECT context FROM "PlatformReport" WHERE id='issue'`)).rows[0].context).sort(), ['appVersion', 'path', 'userAgent', 'viewport'])

    const checks = (await db.query(`SELECT conname FROM pg_constraint WHERE conrelid='"PlatformReport"'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%SUPPORT%'`)).rows
    assert.deepEqual(checks.map(r => r.conname), ['PlatformReport_kind_check'], 'exactly one kind check')
    assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='PlatformReport'`)).rows[0].relrowsecurity, true)
    for (const role of ['anon', 'authenticated']) for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
      assert.equal((await db.query(`SELECT has_table_privilege($1,'"PlatformReport"',$2) ok`, [role, p])).rows[0].ok, false, `${role} ${p}`)
    assert.deepEqual((await db.query(`SELECT polname FROM pg_policy WHERE polrelid='"PlatformReport"'::regclass`)).rows.map(r => r.polname), ['outclass_admin_server_only'], 'no policy added or removed')
  } finally { await db.close() }
})
