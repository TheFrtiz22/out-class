const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const { catalogQuery, runtimeIssues, missingColumns, releaseTarget } = require('../scripts/check-release-database.cjs')
const { spawnSync } = require('node:child_process')

test('production build gate uses the same runtime connection as the app and fails closed on missing configuration', () => {
  const args = ['--vercel-production-build']
  const env = { VERCEL: '1', VERCEL_ENV: 'production', POSTGRES_PRISMA_URL: 'runtime', DATABASE_URL: 'operator', OUTCLASS_DATABASE_CHECK_URL: 'manual' }
  assert.equal(releaseTarget({ ...env, OUTCLASS_RUNTIME_DATABASE_URL: 'dedicated-web' }, args).datasourceUrl, 'dedicated-web')
  assert.equal(releaseTarget(env, args).datasourceUrl, 'runtime')
  assert.equal(releaseTarget({ ...env, POSTGRES_PRISMA_URL: '' }, args).datasourceUrl, 'operator')
  assert.equal(releaseTarget(env, []).datasourceUrl, 'manual')
  assert.equal(releaseTarget(env, ['--runtime-env']).datasourceUrl, 'runtime')
  for (const target of ['preview', 'development', undefined]) assert.equal(releaseTarget({ ...env, VERCEL_ENV: target }, args).skip, true)
  const script = path.resolve(__dirname, '../scripts/check-release-database.cjs')
  const clean = { ...process.env, VERCEL: '1', VERCEL_ENV: 'production', OUTCLASS_RUNTIME_DATABASE_URL: '', POSTGRES_PRISMA_URL: '', DATABASE_URL: '', OUTCLASS_DATABASE_CHECK_URL: '' }
  const blocked = spawnSync(process.execPath, [script, ...args], { env: clean, encoding: 'utf8' })
  assert.equal(blocked.status, 1)
  assert.match(blocked.stderr, /runtime database connection is missing/)
  const skipped = spawnSync(process.execPath, [script, ...args], { env: { ...clean, VERCEL_ENV: 'preview', DATABASE_URL: 'must-not-connect' }, encoding: 'utf8' })
  assert.equal(skipped.status, 0)
  assert.ok(!skipped.stdout.includes('must-not-connect') && !skipped.stderr.includes('must-not-connect'))
})

test('release gate requires the reviewed bounded identity, session access and secret denial together', () => {
  const approved = { role: 'outclass_web_runtime', bounded: true, session_grants: true, secrets_denied: true, session_rls: true, invoker_view: true, session_read_policy: true, session_lock_policy: true, session_write_guard: true, storage_scope: true }
  assert.deepEqual(runtimeIssues(approved), [])
  for (const key of Object.keys(approved)) assert.ok(runtimeIssues({ ...approved, [key]: key === 'role' ? 'postgres' : false }).length)
  assert.ok(runtimeIssues(null).length)
})

test('release check rejects the production schema that breaks authenticated account loading; approved additive SQL preserves existing data', async () => {
  const db = new PGlite()
  const dir = path.resolve(__dirname, '../prisma/migrations')
  const pending = new Set(['20261010190001_reconciled_decision_letters', '20261011180000_submitted_interview_questions', '20261011194930_decision_letter_runtime_access'])
  const names = fs.readdirSync(dir).filter(name => fs.existsSync(path.join(dir, name, 'migration.sql'))).sort()
  const apply = name => db.exec(fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8'))
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated')
    for (const name of names.filter(name => !pending.has(name))) await apply(name)
    await db.exec(`INSERT INTO "User"(id,email) VALUES('release-student','release-fixture@virginia.edu');
      INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('release-club','release-club','Release Fixture','','','#142d45','Other');
      INSERT INTO "PipelineRound"(id,"clubId",name,"order") VALUES('release-round','release-club','Review',0);
      INSERT INTO "Application"(id,"studentId","clubId","roundId",status,"submittedAt") VALUES('release-app','release-student','release-club','release-round','IN_REVIEW',NOW())`)
    const before = (await db.query('SELECT id,email FROM "User" ORDER BY id')).rows
    const application = (await db.query('SELECT id,"studentId",status FROM "Application" ORDER BY id')).rows
    const missing = missingColumns((await db.query(catalogQuery)).rows)
    assert.ok(missing.includes('Application.decisionVersion'))
    assert.ok(missing.includes('Club.decisionLetterTemplates'))
    assert.ok(missing.includes('InterviewRecord.submittedQuestions'))
    assert.ok(missing.some(column => column.startsWith('DecisionLetter.')))
    await assert.rejects(db.query('SELECT "decisionVersion" FROM "Application"'), /does not exist/)
    for (const name of names.filter(name => pending.has(name))) await apply(name)
    assert.deepEqual(missingColumns((await db.query(catalogQuery)).rows), [])
    assert.deepEqual((await db.query('SELECT id,email FROM "User" ORDER BY id')).rows, before)
    assert.deepEqual((await db.query('SELECT id,"studentId",status FROM "Application" ORDER BY id')).rows, application)
    assert.equal((await db.query('SELECT "decisionVersion" FROM "Application"')).rows[0].decisionVersion, 0)
    assert.equal((await db.query('SELECT count(*)::int AS count FROM "DecisionLetter"')).rows[0].count, 0)
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query(`SELECT has_table_privilege('${role}', '"DecisionLetter"', 'SELECT,INSERT,UPDATE,DELETE') AS allowed`)).rows[0].allowed, false)
    }
  } finally { await db.close() }
})
