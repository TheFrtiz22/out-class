const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file, mocks = {}) {
  mocks = { 'next/cache': { unstable_cache: fn => fn, revalidateTag() {}, revalidatePath() {} }, 'server-only': {}, ...mocks }
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const lib = load('lib/club-features.ts')
// One shared instance so `instanceof AdminAccessError` holds across separately loaded modules.
const adminFailure = load('lib/admin-failure.ts')
const clubId = '00000000-0000-4000-8000-00000000000a'
const reason = 'Pilot with one club this week.'

test('registry: Phase 0 keys, all off by default', () => {
  assert.deepEqual([...lib.clubFeatureKeys], ['csvExport', 'cloneCycle', 'previouslyApplied', 'pushNotifications'])
  assert.deepEqual(lib.normalizeClubFeatures(null), { csvExport: false, cloneCycle: false, previouslyApplied: false, pushNotifications: false })
  for (const key of lib.clubFeatureKeys) assert.ok(lib.clubFeatureLabels[key], key)
})

test('isFeatureEnabled: only a literal true on a known key turns a feature on', () => {
  for (const value of [null, undefined, 'csvExport', 7, true, [], ['csvExport'], {}, { csvExport: 'true' }, { csvExport: 1 }, { csvExport: null }, { csvExport: { on: true } }])
    assert.equal(lib.isFeatureEnabled(value, 'csvExport'), false, JSON.stringify(value))
  assert.equal(lib.isFeatureEnabled({ csvExport: true }, 'csvExport'), true)
  assert.equal(lib.isFeatureEnabled({ csvExport: true }, 'cloneCycle'), false)
  assert.equal(lib.isFeatureEnabled({ futureFeature: true }, 'futureFeature'), false, 'unknown key is off')
  assert.equal(lib.isFeatureEnabled(Object.create({ csvExport: true }), 'csvExport'), false, 'inherited values are ignored')
  assert.equal(lib.isFeatureEnabled(JSON.parse('{"__proto__":{"csvExport":true}}'), 'csvExport'), false)
  assert.deepEqual(lib.normalizeClubFeatures({ csvExport: true, futureFeature: true, cloneCycle: 'yes' }), { csvExport: true, cloneCycle: false, previouslyApplied: false, pushNotifications: false })
})

test('clubHasFeature reads the stored switch on the server; missing clubs and malformed rows read as off', async () => {
  const { clubHasFeature } = load('utils/club-features.ts')
  const rows = { a: { features: { csvExport: true } }, b: { features: '{"csvExport":true}' }, c: { features: null } }
  let query
  const db = { club: { findUnique: async q => { query = q; return rows[q.where.id] ?? null } } }
  assert.equal(await clubHasFeature(db, 'a', 'csvExport'), true)
  assert.deepEqual(query.select, { features: true }, 'narrow projection')
  assert.equal(await clubHasFeature(db, 'a', 'cloneCycle'), false)
  assert.equal(await clubHasFeature(db, 'b', 'csvExport'), false, 'a JSON string is not an object')
  assert.equal(await clubHasFeature(db, 'c', 'csvExport'), false)
  assert.equal(await clubHasFeature(db, 'missing', 'csvExport'), false)
  assert.equal(await clubHasFeature(db, '', 'csvExport'), false)
  assert.match(fs.readFileSync('utils/club-features.ts', 'utf8'), /^import "server-only";/)
})

function setup({ admin = async () => ({ id: 'admin' }) } = {}) {
  let stored = { id: clubId, features: null }, audits = [], reauth = 0, updates = 0
  const tx = {
    $queryRaw: async () => [],
    club: { findUnique: async ({ where }) => where.id === clubId ? stored : null, update: async ({ data }) => { updates++; stored = { ...stored, ...data }; return stored } },
    auditLog: { create: async ({ data }) => audits.push(data) },
  }
  const db = { $transaction: fn => fn(tx), club: { findUniqueOrThrow: async () => stored } }
  const mocks = {
    // Stubbed so the suite runs without a generated Prisma client (engine download blocked in CI sandboxes).
    '@prisma/client': { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    '@/lib/admin-failure': adminFailure,
    '@/utils/prisma': { prisma: db },
    '@/utils/platform-admin': { requirePlatformAdmin: admin },
    '@/utils/admin-transaction': { authorizeAdminTransaction: async (_tx, id) => { reauth++; await admin(); assert.equal(id, 'admin') } },
    '@/utils/club-asset-storage': { assertClubImageAssignment: async () => {} },
    '@/utils/admin-page': { adminPageLoad: async (_p, fn) => { try { return { value: await fn() } } catch { return { supportCode: 'ADMIN-TEST' } } }, logAdminFailure: () => 'ADMIN-TEST' },
    'next/navigation': { redirect: () => { throw Error('Redirect to /platform/login') } },
  }
  return { api: load('actions/admin-clubs.ts', mocks), stored: () => stored, audits, reauth: () => reauth, updates: () => updates }
}

test('a platform admin turns one feature on for one club, with reauthorization and an audit entry', async () => {
  const h = setup()
  const r = await h.api.setAdminClubFeature({ clubId, key: 'csvExport', enabled: true, expected: false, reason })
  assert.equal(r.error, undefined)
  assert.equal(r.features.csvExport, true)
  assert.deepEqual(h.stored().features, { csvExport: true, cloneCycle: false, previouslyApplied: false, pushNotifications: false })
  assert.equal(h.reauth(), 1)
  assert.equal(h.audits.length, 1)
  assert.equal(h.audits[0].action, 'platform.club.feature')
  assert.equal(h.audits[0].clubId, clubId)
  assert.equal(h.audits[0].reason, reason)
  assert.deepEqual(h.audits[0].details, { key: 'csvExport', enabled: true, previous: false, result: 'success' })
  assert.equal((await h.api.getAdminClub(clubId)).value.features.csvExport, true, 'the admin loader reports the server state')
})

test('stale expected state is a conflict; a no-op writes and audits nothing', async () => {
  const h = setup()
  await h.api.setAdminClubFeature({ clubId, key: 'cloneCycle', enabled: true, expected: false, reason })
  const stale = await h.api.setAdminClubFeature({ clubId, key: 'cloneCycle', enabled: false, expected: false, reason })
  assert.match(stale.error, /changed/)
  assert.equal(h.stored().features.cloneCycle, true)
  const same = await h.api.setAdminClubFeature({ clubId, key: 'cloneCycle', enabled: true, expected: true, reason })
  assert.equal(same.error, undefined)
  assert.equal(h.updates(), 1); assert.equal(h.audits.length, 1)
})

test('validation rejects unknown keys, non-boolean values, missing reasons, extra fields and bad ids before any auth or write', async () => {
  let calls = 0
  const h = setup({ admin: async () => { calls++; return { id: 'admin' } } })
  for (const input of [
    { clubId, key: 'futureFeature', enabled: true, expected: false, reason },
    { clubId, key: 'csvExport', enabled: 'true', expected: false, reason },
    { clubId, key: 'csvExport', enabled: true, expected: false, reason: 'short' },
    { clubId, key: 'csvExport', enabled: true, expected: false, reason, features: { csvExport: true } },
    { clubId: 'not-a-uuid', key: 'csvExport', enabled: true, expected: false, reason },
    null,
  ]) assert.ok((await h.api.setAdminClubFeature(input)).error, JSON.stringify(input))
  assert.equal(calls, 0); assert.equal(h.updates(), 0)
  assert.equal((await h.api.setAdminClubFeature({ clubId: '00000000-0000-4000-8000-0000000000ff', key: 'csvExport', enabled: true, expected: false, reason })).error, 'Club not found.')
})

test('non-admins cannot change a switch and nothing is written', async () => {
  const { AdminAccessError } = adminFailure
  const h = setup({ admin: async () => { throw new AdminAccessError('ADMIN_ACCESS_DENIED', 'Platform administrator access denied.') } })
  await assert.rejects(h.api.setAdminClubFeature({ clubId, key: 'csvExport', enabled: true, expected: false, reason }), /Redirect/)
  assert.equal(h.updates(), 0); assert.equal(h.audits.length, 0); assert.equal(h.stored().features, null)
})

test('an admin in an impersonation (view-as) session is refused by the real guard', async () => {
  const actor = '00000000-0000-4000-8000-0000000000ad'
  const { PLATFORM_VIEW_COOKIE } = load('lib/platform-view-as.ts')
  const jar = { has: name => name === PLATFORM_VIEW_COOKIE, get: () => undefined }
  const previous = process.env.OUTCLASS_PLATFORM_ADMIN_IDS
  process.env.OUTCLASS_PLATFORM_ADMIN_IDS = actor
  try {
    const guard = load('utils/platform-admin.ts', {
      '@/lib/admin-failure': adminFailure,
      '@/utils/admin-elevation': { requireAdminElevation: async () => ({}) },
      '@/utils/auth': { requireAuth: async () => ({ user: { id: actor } }) },
      '@/utils/prisma': { prisma: { platformAdmin: { findUnique: async () => ({ active: true }) } } },
      'next/headers': { cookies: async () => jar },
      '@/utils/supabase/server': { createClient: async () => ({ auth: { mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2' } }) } } }) },
    })
    await assert.rejects(guard.requirePlatformAdmin({ fresh: true }), /Exit impersonation/)
    const h = setup({ admin: () => guard.requirePlatformAdmin({ fresh: true }) })
    await assert.rejects(h.api.setAdminClubFeature({ clubId, key: 'csvExport', enabled: true, expected: false, reason }), /Redirect/)
    assert.equal(h.updates(), 0); assert.equal(h.audits.length, 0)
  } finally {
    if (previous === undefined) delete process.env.OUTCLASS_PLATFORM_ADMIN_IDS
    else process.env.OUTCLASS_PLATFORM_ADMIN_IDS = previous
  }
})

test('the action requires a fresh platform admin and the switch UI only uses Phosphor icons', () => {
  const src = fs.readFileSync('actions/admin-clubs.ts', 'utf8')
  const fn = src.slice(src.indexOf('export async function setAdminClubFeature'))
  assert.match(fn, /requirePlatformAdmin\(\{ fresh: true \}\)/)
  assert.match(fn, /authorizeAdminTransaction\(tx, actor\.id\)/)
  assert.match(fn, /FOR UPDATE/)
  const ui = fs.readFileSync('components/admin/admin-club-features.tsx', 'utf8')
  assert.match(ui, /from "@\/components\/icons"/)
  assert.doesNotMatch(ui, /lucide|@phosphor-icons/)
})

const migrationDir = fs.readdirSync('prisma/migrations').find(name => name.endsWith('_club_features'))
test('the migration is additive, nullable, lock-bounded and grant-free', () => {
  assert.equal(migrationDir, '20261110210000_club_features')
  const sql = fs.readFileSync(`prisma/migrations/${migrationDir}/migration.sql`, 'utf8')
  assert.match(sql, /^BEGIN;\r?\nSET LOCAL lock_timeout = '5s';/)
  assert.match(sql, /ALTER TABLE "Club" ADD COLUMN "features" JSONB,/)
  assert.doesNotMatch(sql, /NOT NULL|DROP|UPDATE "Club"|GRANT|REVOKE|POLICY|DEFAULT/)
  assert.match(sql, /COMMIT;\s*$/)
  assert.match(fs.readFileSync('prisma/schema.prisma', 'utf8'), /\n  features Json\? /)
})

test('the migration applies after the existing chain, keeps rows NULL (all off), and only accepts JSON objects', { timeout: 240000 }, async t => {
  const { PGlite } = require('@electric-sql/pglite')
  const db = new PGlite(); t.after(() => db.close())
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
  const names = fs.readdirSync('prisma/migrations').sort().filter(name => fs.existsSync(path.join('prisma/migrations', name, 'migration.sql')))
  for (const name of names.filter(n => n < migrationDir)) await db.exec(fs.readFileSync(path.join('prisma/migrations', name, 'migration.sql'), 'utf8'))
  await db.exec(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('existing','existing','Existing','','','#123456','Finance')`)
  const acl = `SELECT relacl::text acl FROM pg_class WHERE relname='Club'`, policies = `SELECT count(*)::int n FROM pg_policies`
  const before = { acl: (await db.query(acl)).rows, policies: (await db.query(policies)).rows }
  await db.exec(fs.readFileSync(path.join('prisma/migrations', migrationDir, 'migration.sql'), 'utf8'))
  for (const name of names.filter(n => n > migrationDir)) await db.exec(fs.readFileSync(path.join('prisma/migrations', name, 'migration.sql'), 'utf8'))
  assert.deepEqual({ acl: (await db.query(acl)).rows, policies: (await db.query(policies)).rows }, before, 'table ACL and policies unchanged')
  const read = async id => (await db.query(`SELECT features FROM "Club" WHERE id=$1`, [id])).rows[0].features
  assert.equal(await read('existing'), null)
  assert.deepEqual(lib.normalizeClubFeatures(await read('existing')), lib.normalizeClubFeatures(null), 'NULL reads as all off')
  await db.exec(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('fresh','fresh','Fresh','','','#123456','Finance')`)
  assert.equal(await read('fresh'), null, 'new clubs start with every feature off')
  const write = value => db.query(`UPDATE "Club" SET features=$1::jsonb WHERE id='existing'`, [value])
  await write(JSON.stringify({ csvExport: true }))
  assert.equal(lib.isFeatureEnabled(await read('existing'), 'csvExport'), true)
  assert.equal(lib.isFeatureEnabled(await read('fresh'), 'csvExport'), false, 'one club only')
  await write(null)
  for (const bad of ['[]', '"on"', 'true', '1']) await assert.rejects(write(bad), /Club_features_object/, bad)
})
