const { unwrapActions } = require('./helpers/action-result.cjs');
// Alumni part 2 (lib/graduation.ts, utils/graduation.ts, actions/graduation.ts, actions/club-alumni.ts):
// alumni are refused every active feature server-side, the employer is validated and saved, the
// placement merge is idempotent and anonymous, the Alumni tab is for current members only, and both
// opt-outs are respected.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), ts = require('typescript')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const req = name => {
    if (name in mocks) return mocks[name]
    if (name.startsWith('@/')) {
      const base = name.slice(2)
      const found = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(f => fs.existsSync(f))
      if (!found) throw Error(`Unexpected import ${name}`)
      return load(found, mocks)
    }
    return require(name)
  }
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports)
  return mod.exports
}
const src = file => fs.readFileSync(file, 'utf8')
const g = load('lib/graduation.ts')
const ALUMNI_AT = new Date('2026-08-01T04:00:00Z')

// ---- Employer validation ----

test('employer and role: optional, trimmed, bounded to 100, names only; choices default on; strict', () => {
  const ok = g.postGradDetailsSchema.parse({ employer: '  Goldman   Sachs ', role: '', showInAlumniList: false })
  assert.deepEqual(ok, { employer: 'Goldman Sachs', role: null, showInAlumniList: false, shareEmployer: true })
  assert.deepEqual(g.postGradDetailsSchema.parse({}), { employer: null, role: null, showInAlumniList: true, shareEmployer: true })
  assert.equal(g.postGradDetailsSchema.parse({ employer: 'x'.repeat(100) }).employer.length, 100)
  for (const bad of [{ employer: 'x'.repeat(101) }, { role: 'y'.repeat(101) }, { employer: 'https://evil.example' }, { employer: 'me@virginia.edu' }, { employer: 'www.acme.com' }, { employer: 'A<script>' }, { employer: 'Acme\u0000' }, { employer: 42 }])
    assert.equal(g.postGradDetailsSchema.safeParse(bad).success, false, JSON.stringify(bad))
  assert.equal(g.postGradDetailsSchema.safeParse({ employer: 'Acme', firstName: 'Ada' }).success, false, 'no other fields (never a name for the placement)')
  assert.match(g.postGradDetailsSchema.safeParse({ employer: 'x'.repeat(101) }).error.issues[0].message, /100 characters/)
})

test('employer text: invisible format characters and C1 controls stripped, whitespace normalized, bare domains refused', () => {
  const parse = employer => g.postGradDetailsSchema.parse({ employer }).employer
  assert.equal(parse('Goo\u200bgle'), 'Google', 'zero-width space')
  assert.equal(parse('\u202eelgooG\u202c'), 'elgooG', 'bidi override and pop')
  assert.equal(parse('Ac\u00adme\u2066 Corp\u2069\ufeff'), 'Acme Corp', 'soft hyphen, isolates, BOM')
  assert.equal(parse('Acme\u0085\u009b  Corp'), 'Acme Corp', 'C1 controls')
  assert.equal(parse(' Acme\t\n Corp\u00a0 '), 'Acme Corp', 'whitespace collapsed')
  assert.equal(parse('\u200b\u200d'), null, 'nothing visible left: no employer')
  for (const bad of ['acme.com', 'Visit ACME.IO', 'my-startup.dev', 'example.co', 'school.edu', 'thing.xyz', 'a.app', 'x.org', 'y.net', 'acme\u200b.com'])
    assert.equal(g.postGradDetailsSchema.safeParse({ employer: bad }).success, false, bad)
  for (const good of ['J.P. Morgan', 'Johnson & Co.', 'Amazon Web Services', 'U.S. Navy', 'Deloitte (Consulting)'])
    assert.equal(parse(good), good, good)
  assert.equal(g.cleanPostGradText('A\u200bB\u0080C'), 'ABC')
  assert.equal(g.placementKey('Goo\u200bgle '), 'google')
})

test('saving: confirmation and later edits validate, store and share in one transaction, account holder only', () => {
  const a = src('actions/graduation.ts')
  assert.match(a, /if \(impersonation\) throw new ActionError/)
  assert.match(a, /boundedSafeParse\(postGradDetailsSchema, input \?\? \{\}\)[\s\S]*throw new ActionError\(parsed\.error\.issues\[0\]\?\.message/)
  assert.match(a, /data: \{ graduatedAt, graduationConfirmedAt: now, \.\.\.detailsData\(details\) \}[\s\S]*return \(await shareGraduatePlacement\(tx, userId, now\)\)\.clubIds/)
  assert.match(a, /postGradEmployer: d\.employer, postGradRole: d\.role, alumniDirectoryVisible: d\.showInAlumniList, alumniPlacementShare: d\.shareEmployer/)
  assert.match(a, /if \(!profile\.graduationConfirmedAt && !isAlumniProfile\(profile\)\) throw new ActionError/)
  assert.match(a, /actionResult\(\(\) => saveAlumniDetailsCommand\(input\), "saveAlumniDetails"\)/)
  // Both writes are rate limited per account with the shared limiter, after the support-session check.
  assert.match(a, /if \(impersonation\) throw new ActionError[^\n]*\n\s*if \(options\.limited\) await limitDetails\(user\.id\)\n\s*const clubIds = await prisma\.\$transaction/)
  assert.match(a, /limitAction\(RATE_LIMITS\.alumniDetails, \{ userId \}\)\)\.ok\) throw new ActionError\(RATE_LIMIT_MESSAGE, "RATE_LIMITED"\)/)
  assert.equal((a.match(/\}, \{ limited: true \}\)/g) || []).length, 2, 'confirmGraduation and saveAlumniDetails')
  const { RATE_LIMITS } = load('lib/rate-limit-core.ts')
  assert.deepEqual(RATE_LIMITS.alumniDetails, { name: 'alumni-details', limit: 20, windowMs: 600000 })
  assert.match(src('docs/rate-limits.md'), /`saveAlumniDetails`\) \| account \| 20 \/ 10 min/)
  assert.doesNotMatch(a, /employer: details\.employer|details: \{[^}]*postGradEmployer/, 'audit rows record only whether an employer was given')
})

