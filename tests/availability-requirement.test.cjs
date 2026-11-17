// Required weekly availability and the leaders' "Find a meeting time" planner: what meets the
// requirement (an empty save does not; an explicit "no regular free time" does), who is exempt, the
// server-side workspace gate, the own-account completion action, meetings.manage-gated planner reads
// (same club, active members, suspended clubs refused, names only), and heatmap aggregation.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')

const root = path.join(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
function loader(mocks = {}) {
  const cache = new Map()
  const resolve = name => ['.ts', '.tsx'].map(ext => name + ext).find(file => fs.existsSync(path.join(root, file))) ?? name + '.ts'
  function load(file) {
    file = path.resolve(root, file)
    if (cache.has(file)) return cache.get(file).exports
    const mod = { exports: {} }; cache.set(file, mod)
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
    new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(resolve(name.slice(2))) : require(name), mod, mod.exports)
    return mod.exports
  }
  return load
}
const core = loader()('lib/availability.ts')
const req = loader()('lib/availability-requirement.ts')
const planner = loader()('lib/meeting-time-planner.ts')
const { AVAILABILITY_FIRST_SLOT, AVAILABILITY_END_SLOT } = loader()('lib/scheduling-config.ts')

const weekly = (day, ranges) => { const s = core.emptySchedule(); s.weeklySubmitted = true; s.weekly[day] = ranges; return s }
const emptySubmitted = () => { const s = core.emptySchedule(); s.weeklySubmitted = true; return s }

test('an empty save does not meet the requirement; any saved time or an explicit declaration does', () => {
  assert.equal(req.scheduleHasAvailability(null), false)
  assert.equal(req.scheduleHasAvailability(core.emptySchedule()), false)
  assert.equal(req.scheduleHasAvailability(emptySubmitted()), false, 'painting and clearing autosaves an empty submitted week')
  const hidden = core.emptySchedule(); hidden.weekly[0] = [[540, 600]]
  assert.equal(req.scheduleHasAvailability(hidden), false, 'an unsubmitted recurring week is not availability')
  assert.equal(req.scheduleHasAvailability(weekly(2, [[540, 600]])), true)
  const dated = core.emptySchedule(); dated.exceptions['2026-11-18'] = [[600, 660]]
  assert.equal(req.scheduleHasAvailability(dated), true)
  dated.exceptions['2026-11-18'] = []
  assert.equal(req.scheduleHasAvailability(dated), false)
  assert.equal(req.availabilityRequirementMet({ schedule: emptySubmitted(), declaredNone: false }), false)
  assert.equal(req.availabilityRequirementMet({ schedule: emptySubmitted(), declaredNone: true }), true)
  assert.equal(req.availabilityRequirementMet({ schedule: null, declaredNone: false }), false)
})

const account = patch => ({ disabled: false, platformAdmin: false, alumni: false, onboarded: true, hasAvailability: false, declaredNone: false, ...patch })
const decide = (patch, opts = {}) => req.availabilityGateDecision({ demo: false, impersonating: false, userId: 'u1', load: async () => account(patch), ...opts })

test('gate asks a student with no saved availability, and passes once a time is saved or none is declared', async () => {
  assert.equal(await decide({}), 'ask', 'no available time saved')
  assert.equal(await decide({ hasAvailability: true }), 'pass')
  assert.equal(await decide({ declaredNone: true }), 'pass')
})

test('gate exemptions: alumni, platform admins, disabled, no profile yet, demo, support sessions, signed out, missing account', async () => {
  assert.equal(await decide({ alumni: true }), 'pass', 'alumni')
  assert.equal(await decide({ platformAdmin: true }), 'pass')
  assert.equal(await decide({ disabled: true }), 'pass')
  assert.equal(await decide({ onboarded: false }), 'pass', 'no student profile yet: the signup wizard comes first')
  assert.equal(await decide({}, { demo: true }), 'pass')
  assert.equal(await decide({}, { impersonating: true }), 'pass')
  assert.equal(await decide({}, { userId: null }), 'pass')
  assert.equal(await req.availabilityGateDecision({ demo: false, impersonating: false, userId: 'u1', load: async () => null }), 'pass')
})

