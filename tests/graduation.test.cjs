// Graduation → Alumni (lib/graduation.ts, utils/graduation.ts, app/api/internal/graduation).
// Pure rules with fixed clocks; the daily job runs as real SQL on PGlite over the full migration
// chain; server-side exclusions are pinned at their call sites.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')
// TIMESTAMP(3) columns hold UTC wall time (Prisma's convention); read them back as UTC.
process.env.TZ = 'UTC'

const cache = new Map()
function load(file, mocks = {}) {
  const key = `${file}`
  if (!Object.keys(mocks).length && cache.has(key)) return cache.get(key)
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const req = name => {
    if (name in mocks) return mocks[name]
    if (name.startsWith('@/')) {
      const base = name.slice(2)
      const found = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(f => fs.existsSync(f))
      if (!found) throw Error(`Unexpected import ${name}`)
      return load(found)
    }
    return require(name)
  }
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports)
  if (!Object.keys(mocks).length) cache.set(key, mod.exports)
  return mod.exports
}

const g = load('lib/graduation.ts')
const at = iso => new Date(iso)

test('Aug 1 default is midnight Eastern (EDT) of the graduation year', () => {
  assert.equal(g.graduationDefaultAt(2026).toISOString(), '2026-08-01T04:00:00.000Z')
  assert.equal(g.graduationDefaultAt(2031).toISOString(), '2031-08-01T04:00:00.000Z')
  // The boundary is Eastern, not UTC: 11:59 PM July 31 Eastern is still before it.
  assert.equal(g.lastDefaultedGradYear(at('2026-08-01T03:59:59.999Z')), 2025)
  assert.equal(g.lastDefaultedGradYear(at('2026-08-01T04:00:00.000Z')), 2026)
  assert.equal(g.lastDefaultedGradYear(at('2027-01-01T04:59:00.000Z')), 2026, 'Dec 31 Eastern')
  assert.equal(g.lastDefaultedGradYear(at('2027-01-01T05:00:00.000Z')), 2026, 'Jan 1 Eastern: the 2027 default is still ahead')
})

test('Home prompt shows April–July (Eastern) of gradYear until answered or dismissed', () => {
  const p = { gradYear: 2027 }
  assert.equal(g.showGraduationPrompt(p, at('2027-04-01T03:59:00Z')), false, 'still March 31 in Eastern time')
  assert.equal(g.showGraduationPrompt(p, at('2027-04-01T04:00:00Z')), true)
  assert.equal(g.showGraduationPrompt(p, at('2027-07-31T23:00:00Z')), true)
  assert.equal(g.showGraduationPrompt(p, at('2027-08-01T04:00:00Z')), false)
  assert.equal(g.showGraduationPrompt({ gradYear: 2028 }, at('2027-05-01T12:00:00Z')), false, 'other years never prompt')
  for (const answered of [{ graduationPromptDismissedAt: at('2027-04-02T00:00:00Z') }, { graduationConfirmedAt: at('2027-04-02T00:00:00Z'), graduatedAt: g.graduationDefaultAt(2027) }])
    assert.equal(g.showGraduationPrompt({ ...p, ...answered }, at('2027-05-01T12:00:00Z')), false)
  assert.equal(g.showGraduationPrompt(null, at('2027-05-01T12:00:00Z')), false)
})

test('"Yes" sets Aug 1 (or now once it has passed) and is refused before April of gradYear', () => {
  assert.equal(g.confirmedGraduationAt(2027, at('2027-05-01T12:00:00Z')).toISOString(), '2027-08-01T04:00:00.000Z')
  assert.equal(g.confirmedGraduationAt(2027, at('2027-09-01T12:00:00Z')).toISOString(), '2027-09-01T12:00:00.000Z')
  assert.equal(g.canConfirmGraduation({ gradYear: 2027 }, at('2027-03-15T12:00:00Z')), false)
  assert.equal(g.canConfirmGraduation({ gradYear: 2027 }, at('2027-04-15T12:00:00Z')), true)
  assert.equal(g.canConfirmGraduation({ gradYear: 2028 }, at('2027-06-15T12:00:00Z')), false)
  assert.equal(g.canConfirmGraduation({ gradYear: 2026, graduatedAt: at('2026-08-01T04:00:00Z') }, at('2027-06-15T12:00:00Z')), false, 'already alumni')
  // Confirmed in May: still a student (can apply) until Aug 1.
  const confirmed = { gradYear: 2027, graduatedAt: g.graduationDefaultAt(2027) }
  assert.equal(g.isAlumniProfile(confirmed, at('2027-07-31T12:00:00Z')), false)
  assert.equal(g.isAlumniProfile(confirmed, at('2027-08-01T04:00:00Z')), true)
})

