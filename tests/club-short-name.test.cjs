const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  mocks = { 'next/cache': { unstable_cache: fn => fn, revalidateTag() {}, revalidatePath() {} }, ...mocks }
  if (mocks['@/utils/prisma']) mocks['@/utils/club-write-transaction'] = { clubWriteTransaction: fn => mocks['@/utils/prisma'].prisma.$transaction(fn) }
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const { clubProfileSchema, profileDraft } = load('lib/club-marketing.ts')
const clubId = '00000000-0000-4000-8000-000000000002'

/** updateClubSettings against an in-memory club row; records permission checks, writes and audits. */
function harness({ allowed = true } = {}) {
  const state = { row: { id: clubId, ...profileDraft({ name: 'McIntire Investment Institute', tagline: 'Invest', category: 'Finance', color: '#123456' }) }, writes: [], audits: [], checks: [] }
  const tx = {
    club: { findUniqueOrThrow: async q => { assert.equal(q.where.id, clubId); return state.row }, update: async q => { state.writes.push(q.data); state.row = { ...state.row, ...q.data } } },
    auditLog: { create: async q => { state.audits.push(q.data) } },
  }
  state.actions = load('actions/club-workspace.ts', {
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async (_tx, id, user, capabilities) => { state.checks.push(['transaction', id, user, capabilities]) } },
    '@/utils/club-asset-storage': { assertClubImageAssignment: async () => {}, releaseReplacedClubImages: async () => {} },
    '@/utils/auth': { requireClubPermission: async (id, capabilities) => { state.checks.push(['request', id, capabilities]); if (!allowed) throw new Error('Denied'); return { user: { id: 'leader' } } } },
    '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } },
  })
  state.save = (fields, extra = {}) => state.actions.updateClubSettings({ clubId, ...profileDraft(state.row), ...fields, ...extra })
  return state
}

test('the schema accepts 2–8 letters, digits, "&", "-" and spaces, trimmed, and stores empty as null', () => {
  for (const ok of ['MI', 'MIIx', 'A&M', 'UVA-2', 'Hoo Crew', '12345678']) assert.equal(clubProfileSchema.parse({ ...profileDraft({ name: 'Club' }), shortName: ok }).shortName, ok)
  assert.equal(clubProfileSchema.parse({ ...profileDraft({ name: 'Club' }), shortName: '  MIIx  ' }).shortName, 'MIIx')
  for (const empty of ['', '   ', null]) assert.equal(clubProfileSchema.parse({ ...profileDraft({ name: 'Club' }), shortName: empty }).shortName, null)
  for (const bad of ['M', ' M ', '123456789', 'MII_x', 'MII!', 'MII.', 'Ünï', '<b>', 'MII\nx']) assert.equal(clubProfileSchema.safeParse({ ...profileDraft({ name: 'Club' }), shortName: bad }).success, false, bad)
})

test('updateClubSettings saves a trimmed short name under club.settings with the existing audit', async () => {
  const h = harness()
  await h.save({ shortName: '  MIIx ' })
  assert.equal(h.writes.at(-1).shortName, 'MIIx')
  assert.equal(h.row.shortName, 'MIIx')
  assert.deepEqual(h.checks, [['request', clubId, ['club.settings']], ['transaction', clubId, 'leader', ['club.settings']]])
  assert.deepEqual(h.audits, [{ actorId: 'leader', action: 'club.settings.update', targetId: clubId, clubId }])
})

test('updateClubSettings clears the short name to null when it is emptied', async () => {
  const h = harness()
  await h.save({ shortName: 'MIIx' })
  await h.save({ shortName: '   ' })
  assert.equal(h.writes.at(-1).shortName, null)
  await h.save({ shortName: 'MIIx' })
  await h.save({ shortName: '' })
  assert.equal(h.row.shortName, null)
})

test('updateClubSettings rejects 1 or 9+ characters and disallowed characters without writing', async () => {
  const h = harness()
  for (const shortName of ['M', '123456789', 'MII_x', 'MII!', '<b>', 'Ünï']) await assert.rejects(h.save({ shortName }), /short name|Invalid/i, shortName)
  assert.equal(h.writes.length, 0)
  assert.equal(h.audits.length, 0)
})

test('a request without shortName leaves it untouched, and a denied leader writes nothing', async () => {
  const h = harness()
  await h.save({ shortName: 'MIIx' })
  const { shortName, ...rest } = profileDraft(h.row)
  await h.actions.updateClubSettings({ clubId, ...rest, tagline: 'Invest together' })
  assert.equal('shortName' in h.writes.at(-1), false)
  assert.equal(h.row.shortName, shortName)
  const denied = harness({ allowed: false })
  await assert.rejects(denied.save({ shortName: 'MIIx' }), /Denied/)
  assert.equal(denied.writes.length, 0)
})

