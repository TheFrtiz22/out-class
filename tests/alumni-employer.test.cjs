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

test('saving: confirmation and later edits validate, store and share in one transaction, account holder only', () => {
  const a = src('actions/graduation.ts')
  assert.match(a, /if \(impersonation\) throw new ActionError/)
  assert.match(a, /boundedSafeParse\(postGradDetailsSchema, input \?\? \{\}\)[\s\S]*throw new ActionError\(parsed\.error\.issues\[0\]\?\.message/)
  assert.match(a, /data: \{ graduatedAt, graduationConfirmedAt: now, \.\.\.detailsData\(details\) \}[\s\S]*return \(await shareGraduatePlacement\(tx, userId, now\)\)\.clubIds/)
  assert.match(a, /postGradEmployer: d\.employer, postGradRole: d\.role, alumniDirectoryVisible: d\.showInAlumniList, alumniPlacementShare: d\.shareEmployer/)
  assert.match(a, /if \(!profile\.graduationConfirmedAt && !isAlumniProfile\(profile\)\) throw new ActionError/)
  assert.match(a, /actionResult\(\(\) => saveAlumniDetailsCommand\(input\), "saveAlumniDetails"\)/)
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
    studentProfile: { findUnique: async () => profile && structuredClone(profile), update: async ({ data }) => { log.profileUpdates.push(data); Object.assign(profile, data) } },
    clubMember: { findMany: async ({ where, orderBy }) => { assert.deepEqual(where, { userId: 'grad', status: 'ACTIVE' }); assert.deepEqual(orderBy, { clubId: 'asc' }); return memberships.map(clubId => ({ clubId })) } },
    club: { findUnique: async ({ where }) => where.id in clubs ? { marketing: structuredClone(clubs[where.id]) } : null, update: async ({ where, data }) => { clubs[where.id] = data.marketing } },
    auditLog: { create: async ({ data }) => log.audits.push(data) },
  }
  return { tx, log }
}
const utils = () => load('utils/graduation.ts')
const graduate = (extra = {}) => ({ id: 'p-grad', graduatedAt: ALUMNI_AT, graduationConfirmedAt: new Date('2026-05-01T12:00:00Z'), postGradEmployer: 'Goldman Sachs', alumniPlacementShare: true, postGradPlacementKey: null, ...extra })

test('placement merge: company name only into each roster club, idempotent, audited without identity', async () => {
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
  assert.deepEqual(log.profileUpdates, [{ postGradPlacementKey: 'goldman sachs' }])
  // Repeat (another save, a retried request): nothing changes, even after a leader removed the entry.
  clubs.a.placements = ['McKinsey']
  assert.deepEqual(await shareGraduatePlacement(tx, 'grad', now), { clubIds: [] })
  assert.deepEqual(clubs.a.placements, ['McKinsey'], 'a leader removal is respected')
  assert.equal(log.audits.length, 2)
  // A different employer is shared once.
  profile.postGradEmployer = 'Bain'
  assert.deepEqual((await shareGraduatePlacement(tx, 'grad', now)).clubIds, ['a', 'b', 'c'])
  assert.deepEqual(clubs.a.placements, ['McKinsey', 'Bain'])
})

test('placement merge respects the opt-out and runs only for confirmed graduates or alumni', async () => {
  const { shareGraduatePlacement } = utils()
  const now = new Date('2026-06-01T00:00:00Z')
  for (const profile of [graduate({ alumniPlacementShare: false }), graduate({ postGradEmployer: null }), graduate({ graduatedAt: null, graduationConfirmedAt: null }), null]) {
    const clubs = { a: { placements: [] } }
    const { tx, log } = placementTx({ profile, memberships: ['a'], clubs })
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
    'actions/voting-room.ts': /const alumni=await alumniRefusal\(prisma,user\.id,"vote"\);\n\s*if\(alumni\)return \{ok:false as const,code:ALUMNI_REFUSED,message:alumni\};\n\s*return domainResult/,
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
  assert.match(text, /its name \(without your name or any other detail about you\) is added to the public \\"Where members go\\" list/)
})

test('account deletion: the new columns are StudentProfile fields (deleted with it); no new User relation', () => {
  const schema = src('prisma/schema.prisma')
  const profile = schema.match(/^model StudentProfile \{([\s\S]*?)^\}/m)[1]
  for (const field of ['postGradEmployer', 'postGradRole', 'postGradPlacementKey', 'alumniDirectoryVisible', 'alumniPlacementShare']) assert.match(profile, new RegExp(`^\\s+${field}\\s`, 'm'), field)
  assert.doesNotMatch(schema.match(/^model User \{([\s\S]*?)^\}/m)[1], /postGrad|alumniDirectory/)
  assert.match(src('utils/account-deletion.ts'), /await tx\.studentProfile\.deleteMany\(\{ where: \{ userId \} \}\)/)
  assert.match(src('lib/account-deletion.ts'), /studentProfile: \{ model: "StudentProfile", onDelete: "Cascade", treatment: "delete", note: "[^"]*Alumni employer/)
  // Recruiters never see the new fields (explicit allowlist type).
  assert.match(src('lib/recruitment-profile.ts'), /"postGradEmployer" \| "postGradRole" \| "postGradPlacementKey" \| "alumniDirectoryVisible" \| "alumniPlacementShare">/)
})