test('changing gradYear clears a pending answer; only defaulted alumni moving to a future year are restored', () => {
  const now = at('2027-09-10T12:00:00Z')
  assert.equal(g.graduationYearChange({ gradYear: 2028 }, 2028, now), null, 'same year: nothing to do')
  assert.deepEqual(g.graduationYearChange({ gradYear: 2028, graduationPromptDismissedAt: now }, 2029, now), { data: { graduatedAt: null, graduationConfirmedAt: null, graduationPromptDismissedAt: null }, restoreAlumniSince: null })
  const defaulted = { gradYear: 2027, graduatedAt: g.graduationDefaultAt(2027), graduationConfirmedAt: null }
  assert.equal(g.graduationYearChange(defaulted, 2028, now).restoreAlumniSince.toISOString(), '2027-08-01T04:00:00.000Z')
  assert.equal(g.graduationYearChange(defaulted, 2026, now), null, 'moving to a past year keeps alumni')
  assert.equal(g.graduationYearChange({ ...defaulted, graduationConfirmedAt: at('2027-05-01T00:00:00Z') }, 2028, now), null, 'a confirmed graduate stays alumni')
})

test('alumni memberships hold no capabilities but stay removable; role and permission changes need a current member', () => {
  const p = load('lib/permissions.ts')
  const auth = load('lib/organization-authorization.ts')
  const owner = { isOwner: true, status: 'ACTIVE', permissions: [] }
  const alumniOwner = { ...owner, alumniSince: '2026-08-01T04:00:00Z' }
  const alumniAdmin = { isOwner: false, status: 'ACTIVE', permissions: [...p.clubPermissions], accessRole: 'ADMIN', alumniSince: new Date('2026-08-01T04:00:00Z') }
  assert.equal(p.isActiveMembership(alumniOwner), false)
  assert.equal(p.isRosterMembership(alumniOwner), true)
  assert.equal(p.isAlumniMembership(alumniOwner), true)
  assert.equal(p.isAlumniMembership({ status: 'LEFT', alumniSince: new Date() }), false, 'removed members are not alumni on the roster')
  for (const perm of p.clubPermissions) assert.equal(p.hasPermission(alumniAdmin, perm), false, `alumni keep no ${perm}`)
  assert.equal(p.hasWorkspace(alumniAdmin), false)
  assert.equal(p.hasWorkspace({ ...alumniAdmin, alumniSince: null }), true, 'the same grants work for a current member')
  assert.deepEqual(Object.values(auth.organizationCapabilities(alumniOwner)), [false, false, false, false, false, false])
  const member = { isOwner: false, status: 'ACTIVE', permissions: [], accessRole: 'MEMBER', alumniSince: new Date() }
  assert.equal(auth.canRemoveOrganizationMember(owner, member), true, 'clubs can still remove alumni')
  assert.equal(auth.canRemoveOrganizationMember(owner, { ...member, status: 'LEFT' }), false)
  assert.equal(auth.canChangeOrganizationRole(owner, member, 'ADMIN'), false, 'no role grants to alumni')
  assert.equal(auth.canRemoveOrganizationMember(alumniOwner, { ...member, alumniSince: null }), false, 'an alumni owner cannot remove anyone')
  assert.deepEqual(p.activeMemberWhere, { status: 'ACTIVE', alumniSince: null })
})

// ---- The daily job on real SQL ----

async function migratedDatabase(t) {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
  for (const name of fs.readdirSync('prisma/migrations').sort()) {
    const file = path.join('prisma/migrations', name, 'migration.sql')
    if (fs.existsSync(file)) await db.exec(fs.readFileSync(file, 'utf8'))
  }
  return db
}
const sql = (strings, values) => strings.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, '')
const raw = q => ({
  $queryRaw: async (strings, ...values) => (await q.query(sql(strings, values), values)).rows,
  $executeRaw: async (strings, ...values) => (await q.query(sql(strings, values), values)).affectedRows ?? 0,
})
const jobDb = db => ({ ...raw(db), $transaction: work => db.transaction(tx => work(raw(tx))) })
const job = () => load('utils/graduation.ts', { '@/utils/prisma': {} })

