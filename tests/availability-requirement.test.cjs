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

const account = patch => ({ disabled: false, platformAdmin: false, alumni: false, schedule: null, declaredNone: false, ...patch })
const decide = (patch, opts = {}) => req.availabilityGateDecision({ demo: false, impersonating: false, userId: 'u1', load: async () => account(patch), ...opts })

test('gate asks a student with no saved availability, and passes once a time is saved', async () => {
  assert.equal(await decide({}), 'ask', 'no UserAvailability row')
  assert.equal(await decide({ schedule: emptySubmitted() }), 'ask', 'empty save')
  assert.equal(await decide({ schedule: weekly(0, [[540, 600]]) }), 'pass')
  assert.equal(await decide({ schedule: emptySubmitted(), declaredNone: true }), 'pass')
})

test('gate exemptions: alumni, platform admins, disabled, demo, support sessions, signed out, missing account, database fault', async () => {
  assert.equal(await decide({ alumni: true }), 'pass', 'alumni')
  assert.equal(await decide({ platformAdmin: true }), 'pass')
  assert.equal(await decide({ disabled: true }), 'pass')
  assert.equal(await decide({}, { demo: true }), 'pass')
  assert.equal(await decide({}, { impersonating: true }), 'pass')
  assert.equal(await decide({}, { userId: null }), 'pass')
  assert.equal(await req.availabilityGateDecision({ demo: false, impersonating: false, userId: 'u1', load: async () => null }), 'pass')
  const error = console.error; console.error = () => {}
  try { assert.equal(await req.availabilityGateDecision({ demo: false, impersonating: false, userId: 'u1', load: async () => { throw new Error('db') } }), 'pass') }
  finally { console.error = error }
})

test('the gate is server-side, wraps every workspace page after Terms, and keeps account settings reachable', () => {
  const layout = read('app/(workspace)/layout.tsx')
  assert.match(layout, /<TermsGate><AvailabilityGate><WorkspaceShell>\{children\}<\/WorkspaceShell><\/AvailabilityGate><\/TermsGate>/)
  const gate = read('components/availability/availability-gate.tsx')
  assert.doesNotMatch(gate, /^"use client"/)
  assert.match(gate, /loadAvailabilityRequirement\(prisma, id\)/)
  assert.doesNotMatch(gate + read('components/availability/availability-requirement-screen.tsx'), /localStorage|sessionStorage/)
  assert.match(read('components/availability/availability-requirement-screen.tsx'), /termsGateExempt\(pathname\)/)
  // The loader reads the requirement facts; the declaration is the student's own audit row.
  const loaderSource = read('utils/availability-requirement.ts')
  assert.match(loaderSource, /targetId: userId, actorId: userId, action: NO_REGULAR_AVAILABILITY_ACTION/)
  // New signups reach it right after the interest survey (the wizard's last step hands off to the workspace).
  assert.match(read('components/views/student-onboarding-wizard.tsx'), /submitLabel="Continue"/)
})

test('requirement loader: exemptions and the declaration read only when the schedule is empty', async () => {
  const { loadAvailabilityRequirement } = loader()('utils/availability-requirement.ts')
  let auditReads = 0
  const db = row => ({ user: { findUnique: async () => row }, auditLog: { findFirst: async () => { auditReads++; return { id: 'a1' } } } })
  const filled = await loadAvailabilityRequirement(db({ disabledAt: null, platformAdmin: null, studentProfile: { graduatedAt: null }, availability: { schedule: weekly(0, [[540, 600]]), revision: 3 } }), 'u1')
  assert.equal(auditReads, 0); assert.equal(filled.revision, 3); assert.equal(filled.declaredNone, false)
  const empty = await loadAvailabilityRequirement(db({ disabledAt: null, platformAdmin: { active: true }, studentProfile: null, availability: null }), 'u1')
  assert.equal(auditReads, 1); assert.equal(empty.declaredNone, true); assert.equal(empty.platformAdmin, true); assert.equal(empty.revision, 0)
  assert.equal(await loadAvailabilityRequirement(db(null), 'u1'), null)
  const now = new Date('2026-11-16T12:00:00Z')
  const graduated = await loadAvailabilityRequirement(db({ disabledAt: null, platformAdmin: null, studentProfile: { graduatedAt: new Date('2026-05-20T12:00:00Z') }, availability: null }), 'u1', now)
  assert.equal(graduated.alumni, true)
  const upcoming = await loadAvailabilityRequirement(db({ disabledAt: null, platformAdmin: { active: false }, studentProfile: { graduatedAt: new Date('2027-05-20T12:00:00Z') }, availability: null }), 'u1', now)
  assert.equal(upcoming.alumni, false, 'a future graduation date is not alumni yet'); assert.equal(upcoming.platformAdmin, false, 'an inactive admin grant is not exempt')
})