test('a failed check lets the page load and is reported', async () => {
  const reported = [], error = console.error; console.error = () => {}
  try {
    assert.equal(await req.availabilityGateDecision({ demo: false, impersonating: false, userId: 'u1', load: async () => { throw new Error('db') }, onError: e => reported.push(e.message) }), 'pass')
    assert.equal(await req.availabilityGateDecision({ demo: false, impersonating: false, userId: 'u1', load: async () => { throw new Error('db') }, onError: () => { throw new Error('reporter down') } }), 'pass', 'a broken reporter changes nothing')
  } finally { console.error = error }
  assert.deepEqual(reported, ['db'])
  assert.match(read('components/availability/availability-gate.tsx'), /Sentry\.captureException\(error, \{ tags: \{ gate: "availability-requirement" \} \}\)/)
})

test('gate identity: a support session counts only when platformViewSession validates it', async () => {
  const student = { id: 'student-1', email_confirmed_at: '2026-11-01T00:00:00Z' }
  const identity = deps => req.availabilityGateIdentity({ demoCookie: undefined, hasViewCookie: false, viewSession: async () => null, sessionUser: async () => student, ...deps })
  // A forged view-as cookie (no valid support session behind it) does not skip the step.
  const forged = await identity({ hasViewCookie: true, viewSession: async () => null })
  assert.deepEqual(forged, { demo: false, impersonating: false, userId: 'student-1' })
  assert.equal(await req.availabilityGateDecision({ ...forged, load: async () => account({}) }), 'ask')
  const refusedSession = await identity({ hasViewCookie: true, viewSession: async () => { throw new Error('Platform administrator access is required.') } })
  assert.equal(await req.availabilityGateDecision({ ...refusedSession, load: async () => account({}) }), 'ask', 'a non-admin with the cookie is still asked')
  // A forged view-as cookie with no signed-in session has nobody to ask.
  assert.deepEqual(await identity({ hasViewCookie: true, sessionUser: async () => null }), { demo: false, impersonating: false, userId: null })
  // A real support session passes; the administrator is never asked for the user's availability.
  assert.deepEqual(await identity({ hasViewCookie: true, viewSession: async () => ({ id: 'view-1', targetUserId: 'student-1' }) }), { demo: false, impersonating: true, userId: null })
  // Demo Mode: the same cookie test requireAuth uses.
  assert.equal((await identity({ demoCookie: '1' })).demo, true)
  assert.equal((await identity({ demoCookie: '0' })).userId, 'student-1')
  // Any school: only a verified email is required here; whether the account is a student is the loader's question.
  assert.equal((await identity({ sessionUser: async () => ({ id: 'other-school', email_confirmed_at: '2026-11-01T00:00:00Z' }) })).userId, 'other-school')
  assert.equal((await identity({ sessionUser: async () => ({ id: 'unverified', email_confirmed_at: null }) })).userId, null)
})

test('the gate renders the step on the server, in place of the workspace, after Terms', () => {
  const layout = read('app/(workspace)/layout.tsx')
  assert.match(layout, /<TermsGate><AvailabilityGate><WorkspaceShell>\{children\}<\/WorkspaceShell><\/AvailabilityGate><\/TermsGate>/)
  const gate = read('components/availability/availability-gate.tsx')
  assert.doesNotMatch(gate, /^"use client"/)
  assert.doesNotMatch(gate, /isUvaEmail/, 'every school')
  assert.match(gate, /const loadRequirement = cache\(\(userId: string\) => loadAvailabilityRequirement\(prisma, userId\)\)/)
  assert.match(gate, /viewSession: platformViewSession/)
  assert.match(gate, /return <AvailabilityRequirementScreen initial=\{initial\} \/>/, 'no children are rendered behind the step')
  const screen = read('components/availability/availability-requirement-screen.tsx')
  assert.doesNotMatch(screen, /children|termsGateExempt|usePathname/)
  assert.doesNotMatch(gate + screen, /localStorage|sessionStorage/)
  // New signups reach it right after the interest survey (the wizard's last step hands off to the workspace).
  assert.match(read('components/views/student-onboarding-wizard.tsx'), /submitLabel="Continue"/)
})

