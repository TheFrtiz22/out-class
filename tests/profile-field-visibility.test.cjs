const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file, mocks = {}) {
  mocks = { 'next/cache': { unstable_cache: fn => fn, revalidateTag() {}, revalidatePath() {} }, ...mocks }
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const lib = load('lib/profile-field-visibility.ts')
const clubA = '00000000-0000-4000-8000-00000000000a', clubB = '00000000-0000-4000-8000-00000000000b'
const all = on => Object.fromEntries(lib.profileFieldKeys.map(k => [k, on]))

test('defaults: GPA and LinkedIn are off, every other field on', () => {
  const d = lib.defaultProfileFieldVisibility()
  assert.deepEqual(Object.keys(d), [...lib.profileFieldKeys])
  assert.equal(d.gpa, false)
  assert.equal(d.linkedin, false)
  for (const key of lib.profileFieldKeys) if (key !== 'gpa' && key !== 'linkedin') assert.equal(d[key], true, key)
  for (const key of ['name', 'major', 'academicYear', 'resume']) assert.ok(lib.profileFieldKeys.includes(key))
})

test('normalization: missing, null, unknown and malformed values fall back to the defaults', () => {
  const d = lib.defaultProfileFieldVisibility()
  for (const value of [null, undefined, 'x', 7, [], [true], {}]) assert.deepEqual(lib.normalizeProfileFieldVisibility(value), d)
  const n = lib.normalizeProfileFieldVisibility({ gpa: true, major: false, futureField: true, sat: 'yes', linkedin: null })
  assert.equal(n.gpa, true); assert.equal(n.major, false)
  assert.equal(n.sat, true, 'non-boolean falls back to default on')
  assert.equal(n.linkedin, false, 'null falls back to default off')
  assert.equal('futureField' in n, false)
  assert.deepEqual(Object.keys(n), [...lib.profileFieldKeys])
})

test('the write schema is strict and requires every key', () => {
  assert.equal(lib.profileFieldVisibilitySchema.safeParse(all(true)).success, true)
  assert.equal(lib.profileFieldVisibilitySchema.safeParse({ ...all(true), extra: true }).success, false)
  const { gpa, ...missing } = all(true); void gpa
  assert.equal(lib.profileFieldVisibilitySchema.safeParse(missing).success, false)
  assert.equal(lib.profileFieldVisibilitySchema.safeParse({ ...all(true), gpa: 'true' }).success, false)
  assert.equal(lib.saveProfileFieldVisibilityInput.safeParse({ clubId: clubA, fields: all(true), expected: all(true), role: 'x' }).success, false)
  assert.equal(lib.saveProfileFieldVisibilityInput.safeParse({ clubId: 'nope', fields: all(true), expected: all(true) }).success, false)
})

test('restrictProfileFields clears hidden values present on the payload and leaves identity alone', () => {
  const profile = { firstName: 'Ada', lastName: 'L', major: 'CS', academicYear: 'Third Year', gpa: 3.9, satScore: 1500, actScore: 34, actMath: 35, headshotUrl: 'h', resumeUrl: 'r', linkedinUrl: 'https://linkedin.com/in/a', experiences: [{ id: 'e' }] }
  const hidden = lib.restrictProfileFields(profile, lib.defaultProfileFieldVisibility())
  assert.equal(hidden.gpa, null); assert.equal(hidden.linkedinUrl, null)
  assert.equal(hidden.major, 'CS'); assert.equal(hidden.resumeUrl, 'r'); assert.equal(hidden.firstName, 'Ada')
  const none = lib.restrictProfileFields(profile, all(false))
  assert.deepEqual([none.major, none.academicYear, none.gpa, none.satScore, none.actScore, none.actMath, none.headshotUrl, none.resumeUrl, none.linkedinUrl, none.experiences], ['', '', null, null, null, null, null, null, null, []])
  assert.equal(none.firstName, 'Ada', 'name is identity; hidden in the profile view only')
  assert.equal('actEnglish' in none, false, 'absent keys are not added')
  assert.deepEqual(lib.restrictProfileFields(profile, all(true)), profile)
  assert.equal(profile.gpa, 3.9, 'input is not mutated')
})

test('the display ceiling caps profile fields only', () => {
  const d = lib.defaultProfileFieldVisibility()
  assert.equal(lib.allowedByProfileCeiling('gpa', d), false)
  assert.equal(lib.allowedByProfileCeiling('linkedin', d), false)
  assert.equal(lib.allowedByProfileCeiling('major', d), true)
  for (const f of ['answers', 'pros', 'cons', 'score', 'feedback', 'gender', 'applicationContext']) assert.equal(lib.allowedByProfileCeiling(f, all(false)), true, f)
})

/** saveProfileFieldVisibility against in-memory clubs and memberships. */
function harness() {
  const state = {
    clubs: { [clubA]: { profileFieldVisibility: null }, [clubB]: { profileFieldVisibility: null } },
    members: { [`leaderA:${clubA}`]: { status: 'ACTIVE', permissions: ['club.settings'] }, [`leaderB:${clubB}`]: { status: 'ACTIVE', permissions: ['club.settings'] }, [`reviewer:${clubA}`]: { status: 'ACTIVE', permissions: ['applications.review', 'application.manage'] } },
    writes: [], audits: [], locks: [], user: 'leaderA',
  }
  const tx = {
    clubMember: { findUnique: async q => state.members[`${q.where.userId_clubId.userId}:${q.where.userId_clubId.clubId}`] ?? null },
    user: { findUnique: async () => ({ disabledAt: null }) },
    club: {
      findUniqueOrThrow: async q => { if (!state.clubs[q.where.id]) throw new Error('missing'); return state.clubs[q.where.id] },
      findUnique: async q => state.clubs[q.where.id] ?? null,
      update: async q => { state.writes.push([q.where.id, q.data]); Object.assign(state.clubs[q.where.id], q.data) },
    },
    auditLog: { create: async q => { state.audits.push(q.data) } },
  }
  const hasPermission = (m, p) => !!m && m.status === 'ACTIVE' && (m.isOwner || m.permissions.includes(p))
  state.actions = load('actions/club-settings.ts', {
    '@/lib/club-suspension': { lockOperationalClub: async (_tx, id) => { state.locks.push(id) } },
    '@/utils/auth': { requireClubPermission: async (id, caps) => { state.request = [id, caps]; const m = state.members[`${state.user}:${id}`]; if (!caps.every(c => hasPermission(m, c))) throw new Error('Forbidden'); return { user: { id: state.user }, membership: m } } },
    '@/utils/prisma': { prisma: { $transaction: fn => fn(tx), club: tx.club } },
  })
  return state
}

test('a club leader with club.settings saves the map under the club lock with an audit row', async () => {
  const h = harness()
  const fields = { ...lib.defaultProfileFieldVisibility(), gpa: true, major: false }
  const result = await h.actions.saveProfileFieldVisibility({ clubId: clubA, fields, expected: lib.defaultProfileFieldVisibility() })
  assert.deepEqual(result.fields, fields)
  assert.deepEqual(h.request, [clubA, ['club.settings']])
  assert.deepEqual(h.locks, [clubA])
  assert.deepEqual(h.writes, [[clubA, { profileFieldVisibility: fields }]])
  assert.deepEqual(h.audits, [{ actorId: 'leaderA', action: 'club.profile_fields.configure', targetId: clubA, clubId: clubA, details: fields }])
  assert.deepEqual((await h.actions.getProfileFieldVisibility(clubA)).fields, fields)
  assert.equal(h.clubs[clubB].profileFieldVisibility, null, 'another club is untouched')
})

test('reads of a club with no saved preference return the defaults', async () => {
  const h = harness()
  assert.deepEqual((await h.actions.getProfileFieldVisibility(clubA)).fields, lib.defaultProfileFieldVisibility())
})

test('a member without club.settings, or another club’s leader, cannot read or change the setting', async () => {
  for (const user of ['reviewer', 'leaderB', 'stranger']) {
    const h = harness(); h.user = user
    await assert.rejects(h.actions.saveProfileFieldVisibility({ clubId: clubA, fields: all(true), expected: lib.defaultProfileFieldVisibility() }), /Forbidden/, user)
    await assert.rejects(h.actions.getProfileFieldVisibility(clubA), /Forbidden/, user)
    assert.equal(h.writes.length, 0); assert.equal(h.audits.length, 0)
  }
})

test('access revoked between the request check and the locked transaction writes nothing', async () => {
  const h = harness()
  const request = h.members[`leaderA:${clubA}`]
  // The request-time check runs synchronously and passes; the membership then loses the
  // permission before the locked transaction re-checks it.
  const save = h.actions.saveProfileFieldVisibility({ clubId: clubA, fields: all(true), expected: lib.defaultProfileFieldVisibility() })
  request.permissions = []
  await assert.rejects(save, /Settings access changed/)
  assert.equal(h.writes.length, 0)
})

test('a concurrent change by another leader is a conflict; an identical retry succeeds', async () => {
  const h = harness()
  const other = { ...lib.defaultProfileFieldVisibility(), sat: false }
  h.clubs[clubA].profileFieldVisibility = other
  await assert.rejects(h.actions.saveProfileFieldVisibility({ clubId: clubA, fields: { ...lib.defaultProfileFieldVisibility(), gpa: true }, expected: lib.defaultProfileFieldVisibility() }), /changed/)
  assert.equal(h.writes.length, 0)
  await h.actions.saveProfileFieldVisibility({ clubId: clubA, fields: other, expected: lib.defaultProfileFieldVisibility() })
  assert.equal(h.writes.length, 1)
})

test('unknown keys and non-boolean values are rejected without writing', async () => {
  const h = harness()
  await assert.rejects(h.actions.saveProfileFieldVisibility({ clubId: clubA, fields: { ...all(true), ssn: true }, expected: lib.defaultProfileFieldVisibility() }))
  await assert.rejects(h.actions.saveProfileFieldVisibility({ clubId: clubA, fields: { ...all(true), gpa: 1 }, expected: lib.defaultProfileFieldVisibility() }))
  assert.equal(h.writes.length, 0)
})

test('the settings section is available only with club.settings and renders the toggles', () => {
  const { availableSettings } = load('lib/club-settings.ts')
  assert.ok(availableSettings({ status: 'ACTIVE', permissions: ['club.settings'] }).some(s => s.id === 'profiles'))
  assert.ok(!availableSettings({ status: 'ACTIVE', permissions: ['application.manage', 'applications.review'] }).some(s => s.id === 'profiles'))
  const workspace = fs.readFileSync('components/club-settings-workspace.tsx', 'utf8')
  assert.match(workspace, /visible\("profiles"\) && <div hidden=\{active !== "profiles"\}><ProfileFieldSettings clubId=\{clubId\} \/><\/div>/)
  const ui = fs.readFileSync('components/profile-field-settings.tsx', 'utf8')
  assert.match(ui, /from "@\/lib\/workspace-api"/, 'goes through the Demo-aware facade')
  assert.match(ui, /profileFieldKeys\.map/)
  assert.doesNotMatch(ui, /lib\/demo/)
})

test('Demo Mode stores the choice in the demo store with the same normalization', () => {
  const src = fs.readFileSync('lib/demo/workspace.ts', 'utf8')
  assert.match(src, /export const saveProfileFieldVisibility: Demo<"saveProfileFieldVisibility">/)
  assert.match(src, /s\.profileFieldVisibility = \{ \.\.\.\(s\.profileFieldVisibility \?\? \{\}\), \[data\.clubId\]: fields \}/)
  assert.match(fs.readFileSync('lib/demo/store.ts', 'utf8'), /value\.profileFieldVisibility \?\?= \{\}/)
  assert.match(fs.readFileSync('lib/demo/validate.ts', 'utf8'), /profileFieldVisibility: z\.record\(profileFieldVisibilitySchema\)\.optional\(\)/)
})

const migrationDir = fs.readdirSync('prisma/migrations').find(name => name.endsWith('_club_profile_field_visibility'))
test('the migration is additive, nullable, lock-bounded and grant-free', () => {
  const sql = fs.readFileSync(`prisma/migrations/${migrationDir}/migration.sql`, 'utf8')
  assert.match(sql, /^BEGIN;\r?\nSET LOCAL lock_timeout = '5s';/)
  assert.match(sql, /ALTER TABLE "Club" ADD COLUMN "profileFieldVisibility" JSONB,/)
  assert.doesNotMatch(sql, /NOT NULL|DROP|UPDATE "Club"|GRANT|REVOKE|POLICY|DEFAULT/)
  assert.match(sql, /COMMIT;\s*$/)
  assert.match(fs.readFileSync('prisma/schema.prisma', 'utf8'), /\n  profileFieldVisibility Json\? /)
})

test('the migration applies after the existing chain, keeps rows NULL, and only accepts JSON objects', async t => {
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
  assert.equal((await db.query(`SELECT "profileFieldVisibility" v FROM "Club" WHERE id='existing'`)).rows[0].v, null)
  await db.exec(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('fresh','fresh','Fresh','','','#123456','Finance')`)
  assert.equal((await db.query(`SELECT "profileFieldVisibility" v FROM "Club" WHERE id='fresh'`)).rows[0].v, null, 'new clubs start on the defaults')
  // As scripts/run-disposable-postgres.cjs does: the runtime role owns the tables and is not a superuser.
  await db.exec(`CREATE ROLE outclass_production_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
   DO $$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
   EXECUTE format('ALTER TABLE public.%I OWNER TO outclass_production_app',t); END LOOP; END $$;
   SET ROLE outclass_production_app;`)
  const write = value => db.query(`UPDATE "Club" SET "profileFieldVisibility"=$1::jsonb WHERE id='existing'`, [value])
  await write(JSON.stringify(lib.defaultProfileFieldVisibility()))
  await write(null)
  for (const bad of ['[]', '"x"', '1', 'true']) await assert.rejects(write(bad), /Club_profileFieldVisibility_object/, bad)
})