// ---- Placement merge ----

test('mergePlacement: appends company names once (any case or spacing), never evicts a full list', () => {
  assert.deepEqual(g.mergePlacement(['McKinsey'], ' Goldman  Sachs '), ['McKinsey', 'Goldman Sachs'])
  assert.equal(g.mergePlacement(['goldman sachs'], 'Goldman Sachs'), null)
  assert.equal(g.mergePlacement(['A'], '   '), null)
  assert.equal(g.mergePlacement(Array.from({ length: 20 }, (_, i) => `Firm ${i}`), 'New Firm'), null, 'leader-curated entries stay')
  assert.deepEqual(g.mergePlacement(undefined, 'Acme'), ['Acme'])
  assert.deepEqual(g.mergePlacement('not a list', 'Acme'), ['Acme'])
})

function placementTx({ profile, memberships, clubs }) {
  const log = { audits: [], profileUpdates: [], locks: [] }
  const tx = {
    $queryRaw: async (strings, ...values) => { log.locks.push(values[0]); return [] },
    studentProfile: {
      findUnique: async () => profile && structuredClone(profile),
      update: async ({ data }) => { log.profileUpdates.push(data); profile.alumniPlacementClubIds = [...profile.alumniPlacementClubIds, ...data.alumniPlacementClubIds.push] },
    },
    clubMember: { findMany: async ({ where, orderBy }) => {
      assert.deepEqual(where, { userId: 'grad', status: 'ACTIVE', clubId: { notIn: profile.alumniPlacementClubIds } }); assert.deepEqual(orderBy, { clubId: 'asc' })
      return memberships.filter(clubId => !where.clubId.notIn.includes(clubId)).map(clubId => ({ clubId }))
    } },
    club: { findUnique: async ({ where }) => where.id in clubs ? { marketing: structuredClone(clubs[where.id]), suspendedAt: (suspended.has(where.id) ? new Date() : null) } : null, update: async ({ where, data }) => { clubs[where.id] = data.marketing } },
    auditLog: { create: async ({ data }) => log.audits.push(data) },
  }
  const suspended = new Set()
  return { tx, log, suspended }
}
const utils = () => load('utils/graduation.ts')
const graduate = (extra = {}) => ({ id: 'p-grad', graduatedAt: ALUMNI_AT, graduationConfirmedAt: new Date('2026-05-01T12:00:00Z'), postGradEmployer: 'Goldman Sachs', alumniPlacementShare: true, alumniPlacementClubIds: [], ...extra })

test('placement merge: company name only into each roster club, once per club, audited without identity', async () => {
  const { shareGraduatePlacement, GRADUATION_JOB_ACTOR, ALUMNI_PLACEMENT_AUDIT } = utils()
  const profile = graduate()
  const clubs = { a: { placements: ['McKinsey'], outcomesNote: 'Kept', sections: [] }, b: null, c: { placements: ['GOLDMAN SACHS'] } }
  const { tx, log } = placementTx({ profile, memberships: ['a', 'b', 'c'], clubs })
  const now = new Date('2026-08-02T00:00:00Z')
  assert.deepEqual(await shareGraduatePlacement(tx, 'grad', now), { clubIds: ['a', 'b'] })
  assert.deepEqual(clubs.a, { placements: ['McKinsey', 'Goldman Sachs'], outcomesNote: 'Kept', sections: [] }, 'other marketing fields untouched')
  assert.deepEqual(clubs.b, { placements: ['Goldman Sachs'] })
  assert.deepEqual(clubs.c, { placements: ['GOLDMAN SACHS'] }, 'already listed (any case): unchanged')
  assert.deepEqual(log.locks, ['a', 'b', 'c'], 'clubs locked in id order')
  assert.deepEqual(log.audits.map(a => [a.actorId, a.action, a.clubId, a.details]), [[GRADUATION_JOB_ACTOR, ALUMNI_PLACEMENT_AUDIT, 'a', { source: 'graduation', placement: 'Goldman Sachs' }], [GRADUATION_JOB_ACTOR, ALUMNI_PLACEMENT_AUDIT, 'b', { source: 'graduation', placement: 'Goldman Sachs' }]])
  assert.doesNotMatch(JSON.stringify({ clubs, audits: log.audits }), /grad\b|p-grad|virginia\.edu/, 'no user id, profile id or email in what was written')
  assert.deepEqual(log.profileUpdates, [{ alumniPlacementClubIds: { push: ['a', 'b', 'c'] } }], 'every club that received or already listed it is recorded')
  // Repeat (another save, a retried request): nothing is read or changed for recorded clubs.
  log.locks.length = 0
  assert.deepEqual(await shareGraduatePlacement(tx, 'grad', now), { clubIds: [] })
  assert.deepEqual(log.locks, [], 'recorded clubs are not even locked')
  assert.equal(log.audits.length, 2); assert.equal(log.profileUpdates.length, 1)
})