async function seed(db) {
  await db.exec(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES
      ('chess','chess','Chess','','','#142d4e','Academic'),('solo','solo','Solo','','','#142d4e','Academic'),('duo','duo','Duo','','','#142d4e','Academic');`)
  const people = [['senior', 2026], ['junior', 2027], ['old', 2024], ['confirmed', 2026], ['owner1', 2026], ['owner2', 2026], ['owner3', 2028], ['soloowner', 2026]]
  for (const [id, year] of people) await db.exec(`INSERT INTO "User"(id,email) VALUES('${id}','${id}@virginia.edu');
    INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear") VALUES('p-${id}','${id}','F','L','${id}','Econ',${year});`)
  await db.exec(`UPDATE "StudentProfile" SET "graduatedAt"='2026-08-01 04:00:00', "graduationConfirmedAt"='2026-05-02 12:00:00' WHERE id='p-confirmed'`)
  const members = [['m-senior', 'chess', 'senior', false], ['m-junior', 'chess', 'junior', false], ['m-old', 'chess', 'old', false], ['m-confirmed', 'chess', 'confirmed', false],
    ['m-owner3', 'chess', 'owner3', true], ['m-owner1', 'chess', 'owner1', true],
    // Two graduating co-owners with no one else: neither is converted, the club keeps an owner.
    ['m-duo1', 'duo', 'owner1', true], ['m-duo2', 'duo', 'owner2', true],
    ['m-solo', 'solo', 'soloowner', true], ['m-solo-senior', 'solo', 'senior', false]]
  for (const [id, club, user, owner] of members) await db.exec(`INSERT INTO "ClubMember"(id,"clubId","userId","isOwner","accessRole") VALUES('${id}','${club}','${user}',${owner},'${owner ? 'OWNER' : 'MEMBER'}')`)
  await db.exec(`UPDATE "ClubMember" SET status='LEFT' WHERE id='m-old'`)
}
const profiles = async db => Object.fromEntries((await db.query(`SELECT "userId", "graduatedAt" FROM "StudentProfile" ORDER BY 1`)).rows.map(r => [r.userId, r.graduatedAt && r.graduatedAt.toISOString().replace('.000', '')]))
const alumni = async db => (await db.query(`SELECT id FROM "ClubMember" WHERE "alumniSince" IS NOT NULL ORDER BY id`)).rows.map(r => r.id)

test('graduation job: Eastern Aug 1 boundary, idempotent, batched, audited, keeps the last owner', { timeout: 240000 }, async t => {
  const db = await migratedDatabase(t); await seed(db)
  const { runGraduationJob, GRADUATION_JOB_ACTOR } = job()
  const run = (iso, limits) => runGraduationJob(jobDb(db), new Date(iso), { profiles: 500, memberships: 500, deadline: Number.POSITIVE_INFINITY, ...limits })

  // 11:59 PM July 31 Eastern: only years before 2026 are due.
  assert.deepEqual(await run('2026-08-01T03:59:00Z'), { graduated: 1, alumniMemberships: 0, retainedOwners: 0, more: false })
  assert.equal((await profiles(db)).old, '2024-08-01T04:00:00Z', 'back-dated to its own Aug 1')
  assert.equal((await profiles(db)).senior, null)
  assert.deepEqual(await alumni(db), [], 'a removed (LEFT) membership is never converted; confirmed-for-Aug-1 is not due yet')

  // Midnight Aug 1 Eastern, in batches of 2 profiles and 2 memberships.
  const first = await run('2026-08-01T04:00:00Z', { profiles: 2, memberships: 2 })
  assert.equal(first.graduated, 2); assert.equal(first.more, true)
  let total = { graduated: first.graduated, alumniMemberships: first.alumniMemberships }
  for (let i = 0; i < 10; i++) {
    const next = await run('2026-08-01T05:00:00Z', { profiles: 2, memberships: 2 })
    total.graduated += next.graduated; total.alumniMemberships += next.alumniMemberships
    if (!next.more) { assert.equal(next.retainedOwners, 3, 'duo1, duo2 and solo are kept as owners'); break }
  }
  const p = await profiles(db)
  for (const id of ['senior', 'owner1', 'owner2', 'soloowner']) assert.equal(p[id], '2026-08-01T04:00:00Z', `${id} defaulted to Aug 1`)
  assert.equal(p.confirmed, '2026-08-01T04:00:00Z', 'a confirmed answer is kept')
  assert.equal(p.junior, null); assert.equal(p.owner3, null)
  assert.deepEqual(await alumni(db), ['m-confirmed', 'm-owner1', 'm-senior', 'm-solo-senior'], 'chess owner1 converts (owner3 remains); duo and solo owners are retained')
  assert.equal((await db.query(`SELECT "alumniSince" FROM "ClubMember" WHERE id='m-senior'`)).rows[0].alumniSince.toISOString(), '2026-08-01T04:00:00.000Z', 'alumniSince = graduatedAt (lets a defaulted student be restored exactly)')

  const audits = (await db.query(`SELECT "actorId", action, "clubId", "targetId" FROM "AuditLog" ORDER BY action, "targetId"`)).rows
  assert.ok(audits.every(a => a.actorId === GRADUATION_JOB_ACTOR))
  assert.deepEqual(audits.filter(a => a.action === 'club.member.alumni').map(a => [a.clubId, a.targetId]), [['chess', 'm-confirmed'], ['chess', 'm-owner1'], ['chess', 'm-senior'], ['solo', 'm-solo-senior']])
  assert.equal(audits.filter(a => a.action === 'student.graduation.default').length, 5, 'old, senior, owner1, owner2, soloowner')

  // Idempotent: another run (same day or later) changes nothing and writes no audit.
  const auditCount = audits.length
  assert.deepEqual(await run('2026-08-02T09:23:00Z'), { graduated: 0, alumniMemberships: 0, retainedOwners: 3, more: false })
  assert.equal((await db.query(`SELECT count(*)::int n FROM "AuditLog"`)).rows[0].n, auditCount)

  // Once the club adds a current owner, the retained owner converts on the next run.
  await db.exec(`INSERT INTO "ClubMember"(id,"clubId","userId","isOwner","accessRole") VALUES('m-solo-new','solo','junior',true,'OWNER')`)
  const later = await run('2026-08-03T09:23:00Z')
  assert.equal(later.alumniMemberships, 1)
  assert.ok((await alumni(db)).includes('m-solo'))
})

test('graduation job: an alumni co-owner does not count as the remaining owner; other clubs are untouched', { timeout: 240000 }, async t => {
  const db = await migratedDatabase(t)
  await db.exec(`INSERT INTO "Club"(id,slug,name,tagline,description,color,category) VALUES('a','a','A','','','#142d4e','Academic'),('b','b','B','','','#142d4e','Academic');
    INSERT INTO "User"(id,email) VALUES('grad','g@virginia.edu'),('alum','al@virginia.edu'),('cur','c@virginia.edu');
    INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear") VALUES('p1','grad','G','L','grad','Econ',2026),('p3','cur','C','L','cur','Econ',2029);
    INSERT INTO "ClubMember"(id,"clubId","userId","isOwner","alumniSince") VALUES('a-grad','a','grad',true,NULL),('a-alum','a','alum',true,'2025-08-01 04:00:00'),('b-cur','b','cur',false,NULL);`)
  const result = await job().runGraduationJob(jobDb(db), new Date('2026-09-01T12:00:00Z'))
  assert.equal(result.graduated, 1); assert.equal(result.alumniMemberships, 0); assert.equal(result.retainedOwners, 1)
  assert.deepEqual(await alumni(db), ['a-alum'], 'only the earlier alumnus; the current student in club b is untouched')
})

test('graduation cron route: bearer secret required, job result returned, failures retained as 503', async () => {
  const calls = []
  const route = (impl) => load('app/api/internal/graduation/route.ts', {
    'node:crypto': require('node:crypto'), '@/utils/prisma': { prisma: { tag: 'db' } },
    '@/utils/graduation': { runGraduationJob: async (db, now, limits) => { calls.push({ db, now, limits }); return impl() } },
  })
  const req = secret => new Request('https://out-class.net/api/internal/graduation', secret === undefined ? {} : { headers: { authorization: `Bearer ${secret}` } })
  const previous = process.env.CRON_SECRET, previousFlag = process.env.OUTCLASS_GRADUATION_JOB_ENABLED
  try {
    process.env.CRON_SECRET = 'cron-secret'
    delete process.env.OUTCLASS_GRADUATION_JOB_ENABLED
    const off = route(async () => ({ graduated: 9 }))
    const skipped = await off.GET(req('cron-secret'))
    assert.equal(skipped.status, 200); assert.deepEqual(await skipped.json(), { skipped: 'disabled' })
    assert.equal(calls.length, 0, 'the job does nothing until the owner enables it')
    assert.equal((await off.GET(req('wrong'))).status, 401, 'the secret is still checked first')
    process.env.OUTCLASS_GRADUATION_JOB_ENABLED = 'true'
    const ok = route(async () => ({ graduated: 1, alumniMemberships: 2, retainedOwners: 0, more: false }))
    for (const secret of [undefined, 'wrong', 'cron-secret2', '']) assert.equal((await ok.GET(req(secret))).status, 401)
    assert.equal(calls.length, 0, 'no work without the secret')
    const response = await ok.GET(req('cron-secret'))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { graduated: 1, alumniMemberships: 2, retainedOwners: 0, more: false })
    assert.equal(calls[0].limits.profiles, 500)
    assert.equal((await route(async () => { throw Error('db down') }).POST(req('cron-secret'))).status, 503)
    delete process.env.CRON_SECRET
    assert.equal((await ok.GET(req('undefined'))).status, 401, 'an unset secret never matches')
    const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
    assert.deepEqual(vercel.crons.find(c => c.path === '/api/internal/graduation'), { path: '/api/internal/graduation', schedule: '23 9 * * *' }, 'daily, after 5 AM Eastern')
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous
    if (previousFlag === undefined) delete process.env.OUTCLASS_GRADUATION_JOB_ENABLED; else process.env.OUTCLASS_GRADUATION_JOB_ENABLED = previousFlag
  }
})

