// The personal check-in pass (door mode) was removed from the app and the mobile API on 2026-11-19.
// The table stays (additive, empty, deleted with the account); these tests keep its shape and access rules.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')

const root = path.join(__dirname, '..')
function load(file) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(require, mod, mod.exports)
  return mod.exports
}
const pass = load('lib/check-in-pass.ts')
const token = 'ab'.repeat(32)

test('a pass payload is a version tag and a 64-hex token; anything else is not a pass', () => {
  assert.equal(pass.checkInPassPayload(token), `OCP1.${token}`)
  assert.equal(pass.parseCheckInPass(`OCP1.${token}`), token)
  for (const bad of [null, 42, '', token, `OCP1.${token}0`, `OCP1.${token.slice(1)}`, `OCP2.${token}`, `ocp1.${token}`, `OCP1.${'AB'.repeat(32)}`, `https://out-class.net/q/abc`, ` OCP1.${token}`])
    assert.equal(pass.parseCheckInPass(bad), null, String(bad))
  assert.ok(pass.CHECK_IN_PASS_LIFETIME_MS <= 60_000, 'a pass lives for seconds')
  assert.ok(pass.CHECK_IN_PASS_REFRESH_SECONDS * 1000 < pass.CHECK_IN_PASS_LIFETIME_MS, 'the app refreshes before the pass on screen expires')
})

test('check-in pass migration: hash only, short-lived by constraint, server-only access', { timeout: 240000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE outclass_production_app;')
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;')
    const dir = path.join(root, 'prisma/migrations')
    for (const n of fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'migration.sql'))).sort()) await db.exec(fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'))
    await db.exec(`INSERT INTO "User"(id,email) VALUES('alice','a@virginia.edu')`)
    const insert = (id, hash, expires) => db.exec(`INSERT INTO "MeetingCheckInPass"(id,"userId","tokenHash","expiresAt") VALUES('${id}','alice','${hash}',${expires})`)
    await insert('p1', 'a'.repeat(64), `now() + interval '45 seconds'`)
    await assert.rejects(insert('p2', 'a'.repeat(64), `now() + interval '45 seconds'`), /duplicate|unique/i)
    await assert.rejects(insert('p3', token.toUpperCase(), `now() + interval '45 seconds'`), /tokenHash_sha256/, 'only a lowercase SHA-256 hex digest is stored')
    await assert.rejects(insert('p4', 'b'.repeat(64), `now() + interval '1 day'`), /short_lived/)
    await db.exec(`DELETE FROM "User" WHERE id='alice'`)
    assert.equal((await db.query(`SELECT count(*)::int n FROM "MeetingCheckInPass"`)).rows[0].n, 0, 'passes go with the account')
    assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='MeetingCheckInPass'`)).rows[0].relrowsecurity, true)
    for (const role of ['anon', 'authenticated']) for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
      assert.equal((await db.query(`SELECT has_table_privilege($1,'"MeetingCheckInPass"',$2) ok`, [role, p])).rows[0].ok, false, `${role} ${p}`)
    for (const p of ['SELECT', 'INSERT', 'DELETE'])
      assert.equal((await db.query(`SELECT has_table_privilege('outclass_production_app','"MeetingCheckInPass"',$1) ok`, [p])).rows[0].ok, true, `runtime ${p}`)
    assert.equal((await db.query(`SELECT has_table_privilege('outclass_production_app','"MeetingCheckInPass"','UPDATE') ok`)).rows[0].ok, false, 'a pass is never edited')
  } finally { await db.close() }
})