test('placement merge: A, leader removes it, then B, then A again never re-adds anything (one share per club, ever)', async () => {
  const { shareGraduatePlacement } = utils()
  const profile = graduate({ postGradEmployer: 'Acme' })
  const clubs = { a: { placements: ['McKinsey'] }, b: { placements: [] } }
  const { tx, log } = placementTx({ profile, memberships: ['a', 'b'], clubs })
  const now = new Date('2026-08-02T00:00:00Z')
  assert.deepEqual((await shareGraduatePlacement(tx, 'grad', now)).clubIds, ['a', 'b'])
  clubs.a.placements = ['McKinsey'] // a leader removes "Acme"
  for (const employer of ['Bain', 'Acme', 'ACME', 'Bain & Company']) {
    profile.postGradEmployer = employer
    assert.deepEqual(await shareGraduatePlacement(tx, 'grad', now), { clubIds: [] }, employer)
  }
  assert.deepEqual(clubs, { a: { placements: ['McKinsey'] }, b: { placements: ['Acme'] } }, 'the removal is respected and B never added')
  assert.equal(log.audits.length, 2)
  // A club the graduate joins later (never shared to) can still receive the current employer once.
  clubs.d = { placements: [] }
  const later = placementTx({ profile, memberships: ['a', 'b', 'd'], clubs })
  assert.deepEqual((await shareGraduatePlacement(later.tx, 'grad', now)).clubIds, ['d'])
  assert.deepEqual(clubs.d.placements, ['Bain & Company'])
  assert.deepEqual(profile.alumniPlacementClubIds, ['a', 'b', 'd'])
})

test('placement merge: suspended clubs and full lists are skipped and not recorded', async () => {
  const { shareGraduatePlacement } = utils()
  const profile = graduate()
  const clubs = { a: { placements: [] }, f: { placements: Array.from({ length: 20 }, (_, i) => `Firm ${i}`) } }
  const { tx, log, suspended } = placementTx({ profile, memberships: ['a', 'f'], clubs })
  suspended.add('a')
  const now = new Date('2026-08-02T00:00:00Z')
  assert.deepEqual(await shareGraduatePlacement(tx, 'grad', now), { clubIds: [] })
  assert.deepEqual(clubs.a.placements, [], 'suspended club untouched')
  assert.equal(clubs.f.placements.length, 20, 'leader entries never evicted')
  assert.equal(log.audits.length, 0); assert.equal(log.profileUpdates.length, 0, 'nothing recorded, so a restored club can still receive it once')
  suspended.delete('a')
  assert.deepEqual((await shareGraduatePlacement(tx, 'grad', now)).clubIds, ['a'])
  assert.match(src('utils/graduation.ts'), /select: \{ marketing: true, suspendedAt: true \} \}\)\n\s*\/\/[^\n]*\n\s*if \(!club \|\| club\.suspendedAt\) continue/)
})

test('placement merge respects the opt-out and runs only for confirmed graduates or alumni', async () => {
  const { shareGraduatePlacement } = utils()
  const now = new Date('2026-06-01T00:00:00Z')
  for (const profile of [graduate({ alumniPlacementShare: false }), graduate({ postGradEmployer: null }), graduate({ graduatedAt: null, graduationConfirmedAt: null }), null]) {
    const clubs = { a: { placements: [] } }
    const { tx, log } = placementTx({ profile: profile ?? graduate(), memberships: ['a'], clubs })
    if (!profile) tx.studentProfile.findUnique = async () => null
    assert.deepEqual(await shareGraduatePlacement(tx, 'grad', now), { clubIds: [] })
    assert.deepEqual(clubs.a.placements, []); assert.equal(log.audits.length, 0); assert.equal(log.profileUpdates.length, 0)
  }
  // Confirmed in May (graduatedAt Aug 1 still ahead) shares at confirmation.
  const clubs = { a: { placements: [] } }
  const { tx } = placementTx({ profile: graduate(), memberships: ['a'], clubs })
  assert.deepEqual((await shareGraduatePlacement(tx, 'grad', now)).clubIds, ['a'])
})

// ---- Alumni refused every active feature ----

test('alumniRefusal / assertNotAlumni: friendly ActionError for alumni only', async () => {
  const { assertNotAlumni, alumniRefusal } = utils()
  const { isActionError } = load('lib/action-result.ts')
  const db = graduatedAt => ({ studentProfile: { findUnique: async ({ where, select }) => { assert.deepEqual(select, { graduatedAt: true }); assert.equal(where.userId, 'u'); return graduatedAt === undefined ? null : { graduatedAt } } } })
  const now = new Date('2026-09-01T00:00:00Z')
  for (const action of Object.keys(g.ALUMNI_REFUSALS)) {
    await assert.rejects(assertNotAlumni(db(ALUMNI_AT), 'u', action, now), e => isActionError(e) && e.code === g.ALUMNI_REFUSED && e.message === g.ALUMNI_REFUSALS[action])
    await assertNotAlumni(db(new Date('2027-08-01T04:00:00Z')), 'u', action, now)
    await assertNotAlumni(db(null), 'u', action, now)
    await assertNotAlumni(db(undefined), 'u', action, now)
  }
  assert.equal(await alumniRefusal(db(ALUMNI_AT), 'u', 'rsvp', now), g.ALUMNI_REFUSALS.rsvp)
})