test('requirement loader: one SQL statement, no schedule JSON returned, matching scheduleHasAvailability', async () => {
  const source = read('utils/availability-requirement.ts')
  assert.equal(source.match(/\$queryRaw</g).length, 1); assert.doesNotMatch(source, /findUnique|findFirst|schedule: true/)
  const { harness: sqlHarness } = require('./helpers/interview-sql-harness.cjs')
  const h = await sqlHarness(); t_after.push(() => h.db.close())
  const { loadAvailabilityRequirement } = loader()('utils/availability-requirement.ts')
  let statements = 0
  const db = { $queryRaw: async (strings, ...values) => { statements++; return (await h.db.query(strings.map((part, i) => part + (i < values.length ? '$' + (i + 1) : '')).join(''), values)).rows } }
  const { randomUUID } = require('node:crypto')
  const user = async ({ profile = true, graduatedAt = null, schedule, declared = false, admin } = {}) => {
    const id = randomUUID()
    await h.db.query('INSERT INTO "User"(id,email) VALUES ($1,$2)', [id, `${id.slice(0, 8)}@school.edu`])
    if (profile) await h.db.query('INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear","graduatedAt") VALUES ($1,$2,\'A\',\'B\',$3,\'Economics\',2028,$4)', [randomUUID(), id, 'c' + id.slice(0, 8), graduatedAt])
    if (schedule) await h.db.query('INSERT INTO "UserAvailability"("userId",schedule) VALUES ($1,$2)', [id, JSON.stringify(schedule)])
    if (declared) await h.db.query('INSERT INTO "AuditLog"(id,"actorId","targetId",action) VALUES ($1,$2,$2,$3)', [randomUUID(), id, req.NO_REGULAR_AVAILABILITY_ACTION])
    if (admin !== undefined) await h.db.query('INSERT INTO "PlatformAdmin"("userId",active) VALUES ($1,$2)', [id, admin])
    return id
  }
  const load = async options => loadAvailabilityRequirement(db, await user(options), new Date('2026-11-16T12:00:00Z'))
  const dated = core.emptySchedule(); dated.exceptions['2026-11-18'] = [[540, 600]]
  const datedEmpty = core.emptySchedule(); datedEmpty.exceptions['2026-11-18'] = []
  const unsubmitted = core.emptySchedule(); unsubmitted.weekly[0] = [[540, 600]]
  for (const [schedule, expected] of [[weekly(0, [[540, 600]]), true], [emptySubmitted(), false], [dated, true], [datedEmpty, false], [unsubmitted, false]]) {
    const account = await load({ schedule })
    assert.equal(account.hasAvailability, expected, JSON.stringify(schedule)); assert.equal(account.hasAvailability, req.scheduleHasAvailability(schedule))
  }
  statements = 0
  const plain = await load({})
  assert.equal(statements, 1, 'one statement per check')
  assert.deepEqual(plain, { disabled: false, platformAdmin: false, alumni: false, onboarded: true, hasAvailability: false, declaredNone: false })
  assert.equal((await load({ declared: true })).declaredNone, true)
  assert.equal((await load({ profile: false })).onboarded, false)
  assert.equal((await load({ graduatedAt: new Date('2026-05-20T12:00:00Z') })).alumni, true)
  assert.equal((await load({ graduatedAt: new Date('2027-05-20T12:00:00Z') })).alumni, false, 'a future graduation date is not alumni yet')
  assert.equal((await load({ admin: true })).platformAdmin, true)
  assert.equal((await load({ admin: false })).platformAdmin, false, 'an inactive admin grant is not exempt')
  assert.equal(await loadAvailabilityRequirement(db, randomUUID()), null)
  // Another account's declaration never counts.
  const other = await user({ declared: true }), mine = await user()
  await h.db.query('INSERT INTO "AuditLog"(id,"actorId","targetId",action) VALUES ($1,$2,$3,$4)', [randomUUID(), other, mine, req.NO_REGULAR_AVAILABILITY_ACTION])
  assert.equal((await loadAvailabilityRequirement(db, mine)).declaredNone, false)
})
const t_after = []
test.after(async () => { for (const close of t_after) await close() })

