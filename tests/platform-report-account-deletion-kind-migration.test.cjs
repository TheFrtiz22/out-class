// Account deletion requests write PlatformReport kind ACCOUNT_DELETION; the foundation kind check
// refused it. This migration widens that one check and changes nothing else.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { PGlite } = require('@electric-sql/pglite')
const NAME = '20261113110000_platform_report_account_deletion_kind'

test('platform report kind check accepts account deletion requests', { timeout: 240000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    const dir = 'prisma/migrations'
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()
    const at = names.indexOf(NAME)
    assert.ok(at > 0, 'migration present')
    for (const n of names.slice(0, at)) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu')`)
    const insert = (id, kind) => db.query(`INSERT INTO "PlatformReport"(id,kind,"targetId","reporterId",summary,"updatedAt") VALUES($1,$2,'t','alice','A report filed for this test',now())`, [id, kind])
    await insert('old-support', 'SUPPORT')
    await assert.rejects(insert('before', 'ACCOUNT_DELETION'), /check constraint/, 'before: deletion requests are refused')
    await db.exec(fs.readFileSync(path.join(dir, NAME, 'migration.sql'), 'utf8'))
    await insert('deletion', 'ACCOUNT_DELETION')
    for (const kind of ['USER', 'CLUB', 'EVENT', 'CONTENT', 'SUPPORT']) await insert(`k-${kind}`, kind)
    await assert.rejects(insert('bad', 'OTHER'), /PlatformReport_kind_check/, 'unknown kinds still refused')
    assert.equal((await db.query(`SELECT count(*)::int n FROM "PlatformReport" WHERE id='old-support'`)).rows[0].n, 1, 'existing rows kept')
    const checks = (await db.query(`SELECT count(*)::int n FROM pg_constraint WHERE conrelid='"PlatformReport"'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%SUPPORT%'`)).rows[0].n
    assert.equal(checks, 1, 'exactly one kind check')
  } finally { await db.close() }
})