test('the revision check includes shortName: a concurrent short-name change is a conflict, identical retries recover', async () => {
  const h = harness()
  const expectedProfile = JSON.stringify(clubProfileSchema.parse(profileDraft(h.row)))
  // Another leader renames the short name after this editor opened.
  await h.save({ shortName: 'Other' })
  await assert.rejects(h.save({ shortName: 'MIIx', tagline: 'Mine' }, { expectedProfile }), /changed while you were editing/)
  assert.equal(h.row.shortName, 'Other')
  // A fresh snapshot saves, and resending the same request (a retry after a lost response) is accepted.
  const fresh = JSON.stringify(clubProfileSchema.parse(profileDraft(h.row)))
  await h.save({ shortName: 'MIIx' }, { expectedProfile: fresh })
  await h.save({ shortName: 'MIIx' }, { expectedProfile: fresh })
  assert.equal(h.row.shortName, 'MIIx')
})

test('an editor opened before short names existed (snapshot without the key) is not falsely blocked', async () => {
  const h = harness()
  await h.save({ shortName: 'MIIx' })
  const { shortName, ...legacy } = clubProfileSchema.parse(profileDraft(h.row))
  const expectedProfile = JSON.stringify(legacy)
  assert.equal(expectedProfile.includes('shortName'), false)
  await h.actions.updateClubSettings({ clubId, ...legacy, tagline: 'Old tab', expectedProfile })
  assert.equal(h.row.tagline, 'Old tab')
  assert.equal(h.row.shortName, shortName)
  // ...but it still detects other concurrent edits.
  await assert.rejects(h.actions.updateClubSettings({ clubId, ...legacy, tagline: 'Stale', expectedProfile }), /changed while you were editing/)
})

test('a snapshot without shortName cannot be used to overwrite a concurrent short-name change', async () => {
  const h = harness()
  const { shortName, ...legacy } = clubProfileSchema.parse(profileDraft(h.row))
  const expectedProfile = JSON.stringify(legacy)
  await h.save({ shortName: 'Other' })
  await assert.rejects(h.actions.updateClubSettings({ clubId, ...legacy, shortName: 'Mine', expectedProfile }), /changed while you were editing/)
  assert.equal(h.row.shortName, 'Other')
})

test('the editor offers the field with the live abbreviation as its placeholder and one helper line', () => {
  const source = fs.readFileSync('components/clubs/club-profile-editor.tsx', 'utf8')
  assert.match(source, /<Field label="Short name"><Input maxLength=\{CLUB_SHORT_NAME_MAX\}/)
  assert.match(source, /placeholder=\{clubAbbreviation\(draft\.name\)\}/)
  assert.match(source, /aria-describedby="club-short-name-hint"/)
  assert.equal((source.match(/club-short-name-hint/g) || []).length, 2)
})

test('the migration is additive, nullable and mirrors the server rule', () => {
  const dir = fs.readdirSync('prisma/migrations').find(name => name.endsWith('_club_short_name'))
  const sql = fs.readFileSync(`prisma/migrations/${dir}/migration.sql`, 'utf8')
  assert.match(sql, /ALTER TABLE "Club" ADD COLUMN "shortName" TEXT,/)
  assert.doesNotMatch(sql, /NOT NULL|DROP|UPDATE "Club"|GRANT|POLICY/)
  assert.match(sql, /char_length\("shortName"\) BETWEEN 2 AND 8/)
  assert.match(fs.readFileSync('prisma/schema.prisma', 'utf8'), /\n  shortName +String\? /)
})

test('the database constraint accepts and rejects the same short names as the server', async t => {
  const path = require('node:path'), { PGlite } = require('@electric-sql/pglite')
  const db = new PGlite(); t.after(() => db.close())
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
  for (const name of fs.readdirSync('prisma/migrations').sort()) {
    const file = path.join('prisma/migrations', name, 'migration.sql')
    if (fs.existsSync(file)) await db.exec(fs.readFileSync(file, 'utf8'))
  }
  await db.exec(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('short-club','short-club','McIntire Investment Institute','','','#123456','Finance')`)
  // As scripts/run-disposable-postgres.cjs does: the runtime role owns the tables and is not a superuser.
  await db.exec(`CREATE ROLE outclass_production_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
   DO $$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
   EXECUTE format('ALTER TABLE public.%I OWNER TO outclass_production_app',t); END LOOP; END $$;
   SET ROLE outclass_production_app;`)
  assert.equal((await db.query('SELECT current_user AS who, (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS sup')).rows[0].sup, false)
  const write = value => db.query('UPDATE "Club" SET "shortName"=$1 WHERE id=$2', [value, 'short-club'])
  assert.equal((await db.query(`SELECT "shortName" FROM "Club" WHERE id='short-club'`)).rows[0].shortName, null)
  for (const ok of ['MI', 'MIIx', 'A&M', 'UVA-2', 'Hoo Crew', null]) await write(ok)
  for (const bad of ['M', '123456789', ' MIIx', 'MIIx ', 'MII_x', 'MII!', '']) await assert.rejects(write(bad), /Club_shortName_format/, JSON.stringify(bad))
})