// ── Server actions (actions/availability.ts) with an in-memory database ────────────────────────
const CLUB = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222'
// A club at another school: clubs are school-scoped, so a leader there has no membership here.
const FOREIGN = '33333333-3333-4333-8333-333333333333'
function harness({ caller = 'lead', impersonation = null, memberships = {}, suspended = [], rows = {}, members = {} } = {}) {
  const audits = [], writes = []
  const tx = {
    async $queryRaw(strings, ...values) {
      const sql = strings.join('?')
      if (sql.includes('"suspendedAt" IS NOT NULL')) return suspended.includes(values[0]) ? [{ id: values[0] }] : []
      return []
    },
    user: { findUnique: async ({ where }) => ({ id: where.id, disabledAt: null }) },
    clubMember: {
      findUnique: async ({ where }) => memberships[`${where.userId_clubId.clubId}:${where.userId_clubId.userId}`] ?? null,
      findMany: async ({ where, select }) => {
        assert.equal(where.status, 'ACTIVE'); assert.equal(where.alumniSince, null); assert.deepEqual(where.user, { disabledAt: null })
        // Rows carry ids and emails as a careless select would; only the projection decides what leaves the server.
        return (members[where.clubId] ?? []).map((m, i) => ({ id: `member-${i}`, userId: `user-id-${i}`, user: { id: `user-id-${i}`, email: `member${i}@virginia.edu`, availability: m.schedule ? { schedule: m.schedule } : null, ...(select.user.select.studentProfile ? { studentProfile: m.profile ?? null } : {}) } }))
      },
    },
    // A current student (alumni are read-only and exempt: tests/alumni-read-only.test.cjs).
    studentProfile: { findUnique: async () => ({ graduatedAt: null }) },
    userAvailability: {
      findUnique: async ({ where }) => rows[where.userId] ?? null,
      create: async ({ data }) => { writes.push(['create', data]); rows[data.userId] = { userId: data.userId, schedule: data.schedule, revision: 1 }; return rows[data.userId] },
      update: async ({ where, data }) => { writes.push(['update', data]); rows[where.userId] = { ...rows[where.userId], schedule: data.schedule, revision: rows[where.userId].revision + 1 }; return rows[where.userId] },
    },
    auditLog: {
      create: async ({ data }) => { audits.push(data) },
      findFirst: async ({ where }) => audits.find(a => a.actorId === where.actorId && a.targetId === where.targetId && a.action === where.action) ?? null,
    },
  }
  const prisma = { ...tx, $transaction: async work => work(tx) }
  const empty = new Proxy({}, { get: () => () => { throw new Error('not used') } })
  const load = loader({
    '@/utils/auth': { requireAuth: async () => ({ user: { id: caller }, impersonation }) },
    '@/utils/prisma': { prisma },
    '@/utils/availability-publication': empty, '@/utils/club-write-transaction': empty,
    '@/utils/panel-planning': empty, '@/utils/interviewer-pool': empty,
  })
  return { ...load('actions/availability.ts'), audits, writes, rows, limits: load('lib/rate-limit-core.ts') }
}