// ── Server actions (actions/availability.ts) with an in-memory database ────────────────────────
const CLUB = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222'
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
        return (members[where.clubId] ?? []).map(m => ({ user: { availability: m.schedule ? { schedule: m.schedule } : null, ...(select.user.select.studentProfile ? { studentProfile: m.profile ?? null } : {}) } }))
      },
    },
    userAvailability: {
      findUnique: async ({ where }) => rows[where.userId] ?? null,
      create: async ({ data }) => { writes.push(['create', data]); rows[data.userId] = { userId: data.userId, schedule: data.schedule, revision: 1 }; return rows[data.userId] },
      update: async ({ where, data }) => { writes.push(['update', data]); rows[where.userId] = { ...rows[where.userId], schedule: data.schedule, revision: rows[where.userId].revision + 1 }; return rows[where.userId] },
    },
    auditLog: { create: async ({ data }) => { audits.push(data) } },
  }
  const prisma = { ...tx, $transaction: async work => work(tx) }
  const empty = new Proxy({}, { get: () => () => { throw new Error('not used') } })
  const load = loader({
    '@/utils/auth': { requireAuth: async () => ({ user: { id: caller }, impersonation }) },
    '@/utils/prisma': { prisma },
    '@/utils/availability-publication': empty, '@/utils/club-write-transaction': empty,
    '@/utils/panel-planning': empty, '@/utils/interviewer-pool': empty,
  })
  return { ...load('actions/availability.ts'), audits, writes, rows }
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

  await assert.rejects(() => none.completeAvailabilityRequirement({ noRegularTime: true, userId: 'someone-else' }))
  const support = harness({ caller: 'u1', impersonation: { targetUserId: 'u1' } })
  const blocked = await support.completeAvailabilityRequirement({ noRegularTime: true })
  assert.equal(blocked.ok, false); assert.equal(support.audits.length, 0)
})

const WEEK = '2026-11-16' // a Monday, Eastern standard time
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
  const input = { clubId: CLUB, week: WEEK, duration: 60 }
  const allowed = harness({ memberships: { [`${CLUB}:lead`]: leader }, members: roster() })
  const heat = await allowed.getMeetingTimePlanner(input)
  assert.equal(heat.members, 4); assert.equal(heat.withAvailability, 2)

  const noCapability = harness({ memberships: { [`${CLUB}:lead`]: plain }, members: roster() })
  await assert.rejects(() => noCapability.getMeetingTimePlanner(input), /Club access denied/)
  await assert.rejects(() => noCapability.getMeetingTimeRoster({ ...input, day: 0, slot: 40 }), /Club access denied/)

  const otherClub = harness({ memberships: { [`${OTHER}:lead`]: leader }, members: roster() })
  await assert.rejects(() => otherClub.getMeetingTimePlanner(input), /Club access denied/)
  await assert.rejects(() => otherClub.getMeetingTimeRoster({ ...input, day: 0, slot: 40 }), /Club access denied/)

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
  const heat = await h.getMeetingTimePlanner({ clubId: CLUB, week: WEEK, duration: 60 })
  const heatText = JSON.stringify(heat)
  assert.doesNotMatch(heatText, /Ada|Grace|Alan|Other|Member|@|434-555/)
  assert.deepEqual(Object.keys(heat).sort(), ['duration', 'free', 'members', 'week', 'withAvailability'])
  // Monday 10:00–11:00: Ada (9–11) and Grace (10–12) are free.
  assert.equal(heat.free[0][40], 2)
  assert.equal(heat.free[0][36], 1, '9:00–10:00: only Ada')
  assert.equal(heat.free[0][44], 1, '11:00–12:00: only Grace')
  assert.equal(heat.free[1][40], 0)

  const at = await h.getMeetingTimeRoster({ clubId: CLUB, week: WEEK, duration: 60, day: 0, slot: 40 })
  assert.deepEqual([...at.free], ['Ada Lovelace', 'Grace Hopper'])
  assert.deepEqual([...at.busy], ['Alan Turing'])
  assert.deepEqual([...at.unknown], ['Member'])
  assert.equal(at.date, WEEK)
  assert.equal(at.end - at.start, 3_600_000)
  const text = JSON.stringify(at)
  assert.doesNotMatch(text, /@|434-555|virginia\.edu|School/, 'no emails, phones, or another club’s members')
  assert.deepEqual(Object.keys(at).sort(), ['busy', 'date', 'end', 'free', 'start', 'unknown'])
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