// ---- Server-side rules at their call sites ----

const src = file => fs.readFileSync(file, 'utf8')
test('apply: alumni cannot submit, checked server-side with a friendly ActionError', () => {
  const s = src('actions/applications.ts')
  assert.match(s, /if \(!profile\) throw new ActionError[^\n]*\n\s*\/\/[^\n]*\n\s*if \(isAlumniProfile\(profile\)\) throw new ActionError\(ALUMNI_APPLY_MESSAGE\)/)
  assert.match(s, /return actionResult\(\(\) => persistApplication\(data, true\), "submitApplication"\)/)
  assert.match(g.ALUMNI_APPLY_MESSAGE, /^Congratulations/)
})

test('alumni are excluded from member counts, audiences, exports and member-only reads', () => {
  const pins = {
    'utils/recipient-audience.ts': [/const memberScope = \(clubId: string\) => \(\{ clubId, \.\.\.activeMemberWhere \}\)/],
    'lib/communications-policy.ts': [/communicationManager = \{ \.\.\.activeMemberWhere,/, /\.\.\.activeMemberWhere, club: \{ suspendedAt: null \}/, /!isActiveMembership\(studentMember\)/],
    'lib/communications-snapshot.ts': [/s\.status='ACTIVE' AND s\."alumniSince" IS NULL\)[\s\S]*m\.status='ACTIVE' AND m\."alumniSince" IS NULL[\s\S]*s\.status='ACTIVE' AND s\."alumniSince" IS NULL\)/],
    'lib/club-exports.ts': [/where: \{ clubId, \.\.\.activeMemberWhere \}/],
    'actions/club-overview.ts': [/clubMember\.count\(\{ where: \{ clubId, \.\.\.activeMemberWhere, user: \{ disabledAt: null \} \} \}\)/],
    'actions/admin-clubs.ts': [/members: \{ where: activeMemberWhere \}/],
    'actions/recipient-groups.ts': [/clubId, \.\.\.activeMemberWhere, user: \{ disabledAt: null \}/],
    'actions/tasks.ts': [/where: \{ clubId, \.\.\.activeMemberWhere, user: \{ disabledAt: null \} \}, select: memberSelect/],
    'actions/meetings.ts': [/members: \{ some: \{ userId: user\.id, \.\.\.activeMemberWhere \} \}/],
    'utils/calendar-feed.ts': [/userId, \.\.\.activeMemberWhere, club: \{ suspendedAt: null \}/],
    'actions/applications.ts': [/members: \{ some: \{ userId: user\.id, \.\.\.activeMemberWhere \} \}/],
    'lib/member-groups.ts': [/member\.status !== "ACTIVE" \|\| member\.alumniSince/],
    'utils/interview-access.ts': [/member\.alumniSince/],
    'actions/organization-members.ts': [/!target\.alumniSince && await tx\.clubMember\.count\(\{ where: \{ clubId, id: \{ not: target\.id \}, isOwner: true, \.\.\.activeMemberWhere/, /data\.action === "PERMISSIONS" && targets\.some\(t => t\.alumniSince\)/],
    'actions/account-deletion.ts': [/const owned = await prisma\.clubMember\.findMany\(\{ where: \{ userId, isOwner: true, \.\.\.activeMemberWhere \}/],
    'components/organization-member-management.tsx': [/member\.status === "ACTIVE" && member\.alumniSince \? "Alumni"/],
  }
  for (const [file, patterns] of Object.entries(pins)) for (const pattern of patterns) assert.match(src(file), pattern, file)
  // Raw membership filters left on status alone are reviewed: own history, roster matching and admin filters.
  const remaining = []
  for (const dir of ['actions', 'utils', 'lib', 'app']) for (const file of fs.readdirSync(dir, { recursive: true })) {
    const full = path.join(dir, String(file))
    if (!/\.tsx?$/.test(full) || full.startsWith(path.join('lib', 'demo'))) continue
    for (const line of src(full).split('\n')) if (/status: ?"ACTIVE"(?! as const)/.test(line) && !/activeMemberWhere = /.test(line)) remaining.push(full)
  }
  // platform-admin: admin user filters; roster-import and club-onboarding: an alumnus is already on the
  // roster; tasks: the student's own assignment history; account-data: the signed-in user's own memberships
  // (shown as Alumni); graduation: the restore itself.
  assert.deepEqual([...new Set(remaining)].sort(), ['actions/platform-admin.ts', 'actions/roster-import.ts', 'actions/tasks.ts', 'lib/account-data.ts', 'utils/club-onboarding.ts', 'utils/graduation.ts'].sort())
})

test('a gradYear change runs inside each profile write transaction', () => {
  assert.match(src('actions/profile.ts'), /prisma\.\$transaction\(async tx => \{\n\s*await applyGraduationYearChange\(tx, user\.id, parsed\.gradYear\);/)
  assert.match(src('actions/profile.ts'), /if \(yearChange !== undefined\) await applyGraduationYearChange\(tx, user\.id, yearChange\);\n\s*return update\(tx\);/)
  assert.match(src('actions/resume-import.ts'), /if \(patch\.gradYear !== undefined\) await applyGraduationYearChange\(tx, user\.id, patch\.gradYear\)/)
  const actions = src('actions/graduation.ts')
  assert.match(actions, /if \(impersonation\) throw new ActionError/)
  assert.match(actions, /actionResult\(confirmGraduationCommand, "confirmGraduation"\)/)
  assert.doesNotMatch(actions + src('utils/graduation.ts'), /sendEmail|enqueue|resend|notification/i, 'this PR sends nothing')
})

test('applyGraduationYearChange restores exactly the memberships the job converted', async () => {
  const { applyGraduationYearChange } = job()
  const writes = []
  const graduatedAt = new Date('2026-08-01T04:00:00Z')
  const tx = {
    studentProfile: { findUnique: async () => ({ id: 'p1', gradYear: 2026, graduatedAt, graduationConfirmedAt: null, graduationPromptDismissedAt: null }), update: async a => writes.push(['profile', a]) },
    clubMember: { updateMany: async a => { writes.push(['members', a]); return { count: 2 } } },
    auditLog: { create: async a => writes.push(['audit', a]) },
  }
  await applyGraduationYearChange(tx, 'u1', 2027, new Date('2026-09-01T12:00:00Z'))
  assert.deepEqual(writes[0], ['profile', { where: { id: 'p1' }, data: { graduatedAt: null, graduationConfirmedAt: null, graduationPromptDismissedAt: null } }])
  assert.deepEqual(writes[1], ['members', { where: { userId: 'u1', status: 'ACTIVE', alumniSince: graduatedAt }, data: { alumniSince: null } }])
  assert.equal(writes[2][1].data.action, 'student.graduation.reverse')
  writes.length = 0
  assert.equal(await applyGraduationYearChange(tx, 'u1', 2026), null)
  assert.equal(writes.length, 0)
})