test('completing the requirement: saved times pass, an empty week needs the explicit choice, which is recorded', async () => {
  const filled = harness({ caller: 'u1', rows: { u1: { schedule: weekly(1, [[540, 600]]), revision: 2 } } })
  const ok = await filled.completeAvailabilityRequirement({ noRegularTime: false })
  assert.equal(ok.ok, true); assert.equal(filled.audits.length, 0); assert.equal(filled.writes.length, 0)

  const blank = harness({ caller: 'u1', rows: { u1: { schedule: emptySubmitted(), revision: 4 } } })
  const refused = await blank.completeAvailabilityRequirement({ noRegularTime: false })
  assert.equal(refused.ok, false); assert.match(refused.error, /no regular free time/)
  assert.equal(blank.audits.length, 0)

  const none = harness({ caller: 'u1' })
  const declared = await none.completeAvailabilityRequirement({ noRegularTime: true })
  assert.equal(declared.ok, true)
  assert.deepEqual(none.audits.map(a => [a.actorId, a.targetId, a.action]), [['u1', 'u1', req.NO_REGULAR_AVAILABILITY_ACTION]])
  assert.equal(none.rows.u1.schedule.weeklySubmitted, true, 'stored as an explicitly submitted empty week')
  assert.ok(none.rows.u1.schedule.weekly.every(day => day.length === 0))

  // Finishing again (another tab, a retry) adds no second declaration and no second write.
  const writesBefore = none.writes.length
  assert.equal((await none.completeAvailabilityRequirement({ noRegularTime: true })).ok, true)
  assert.equal(none.audits.length, 1); assert.equal(none.writes.length, writesBefore)
  const earlier = harness({ caller: 'u1', rows: { u1: { schedule: core.emptySchedule(), revision: 1 } } })
  earlier.audits.push({ actorId: 'u1', targetId: 'u1', action: req.NO_REGULAR_AVAILABILITY_ACTION })
  assert.equal((await earlier.completeAvailabilityRequirement({ noRegularTime: true })).ok, true)
  assert.equal(earlier.audits.length, 1, 'an existing declaration is not repeated'); assert.equal(earlier.writes.length, 0)

  await assert.rejects(() => none.completeAvailabilityRequirement({ noRegularTime: true, userId: 'someone-else' }))
  const support = harness({ caller: 'u1', impersonation: { targetUserId: 'u1' } })
  const blocked = await support.completeAvailabilityRequirement({ noRegularTime: true })
  assert.equal(blocked.ok, false); assert.equal(support.audits.length, 0)
})