test('server: alumni cannot apply (drafts too), RSVP (public events too), check in, vote or join', () => {
  const pins = {
    'actions/applications.ts': /FOR UPDATE`\n\s*\/\/[^\n]*\n\s*await assertNotAlumni\(tx, user\.id, "apply"\)\n\s*const configuration/,
    'actions/club-directory.ts': /if \(existing\) return \{ applicationId: existing\.id \};[\s\S]{0,300}alumniRefusal\(tx, user\.id, "apply"\);\n\s*if \(alumni\) return \{ applicationId: null, unavailable: alumni \};\n\s*await assertClubOperational/,
    'actions/campus-events.ts': /if \(d\.going\) \{\n\s*const refusal = await alumniRefusal\(prisma, user\.id, "rsvp"\);\n\s*if \(refusal\) return \{ ok: false, error: refusal \};/,
    'actions/meetings.ts': /const \{ user \} = await requireAuth\(\);\n\s*\/\/[^\n]*\n\s*await assertNotAlumni\(prisma, user\.id, "checkIn"\);/,
    'actions/voting-room.ts': /\{sharedClubLock:true\}\);\n\s*\/\/[^\n]*\n\s*const alumni=await alumniRefusal\(tx,user\.id,"vote"\);\n\s*if\(alumni\)throw new RoomConflict\(ALUMNI_REFUSED,alumni\);\n\s*const \{s,round\}=await loadVotingRoom/,
    'utils/recruitment-offers.ts': /\/\/ Alumni cannot join[^\n]*\n\s*await assertNotAlumni\(tx, userId, "join"\);\n\s*if \(!existing\) await tx\.clubMember\.create/,
    'utils/club-onboarding.ts': /await assertNotAlumni\(tx, account\.user\.id, "join"\);\n\s*const where = \{ userId_clubId/,
  }
  for (const [file, pattern] of Object.entries(pins)) assert.match(src(file), pattern, file)
  // Announcements reach current members only (part 1 audience filters).
  assert.match(src('utils/recipient-audience.ts'), /const memberScope = \(clubId: string\) => \(\{ clubId, \.\.\.activeMemberWhere \}\)/)
  // Data export and account deletion stay available: neither refuses alumni.
  for (const file of ['actions/account-deletion.ts', 'app/api/users/me/route.ts']) assert.doesNotMatch(src(file), /assertNotAlumni|alumniRefusal/, file)
})

test('RSVP and check-in actions refuse alumni before any write', async () => {
  const prisma = { studentProfile: { findUnique: async () => ({ graduatedAt: ALUMNI_AT }) }, $transaction: async () => assert.fail('no transaction for alumni') }
  const common = {
    '@/utils/prisma': { prisma }, '@/utils/auth': { requireAuth: async () => ({ user: { id: 'grad' } }), requireClubPermission: async () => assert.fail() },
    'next/cache': { revalidatePath() {}, revalidateTag() {} },
  }
  const events = load('actions/campus-events.ts', { ...common, '@/utils/club-write-transaction': { clubWriteTransaction: async () => assert.fail('no RSVP write'), isWriteContention: () => false }, '@/utils/platform-admin': {}, '@/lib/club-transaction-authorization': {} })
  const eventId = '00000000-0000-4000-8000-000000000001'
  assert.deepEqual(await events.setCampusEventRsvp({ eventId, going: true }), { ok: false, error: g.ALUMNI_REFUSALS.rsvp })
  await assert.rejects(events.setCampusEventRsvp({ eventId, going: false }), /no RSVP write/, 'cancelling is still allowed (reaches the write)')
  const meetings = load('actions/meetings.ts', { ...common, '@/lib/short-link-store': {} })
  assert.deepEqual(await meetings.checkInMeeting(eventId, 'a'.repeat(64)), { $action: 'outclass.action/v1', ok: false, error: g.ALUMNI_REFUSALS.checkIn, code: g.ALUMNI_REFUSED })
})

test('UI: RSVP, check-in and Start application are replaced for alumni', () => {
  assert.match(src('components/events/public-event-board.tsx'), /if \(alumni && !going && !loading\)\n\s*return <p[^>]*>Alumni accounts can’t RSVP\.<\/p>;/)
  assert.match(src('components/qr/meeting-check-in.tsx'), /isAlumniProfile\(user\.profile\) \? \(\n\s*<p role="status">\{ALUMNI_REFUSALS\.checkIn\}<\/p>/)
  assert.match(src('components/views/club-profile-view.tsx'), /const applyDisabled = preview \|\| busy \|\| alumni \|\|/)
})

// ---- Graduate kept as owner: hand-over yes, recruiting judgment no ----

const OWNER_CLUB = '00000000-0000-4000-8000-000000000001'
const keptOwner = { id: 'm-owner', clubId: OWNER_CLUB, userId: 'owner', status: 'ACTIVE', alumniSince: null, isOwner: true, permissions: [] }
const profileRows = graduatedAt => async (strings, ...values) => {
  const sql = strings.join('?')
  if (sql.includes('FROM auth.sessions')) return [{ live: true }]
  if (sql.includes('FROM "StudentProfile"')) { assert.match(sql, /SELECT "graduatedAt" FROM "StudentProfile" WHERE "userId" = \?/); assert.equal(values[0], 'owner'); return graduatedAt === undefined ? [] : [{ graduatedAt }] }
  return []
}
function authApi(graduatedAt) {
  const queries = []
  const prisma = {
    $queryRaw: async (strings, ...values) => { queries.push(strings.join('?')); return profileRows(graduatedAt)(strings, ...values) },
    user: { findUnique: async () => ({ id: 'owner', email: 'owner@virginia.edu', role: 'STUDENT', disabledAt: null }) },
    clubMember: { findUnique: async () => keptOwner },
  }
  const api = load('utils/auth.ts', {
    '@/utils/platform-view-as': { platformViewSession: async () => null },
    './supabase/server': { createClient: async () => ({ auth: { getSession: async () => require('./helpers/auth-session.cjs').sessionFor('owner'), getUser: async () => ({ data: { user: { id: 'owner', email: 'owner@virginia.edu', email_confirmed_at: '2026-01-01' } }, error: null }) } }) },
    'next/headers': { headers: async () => new Headers(), cookies: async () => ({ has: () => false, get: () => undefined }) },
    './prisma': { prisma },
    'next/navigation': { redirect: () => { throw new Error('Unauthenticated') } },
    react: { cache: fn => fn },
  })
  return { api, queries }
}
const refusedJudgment = e => e?.code === g.ALUMNI_REFUSED && e.message === g.ALUMNI_REFUSALS.review

test('kept-owner graduate: requireClubPermission refuses decision votes and reviews, keeps member management', async () => {
  const { api, queries } = authApi(ALUMNI_AT)
  // Decision votes outside the live room (e.g. raising a discussion, closing a board session) and reviews.
  for (const caps of [['applications.review', 'decisions.vote'], ['applications.review', 'decisions.start'], ['decisions.manage'], ['applications.review']])
    await assert.rejects(api.requireClubPermission(OWNER_CLUB, caps), refusedJudgment, caps.join())
  // Hand-over: members, roles, settings, and plain membership checks.
  for (const caps of [['members.manage'], ['leaders.manage'], ['club.settings'], []]) {
    const before = queries.filter(q => q.includes('StudentProfile')).length
    assert.equal((await api.requireClubPermission(OWNER_CLUB, caps)).membership, keptOwner, caps.join())
    assert.equal(queries.filter(q => q.includes('StudentProfile')).length, before, 'no graduation read for non-judgment checks')
  }
  // A current student owner is unaffected.
  const student = authApi(new Date('2027-08-01T04:00:00Z'))
  await student.api.requireClubPermission(OWNER_CLUB, ['applications.review', 'decisions.vote'])
  await authApi(undefined).api.requireClubPermission(OWNER_CLUB, ['applications.review'])
})

test('kept-owner graduate: the in-transaction recheck and interview access (evaluations) refuse judgment too', async () => {
  const { authorizeClubTransaction } = load('lib/club-transaction-authorization.ts', { '@/lib/club-suspension': { assertClubOperational: async () => {} } })
  const tx = graduatedAt => ({ $queryRaw: profileRows(graduatedAt), user: { findUnique: async () => ({ disabledAt: null }) }, clubMember: { findUnique: async () => ({ ...keptOwner, user: { disabledAt: null } }) } })
  await assert.rejects(authorizeClubTransaction(tx(ALUMNI_AT), OWNER_CLUB, 'owner', ['applications.review', 'decisions.vote']), refusedJudgment)
  assert.equal((await authorizeClubTransaction(tx(ALUMNI_AT), OWNER_CLUB, 'owner', ['members.manage'])).id, 'm-owner', 'member management still allowed')
  assert.equal((await authorizeClubTransaction(tx(null), OWNER_CLUB, 'owner', ['applications.review'])).id, 'm-owner', 'current student owner')

  // Evaluation saves go through interviewActor (submitEvaluation, interview kits and rooms).
  const access = load('utils/interview-access.ts', { '@/lib/club-suspension': { assertClubOperational: async () => {} } })
  await assert.rejects(access.interviewActor(tx(ALUMNI_AT), OWNER_CLUB, 'owner'), refusedJudgment)
  assert.equal((await access.interviewActor(tx(null), OWNER_CLUB, 'owner')).member.id, 'm-owner')
  const evaluations = load('actions/evaluations.ts', {
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'owner' } }) },
    '@/utils/prisma': { prisma: { $transaction: async work => work({ ...tx(ALUMNI_AT), application: { findFirst: async () => assert.fail('no application read') } }) } },
    '@/lib/club-suspension': { assertClubOperational: async () => {} },
    '@/actions/interview-kits': {},
  })
  // submitEvaluation returns its refusals (interviewActionResult) rather than throwing them.
  const refused = await evaluations.submitEvaluation({ clubId: OWNER_CLUB, applicationId: '00000000-0000-4000-8000-0000000000a1', roundName: 'Interview', score: 4 })
  assert.equal(refused.ok, false)
  assert.equal(refused.code, g.ALUMNI_REFUSED)
  assert.equal(refused.error, g.ALUMNI_REFUSALS.review)
  // One shared path: the three checks call the same helper.
  assert.match(src('utils/auth.ts'), /await assertGraduateMayJudge\(prisma, user\.id, permissions\);\n\s*if \(!options\.allowSuspendedRead\)/)
  assert.match(src('lib/club-transaction-authorization.ts'), /await assertGraduateMayJudge\(tx, userId, permissions\);/)
  assert.match(src('utils/interview-access.ts'), /await assertGraduateMayJudge\(tx, userId\);\n\s*return \{ member, caps/)
  assert.deepEqual([...g.RECRUITING_JUDGMENT_PERMISSIONS].sort(), ['applications.review', 'decisions.finish', 'decisions.manage', 'decisions.publish', 'decisions.reopen', 'decisions.start', 'decisions.vote'])
})

test('kept-owner graduate: club workspace shows the hand-over notice linking to member management', () => {
  const w = src('components/club-workspace.tsx')
  assert.match(w, /const graduatedOwner = !demo\.isDemoEnabled && !!membership\?\.isOwner && !membership\.alumniSince && isAlumniProfile\(user\?\.profile\);/)
  assert.match(w, /\{graduatedOwner && <p role="status"[^>]*>You’ve graduated\. Hand ownership to a current member\. <Link href=\{clubWorkspaceHref\(clubId, "members"\)\}[^>]*>Manage members<\/Link><\/p>\}/)
})

test('alumni: interview booking and moving, and task submissions and uploads are refused; cancelling and reporting stay', async () => {
  assert.match(src('actions/interview-rooms.ts'), /if \(!initial\) throw new ActionError\("Application unavailable\."\);\n\s*\/\/[^\n]*\n\s*await assertNotAlumni\(tx, user\.id, "book"\)\n\s*\/\/ Refuse before/)
  assert.match(src('actions/scheduling.ts'), /const parsed = bookSlotSchema\.parse\(data\);\n\s*\/\/[^\n]*\n\s*await assertNotAlumni\(prisma, user\.id, "book"\);/)
  const tasks = src('actions/tasks.ts')
  assert.match(tasks, /const \{ user, assignment \} = await ownedAssignment\(data\.assignmentId\);\n\s*\/\/[^\n]*\n\s*await assertNotAlumni\(prisma, user\.id, "task"\);\n\s*validateTaskSubmission/)
  assert.match(tasks, /const \{ user, assignment \} = await ownedAssignment\(data\.assignmentId\);\n\s*await assertNotAlumni\(prisma, user\.id, "task"\);\n\s*if \(\n\s*assignment\.reviewedAt/)
  // Cancelling a booked interview and reporting content are not refused.
  const rooms = src('actions/interview-rooms.ts')
  assert.doesNotMatch(rooms.slice(rooms.indexOf('async function cancelRoomBookingCommand'), rooms.indexOf('async function cancelRoomBookingCommand') + 1500), /assertNotAlumni/)
  assert.doesNotMatch(src('actions/content-reports.ts'), /assertNotAlumni|alumniRefusal/)
  // Direct messaging no longer exists for anyone.
  for (const fn of ['startClubConversation', 'sendClubMessage']) assert.match(src('actions/communications.ts'), new RegExp(`export async function ${fn}\\([^)]*\\): Promise<never> \\{\\n\\s*throw new Error\\("Direct messaging is not available in OutClass\\."\\);`))

  // Behaviour: the legacy booking action refuses before any transaction.
  const prisma = { studentProfile: { findUnique: async () => ({ graduatedAt: ALUMNI_AT }) }, $transaction: async () => assert.fail('no booking transaction') }
  const scheduling = load('actions/scheduling.ts', { '@/utils/prisma': { prisma }, '@/utils/auth': { requireAuth: async () => ({ user: { id: 'grad' } }), requireClubPermission: async () => assert.fail() }, 'next/cache': { revalidatePath() {} }, '@prisma/client': { Prisma: { TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted' } } } })
  await assert.rejects(scheduling.bookInterviewSlot({ slotId: '00000000-0000-4000-8000-0000000000b1', applicationId: '00000000-0000-4000-8000-0000000000a1' }), e => e.code === g.ALUMNI_REFUSED && e.message === g.ALUMNI_REFUSALS.book)
})

// ---- Owner decision (Nov 16): alumni are fully read-only, bookmarks included ----

test('alumni: saving a club or an event is refused before any write; removing a saved item stays available', async () => {
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const writes = []
  const prisma = {
    studentProfile: { findUnique: async ({ where }) => { assert.equal(where.userId, 'grad'); return { graduatedAt: ALUMNI_AT } } },
    club: { findUnique: async () => assert.fail('no club lookup for an alumni save') },
    corkboardClub: { upsert: async () => assert.fail('no club save'), deleteMany: async ({ where }) => { writes.push(['unsave-club', where]); return { count: 1 } } },
    savedCampusEvent: { upsert: async () => assert.fail('no event save'), deleteMany: async ({ where }) => { writes.push(['unsave-event', where]); return { count: 1 } } },
    $transaction: async () => assert.fail('no save transaction for alumni'),
  }
  const auth = { requireAuth: async () => ({ user: { id: 'grad' } }), requireClubPermission: async () => assert.fail() }
  const directory = load('actions/club-directory.ts', { '@/utils/prisma': { prisma }, '@/utils/auth': auth, 'next/cache': { unstable_cache: fn => fn, revalidatePath() {}, revalidateTag() {} } })
  await assert.rejects(directory.setCorkboardClub({ clubId: id(1), saved: true }), e => e.message === g.ALUMNI_REFUSALS.save)
  assert.deepEqual(await directory.setCorkboardClub({ clubId: id(1), saved: false }), { saved: false, savedAt: null })
  const events = load('actions/campus-events.ts', { '@/utils/prisma': { prisma }, '@/utils/auth': auth, 'next/cache': { revalidatePath() {}, revalidateTag() {} }, '@/utils/club-write-transaction': { clubWriteTransaction: async () => assert.fail(), isWriteContention: () => false }, '@/utils/platform-admin': {}, '@/lib/club-transaction-authorization': {} })
  assert.deepEqual(await events.setSavedCampusEvent({ eventId: id(2), saved: true }), { $action: 'outclass.action/v1', ok: false, error: g.ALUMNI_REFUSALS.save, code: g.ALUMNI_REFUSED })
  assert.deepEqual(await events.setSavedCampusEvent({ eventId: id(2), saved: false }), { $action: 'outclass.action/v1', ok: true, data: { saved: false } })
  assert.deepEqual(writes, [['unsave-club', { userId: 'grad', clubId: id(1) }], ['unsave-event', { userId: 'grad', eventId: id(2) }]])
  // A current student still saves.
  const student = { ...prisma, studentProfile: { findUnique: async () => ({ graduatedAt: null }) }, club: { findUnique: async () => ({ id: id(1) }) }, corkboardClub: { upsert: async () => ({ savedAt: new Date('2026-10-03T12:00:00Z') }) } }
  const current = load('actions/club-directory.ts', { '@/utils/prisma': { prisma: student }, '@/utils/auth': auth, 'next/cache': { unstable_cache: fn => fn } })
  assert.deepEqual(await current.setCorkboardClub({ clubId: id(1), saved: true }), { saved: true, savedAt: '2026-10-03T12:00:00.000Z' })
  // The save button is hidden for alumni unless the club is already saved (so it can be removed).
  assert.match(src('components/clubs/corkboard-button.tsx'), /if \(authenticated && !saved && isAlumniProfile\(user\?\.profile\)\) return null/)
})

test('alumni: requesting to claim a club and accepting an emailed club invitation are refused', async () => {
  const clubId = '00000000-0000-4000-8000-0000000000d1'
  const tx = {
    $queryRaw: async strings => strings.join('').includes('"suspendedAt"') ? [] : [{ id: clubId }],
    studentProfile: { findUnique: async () => ({ graduatedAt: ALUMNI_AT }) },
    club: { findUnique: async () => assert.fail('refused before reading the club') },
    clubClaim: { findFirst: async () => assert.fail(), create: async () => assert.fail('no claim') },
    auditLog: { create: async () => assert.fail() },
  }
  const prisma = { club: { findUnique: async () => ({ id: clubId }) }, $transaction: fn => fn(tx) }
  const workspace = unwrapActions(load('actions/club-workspace.ts', { '@/utils/prisma': { prisma }, '@/utils/auth': { requireAuth: async () => ({ user: { id: 'grad' } }), requireClubPermission: async () => assert.fail() }, 'next/cache': { revalidatePath() {}, revalidateTag() {} } }))
  await assert.rejects(workspace.requestClubClaim(clubId, 'I am the president of this club.'), e => e.message === g.ALUMNI_REFUSALS.join)
  // Email invitations (not identity or offer invitations, which share the existing guards) recheck too.
  assert.match(src('actions/club-access.ts'), /if \(existing && !isActiveMembership\(existing\)\) throw new ActionError\("Membership is inactive\. Request a new identity invitation\."\);\n\s*\/\/[^\n]*\n\s*await assertNotAlumni\(tx, user\.id, "join"\);\n[\s\S]{0,200}const permissions/)
})

// ---- Profile fields stay out of club reads ----

test('no club-facing read includes the whole StudentProfile (post-graduation fields stay private)', () => {
  const { execSync } = require('node:child_process')
  const hits = execSync("grep -rnE 'studentProfile: true|studentProfile: \\{ include' actions lib utils app/api --include=*.ts || true", { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  const allowed = [/^lib\/account-data\.ts:\d+:\s+studentProfile: true,/, /studentProfile: \{ include: \{ experiences/]
  for (const hit of hits) assert.ok(allowed.some(p => p.test(hit)), `explicit select needed: ${hit}`)
  // The two name-only reads select names; recruiter views go through the recruitmentProfile allowlist.
  assert.match(src('actions/interview-collaboration.ts'), /select: \{ student: \{ select: \{ studentProfile: \{ select: \{ firstName: true, lastName: true \} \} \} \} \}/)
  assert.match(src('utils/interview-collaboration.ts'), /select: \{ user: \{ select: \{ studentProfile: \{ select: \{ firstName: true, lastName: true \} \} \} \} \}/)
  const rp = load('lib/recruitment-profile.ts')
  const full = { id: 'p', userId: 'u', firstName: 'A', lastName: 'L', computingId: 'al1a', major: 'Econ', gradYear: 2026, transferStudent: false, gpa: 3.5, satScore: null, actScore: null, experiences: [], postGradEmployer: 'Acme', postGradRole: 'Analyst', alumniPlacementClubIds: ['c'], alumniDirectoryVisible: false, alumniPlacementShare: false, phone: '4345550100' }
  assert.doesNotMatch(JSON.stringify(rp.recruitmentProfile(full)), /Acme|Analyst|alumni|postGrad|4345550100/)
  // Roster and export reads select explicitly.
  assert.match(src('lib/club-exports.ts'), /studentProfile: \{ select: \{ firstName: true, lastName: true, gradYear: true, computingId: true \} \}/)
  assert.match(src('actions/organization-members.ts'), /studentProfile: \{ select: \{ firstName: true, lastName: true, major: true, gradYear: true, transferStudent: true \} \}/)
})

// ---- Alumni tab ----

const CLUB = '00000000-0000-4000-8000-0000000000c1'
function alumniAction({ membership, impersonation = null, signedIn = true }) {
  const calls = []
  const prisma = {
    clubMember: {
      findUnique: async ({ where }) => { calls.push(['membership', where]); return membership },
      count: async ({ where }) => { calls.push(['count', where]); return 21 },
      findMany: async args => { calls.push(['list', args]); return [{ id: 'm1', alumniSince: ALUMNI_AT, user: { email: 'ada@virginia.edu', studentProfile: { firstName: 'Ada', lastName: 'L', gradYear: 2026, postGradEmployer: 'Acme', postGradRole: 'Analyst' } } }] },
    },
    $queryRaw: async () => [{ suspendedAt: null }],
  }
  const action = load('actions/club-alumni.ts', {
    '@/utils/prisma': { prisma },
    '@/utils/auth': { requireAuth: async () => { if (!signedIn) throw Error('Unauthorized'); return { user: { id: 'viewer' }, impersonation } } },
    '@/lib/club-suspension': { assertClubOperational: async () => {} },
  })
  return { action, calls }
}

test('Alumni tab: current members only; applicants, alumni, other clubs, support sessions and signed-out visitors get nothing', async () => {
  const { action, calls } = alumniAction({ membership: { status: 'ACTIVE', alumniSince: null } })
  const result = await action.listClubAlumni({ clubId: CLUB, page: 1 })
  assert.equal(result.ok, true)
  assert.deepEqual(result.data, { alumni: [{ id: 'm1', name: 'Ada L', email: 'ada@virginia.edu', employer: 'Acme', role: 'Analyst', gradYear: 2026 }], page: 1, pageSize: 20, total: 21 })
  assert.deepEqual(calls[0], ['membership', { userId_clubId: { userId: 'viewer', clubId: CLUB } }], 'the viewer\'s own membership of this club')
  const list = calls.find(c => c[0] === 'list')[1]
  assert.deepEqual(list.where, { clubId: CLUB, status: 'ACTIVE', alumniSince: { not: null }, user: { disabledAt: null, studentProfile: { is: { alumniDirectoryVisible: true } } } }, 'this club, alumni, enabled, opted in')
  assert.deepEqual(list.orderBy, [{ alumniSince: 'desc' }, { id: 'asc' }], 'most recent first')
  assert.deepEqual([list.skip, list.take], [20, 20])
  assert.doesNotMatch(JSON.stringify(list.select), /phone|gpa|resume|headshot/i, 'never reads phone or recruiting fields')

  for (const membership of [null, { status: 'ACTIVE', alumniSince: ALUMNI_AT }, { status: 'LEFT', alumniSince: null }, { status: 'SUSPENDED', alumniSince: null }]) {
    const denied = alumniAction({ membership })
    const r = await denied.action.listClubAlumni({ clubId: CLUB })
    assert.equal(r.ok, false, JSON.stringify(membership)); assert.equal(r.code, 'FORBIDDEN')
    assert.ok(!denied.calls.some(c => c[0] === 'list' || c[0] === 'count'), 'no alumni read')
  }
  const support = alumniAction({ membership: { status: 'ACTIVE', alumniSince: null }, impersonation: { id: 's' } })
  assert.equal((await support.action.listClubAlumni({ clubId: CLUB })).code, 'FORBIDDEN')
  assert.equal(support.calls.length, 0)
  await assert.rejects(alumniAction({ membership: null, signedIn: false }).action.listClubAlumni({ clubId: CLUB }), /Unauthorized/)
  await assert.rejects(alumniAction({ membership: null }).action.listClubAlumni({ clubId: 'not-a-uuid' }))
})

test('Alumni tab: in every current member\'s club navigation and member rail', () => {
  const nav = load('lib/product-navigation.ts')
  for (const member of [{ permissions: [] }, { isOwner: true }, { permissions: ['members.manage'] }])
    assert.ok(nav.managerNavigation(member, 'c', 'club').some(i => i.id === 'alumni' && i.href === '/club/c/workspace?section=alumni'))
  assert.ok(!nav.managerNavigation({ isOwner: true }, 'c', 'recruiting').some(i => i.id === 'alumni'))
  const rail = load('lib/navigation.ts').memberRailSections('c', 'Club').find(s => s.id === 'member-club')
  assert.deepEqual(rail.items.find(i => i.id === 'club-alumni'), { id: 'club-alumni', label: 'Alumni', href: '/club/c/workspace?section=alumni' })
  assert.match(src('components/club-workspace.tsx'), /\{ id: "alumni", label: "Alumni", href: clubWorkspaceHref\(clubId, "alumni"\) \}/)
  assert.equal(load('lib/workspace-routes.ts').clubWorkspaceTitle(new URLSearchParams('section=alumni')), 'Alumni')
})

// ---- Privacy and deletion ----

test('privacy policy names what members and the public see, and the opt-outs', () => {
  const text = src('lib/legal-content.ts')
  assert.match(text, /your name, university email address, employer, role and graduation year are shown to the current members of the Clubs you were a member of[^"]*unless you turn off/)
  assert.match(text, /its name \(without your name or any other detail about you\) is added to the public \\"Where members go\\" list[^"]*once per Club, unless you turn sharing off\. In a small Club, members may be able to tell who it is\./)
  assert.match(src('components/alumni-details-fields.tsx'), /Added once to each club, without your name\. In a small club, members may be able to tell it’s you\. You can turn this off\./)
})

test('account deletion: the new columns are StudentProfile fields (deleted with it); no new User relation', () => {
  const schema = src('prisma/schema.prisma')
  const profile = schema.match(/^model StudentProfile \{([\s\S]*?)^\}/m)[1]
  for (const field of ['postGradEmployer', 'postGradRole', 'alumniPlacementClubIds', 'alumniDirectoryVisible', 'alumniPlacementShare']) assert.match(profile, new RegExp(`^\\s+${field}\\s`, 'm'), field)
  assert.doesNotMatch(schema.match(/^model User \{([\s\S]*?)^\}/m)[1], /postGrad|alumniDirectory/)
  assert.match(src('utils/account-deletion.ts'), /await tx\.studentProfile\.deleteMany\(\{ where: \{ userId \} \}\)/)
  assert.match(src('lib/account-deletion.ts'), /studentProfile: \{ model: "StudentProfile", onDelete: "Cascade", treatment: "delete", note: "[^"]*Alumni employer/)
  // Recruiters never see the new fields (explicit allowlist type).
  assert.match(src('lib/recruitment-profile.ts'), /"postGradEmployer" \| "postGradRole" \| "alumniPlacementClubIds" \| "alumniDirectoryVisible" \| "alumniPlacementShare">/)
})