const WEEK = '2026-11-16' // a Monday, Eastern standard time (aggregation tests)
// Planner reads accept only this week through MEETING_PLANNER_WEEKS_AHEAD weeks ahead.
const PLAN_WEEK = planner.plannerWeekRange().first
const leader = { status: 'ACTIVE', alumniSince: null, isOwner: false, permissions: ['meetings.manage'] }
const plain = { status: 'ACTIVE', alumniSince: null, isOwner: false, permissions: ['meetings.attendance'] }
const roster = () => ({
  [CLUB]: [
    { schedule: weekly(0, [[540, 660]]), profile: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@virginia.edu', phone: '434-555-0100' } },
    { schedule: weekly(0, [[600, 720]]), profile: { firstName: 'Grace', lastName: 'Hopper' } },
    { schedule: emptySubmitted(), profile: { firstName: 'Alan', lastName: 'Turing' } },
    { schedule: null, profile: null },
  ],
  [OTHER]: [{ schedule: weekly(0, [[540, 1260]]), profile: { firstName: 'Other', lastName: 'School' } }],
})

test('planner: only members who can create this club’s meetings, in an operational club, can read it', async () => {
  const input = { clubId: CLUB, week: PLAN_WEEK, duration: 60 }
  const allowed = harness({ memberships: { [`${CLUB}:lead`]: leader }, members: roster() })
  const heat = await allowed.getMeetingTimePlanner(input)
  assert.equal(heat.members, 4); assert.equal(heat.withAvailability, 2)

  const noCapability = harness({ memberships: { [`${CLUB}:lead`]: plain }, members: roster() })
  await assert.rejects(() => noCapability.getMeetingTimePlanner(input), /Club access denied/)
  await assert.rejects(() => noCapability.getMeetingTimeRoster({ ...input, day: 0, slot: 40 }), /Club access denied/)

  // A leader of another club at the same school.
  const otherClub = harness({ memberships: { [`${OTHER}:lead`]: leader }, members: roster() })
  await assert.rejects(() => otherClub.getMeetingTimePlanner(input), /Club access denied/)
  await assert.rejects(() => otherClub.getMeetingTimeRoster({ ...input, day: 0, slot: 40 }), /Club access denied/)
  // A leader of a club at another school, in both directions.
  const foreign = harness({ memberships: { [`${FOREIGN}:lead`]: leader }, members: roster() })
  await assert.rejects(() => foreign.getMeetingTimePlanner(input), /Club access denied/)
  await assert.rejects(() => foreign.getMeetingTimeRoster({ ...input, day: 0, slot: 40 }), /Club access denied/)
  await assert.rejects(() => allowed.getMeetingTimePlanner({ ...input, clubId: FOREIGN }), /Club access denied/)

  const alumniLeader = harness({ memberships: { [`${CLUB}:lead`]: { ...leader, alumniSince: new Date() } }, members: roster() })
  await assert.rejects(() => alumniLeader.getMeetingTimePlanner(input), /Club access denied/)

  const suspended = harness({ memberships: { [`${CLUB}:lead`]: leader }, members: roster(), suspended: [CLUB] })
  await assert.rejects(() => suspended.getMeetingTimePlanner(input), error => error.code === 'CLUB_SUSPENDED')
  await assert.rejects(() => suspended.getMeetingTimeRoster({ ...input, day: 0, slot: 40 }), error => error.code === 'CLUB_SUSPENDED')

  await assert.rejects(() => allowed.getMeetingTimePlanner({ ...input, duration: 50 }))
  await assert.rejects(() => allowed.getMeetingTimeRoster({ ...input, day: 0, slot: AVAILABILITY_END_SLOT }))
  await assert.rejects(() => allowed.getMeetingTimePlanner({ ...input, clubId: 'not-a-uuid' }))
})

test('planner heatmap holds counts only; the roster holds names only, never contact details', async () => {
  const h = harness({ memberships: { [`${CLUB}:lead`]: leader }, members: roster() })
  const heat = await h.getMeetingTimePlanner({ clubId: CLUB, week: PLAN_WEEK, duration: 60 })
  const heatText = JSON.stringify(heat)
  assert.doesNotMatch(heatText, /Ada|Grace|Alan|Other|Member|@|434-555/)
  assert.deepEqual(Object.keys(heat).sort(), ['duration', 'free', 'members', 'week', 'withAvailability'])
  // Monday 10:00–11:00: Ada (9–11) and Grace (10–12) are free.
  assert.equal(heat.free[0][40], 2)
  assert.equal(heat.free[0][36], 1, '9:00–10:00: only Ada')
  assert.equal(heat.free[0][44], 1, '11:00–12:00: only Grace')
  assert.equal(heat.free[1][40], 0)

  const at = await h.getMeetingTimeRoster({ clubId: CLUB, week: PLAN_WEEK, duration: 60, day: 0, slot: 40 })
  assert.deepEqual([...at.free], ['Ada Lovelace', 'Grace Hopper'])
  assert.deepEqual([...at.busy], ['Alan Turing'])
  assert.deepEqual([...at.unknown], ['Member'])
  assert.equal(at.date, PLAN_WEEK)
  assert.equal(at.end - at.start, 3_600_000)
  const text = JSON.stringify(at)
  assert.doesNotMatch(text, /@|434-555|virginia\.edu|School|user-id-|member-\d/, 'no emails, phones, user or member ids, or another club’s members')
  assert.doesNotMatch(heatText, /user-id-|member-\d/)
  assert.deepEqual(Object.keys(at).sort(), ['busy', 'date', 'end', 'free', 'start', 'unknown'])
})

test('planner weeks: this week through 8 weeks ahead, on the server and in the picker', async () => {
  const now = new Date('2026-11-18T15:00:00Z') // a Wednesday
  assert.deepEqual(planner.plannerWeekRange(now), { first: '2026-11-16', last: '2027-01-11' })
  assert.equal(planner.plannerWeek('2026-11-20', now), '2026-11-16', 'any day of this week')
  assert.equal(planner.plannerWeek('2027-01-11', now), '2027-01-11', 'eight weeks ahead')
  assert.equal(planner.plannerWeek('2027-01-18', now), null, 'nine weeks ahead')
  assert.equal(planner.plannerWeek('2026-11-09', now), null, 'last week')
  const h = harness({ memberships: { [`${CLUB}:lead`]: leader }, members: roster() })
  const { first, last } = planner.plannerWeekRange()
  for (const week of [core.addDays(first, -7), core.addDays(last, 7), '2020-01-06']) {
    await assert.rejects(() => h.getMeetingTimePlanner({ clubId: CLUB, week, duration: 60 }), /Choose a week from this week to 8 weeks ahead/)
    await assert.rejects(() => h.getMeetingTimeRoster({ clubId: CLUB, week, duration: 60, day: 0, slot: 40 }), /Choose a week from this week to 8 weeks ahead/)
  }
  assert.equal((await h.getMeetingTimePlanner({ clubId: CLUB, week: last, duration: 60 })).week, last)
  const ui = read('components/availability/meeting-time-planner.tsx')
  assert.match(ui, /disabled=\{week <= range\.first\}/); assert.match(ui, /disabled=\{week >= range\.last\}/)
})

test('roster reads are rate limited per leader and club', async () => {
  const h = harness({ memberships: { [`${CLUB}:lead`]: leader, [`${OTHER}:lead`]: leader }, members: roster() })
  const { limit } = h.limits.RATE_LIMITS.meetingPlannerRoster
  const names = (clubId, slot) => h.getMeetingTimeRoster({ clubId, week: PLAN_WEEK, duration: 60, day: 0, slot })
  for (let i = 0; i < limit; i++) await names(CLUB, AVAILABILITY_FIRST_SLOT + (i % 40))
  await assert.rejects(() => names(CLUB, 40), error => error.code === 'RATE_LIMITED' && /Too many requests/.test(error.message))
  assert.equal((await names(OTHER, 40)).date, PLAN_WEEK, 'another club has its own budget')
  const other = harness({ caller: 'lead-2', memberships: { [`${CLUB}:lead-2`]: leader }, members: roster() })
  assert.equal((await other.getMeetingTimeRoster({ clubId: CLUB, week: PLAN_WEEK, duration: 60, day: 0, slot: 40 })).date, PLAN_WEEK, 'another leader has their own budget')
  assert.equal((await h.getMeetingTimePlanner({ clubId: CLUB, week: PLAN_WEEK, duration: 60 })).week, PLAN_WEEK, 'counts are not limited')
  const route = read('app/api/workspace/route.ts')
  assert.match(route, /error\.code === "RATE_LIMITED"\) return Response\.json\(\{ error: RATE_LIMIT_MESSAGE \}, \{ status: 429/)
})

test('the heatmap grid selects one time: only the chosen cell reads as selected', () => {
  const grid = read('components/availability/weekly-calendar.tsx')
  assert.match(grid, /const choosing = !!onSelect && selected !== undefined/)
  assert.match(grid, /aria-selected=\{cellSelected\(i, slot\)\}/); assert.match(grid, /aria-multiselectable=\{!choosing\}/)
  assert.match(grid, /Enter or Space chooses a time\./)
  const ui = read('components/availability/meeting-time-planner.tsx')
  assert.match(ui, /const current = data && data\.week === week && data\.duration === duration \? data : null/)
  assert.match(ui, /inert=\{!current\}/)
  assert.match(ui, /prefers-reduced-motion: reduce/)
})

test('aggregation: whole-meeting windows, the 8 AM–9 PM boundary, unknown days and best times', () => {
  const cells = core.weekCells(WEEK, 'America/New_York')
  const ada = planner.memberCellStates(weekly(0, [[540, 660]]), cells)
  assert.equal(ada[0][36], 'available'); assert.equal(ada[0][44], 'unavailable')
  assert.equal(ada[1][36], 'unavailable', 'a submitted week with an empty day is busy, not unknown')
  const unsubmitted = planner.memberCellStates(core.emptySchedule(), cells)
  assert.equal(unsubmitted[0][40], 'unknown')
  assert.equal(planner.memberCellStates(null, cells)[3][50], 'unknown')
  const dated = core.emptySchedule(); dated.exceptions['2026-11-18'] = [[780, 840]]
  const datedStates = planner.memberCellStates(dated, cells)
  assert.equal(datedStates[2][52], 'available'); assert.equal(datedStates[2][40], 'unavailable'); assert.equal(datedStates[0][52], 'unknown')

  assert.equal(planner.windowState(ada[0], 36, 8), 'available', '9:00–11:00 fits exactly')
  assert.equal(planner.windowState(ada[0], 37, 8), 'unavailable', 'partly outside is busy')
  assert.equal(planner.windowState(ada[0], AVAILABILITY_FIRST_SLOT - 1, 1), null, 'before 8 AM')
  assert.equal(planner.windowState(ada[0], AVAILABILITY_END_SLOT - 2, 4), null, 'would run past 9 PM')
  assert.equal(planner.windowState(ada[0], AVAILABILITY_END_SLOT - 4, 4), 'unavailable', 'ending exactly at 9 PM is allowed')

  const counts = planner.plannerFreeCounts([ada, planner.memberCellStates(weekly(0, [[600, 720]]), cells), unsubmitted], 60)
  assert.equal(counts.length, 7); assert.ok(counts.every(day => day.length === 96))
  assert.equal(counts[0][40], 2); assert.equal(counts[0][AVAILABILITY_FIRST_SLOT - 1], 0)
  const best = planner.bestMeetingTimes(counts, 60)
  assert.deepEqual(best[0], { day: 0, slot: 40, count: 2 })
  assert.ok(best.every((a, i) => best.every((b, j) => i === j || a.day !== b.day || Math.abs(a.slot - b.slot) >= 4)), 'best times do not overlap')
  assert.deepEqual(planner.MEETING_DURATIONS.map(planner.durationLabel), ['30 min', '45 min', '1 hr', '1.5 hr', '2 hr'])
})

test('the planner sits beside New meeting, behind meetings.manage, and reads through the workspace API', () => {
  const meetings = read('components/meeting-workspace.tsx')
  assert.match(meetings, /hasPermission\(member, "meetings\.manage"\) && <div className="ms-auto flex flex-wrap items-center gap-2"><ActionWorkflow presentation="sheet" title="Find a meeting time"/)
  assert.match(meetings, /const MeetingTimePlanner = dynamic\(/)
  const route = read('app/api/workspace/route.ts')
  assert.match(route, /case "meetingPlanner": data = await \(await import\("@\/actions\/availability"\)\)\.getMeetingTimePlanner/)
  assert.match(route, /case "meetingPlannerRoster": data = await \(await import\("@\/actions\/availability"\)\)\.getMeetingTimeRoster/)
  assert.match(route, /"meetingPlanner", "meetingPlannerRoster"/)
  const actions = read('actions/availability.ts')
  assert.match(actions, /authorizeClubTransaction\(tx, clubId, userId, \["meetings\.manage"\], \{ readOnly: true \}\)/)
  assert.doesNotMatch(actions.slice(actions.indexOf('async function plannerMembers'), actions.indexOf('export async function completeAvailabilityRequirement')), /email|phone/)
})

test('browser fixtures pass the step with the same declaration the app records', () => {
  assert.equal(require('./helpers/availability-requirement-fixture.cjs').NO_REGULAR_AVAILABILITY_ACTION, req.NO_REGULAR_AVAILABILITY_ACTION)
  assert.match(read('tests/helpers/onboarding-e2e.cjs'), /'completeAvailabilityRequirement',\[\{noRegularTime:true\}\]/)
})
