const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', source)(name => name in mocks ? mocks[name] : name.endsWith('.css') ? {} : name.startsWith('@/') ? load(['.ts', '.tsx'].map(ext => path.resolve(name.slice(2) + ext)).find(fs.existsSync), mocks) : require(name), mod, mod.exports)
  return mod.exports
}
const { welcomeGreeting, welcomeSubtitle } = load('lib/welcome.ts')
const { startWelcomeClock } = load('lib/welcome-clock.ts')
const now = new Date(2026, 10, 1, 10)
const at = hours => new Date(+now + hours * 3600000).toISOString()
const personal = (extra = {}) => ({ mode: 'personal', applications: [], events: [], memberClubIds: [], ...extra })
const application = (extra = {}) => ({ id: 'app', clubId: 'one', status: 'DRAFTING', club: { name: 'One', applicationOpen: true }, ...extra })
const event = (id, hours, extra = {}) => ({ id, clubId: 'one', type: 'Interview', startTime: at(hours), response: 'confirmed', ...extra })
const member = (permissions = []) => ({ id: 'member', status: 'ACTIVE', permissions })
const overview = () => ({ club: { id: 'one' }, membership: member(), work: [], operations: { tasks: { overdue: 0, awaitingReview: null }, team: null, rounds: [], bookings: [], meetings: [], announcements: [], reviewWork: [], intake: null } })
function club(extra = {}) { const data = overview(); return { mode: 'club', clubId: 'one', membership: data.membership, data, ...extra } }

test('all local time ranges and every boundary use the authenticated first name', () => {
  for (let hour = 0; hour < 24; hour++) for (const minute of [0, 59]) {
    const date = new Date(2026, 10, 1, hour, minute)
    const expected = hour < 5 || hour >= 21 ? 'Still up, Alex?' : hour < 12 ? 'Good morning, Alex.' : hour < 17 ? 'Good afternoon, Alex.' : 'Good evening, Alex.'
    assert.equal(welcomeGreeting(date, ' Alex '), expected, `${hour}:${minute}`)
  }
  for (const name of [undefined, null, '', '  ']) {
    assert.equal(welcomeGreeting(now, name), 'Good morning.')
    assert.equal(welcomeGreeting(new Date(2026, 10, 1, 23), name), 'Still up?')
  }
  assert.equal(welcomeGreeting(null, 'Alex'), 'Welcome, Alex.')
  assert.equal(welcomeGreeting(new Date(NaN)), 'Welcome to OutClass.')
  assert.equal(welcomeGreeting(now, 'Mary Jane'), 'Good morning, Mary Jane.')
})

test('same instant responds to device timezone changes and midnight uses the new local date', () => {
  const before = process.env.TZ
  try {
    const instant = new Date('2026-11-01T13:00:00Z')
    process.env.TZ = 'America/New_York'; assert.equal(welcomeGreeting(instant, 'Alex'), 'Good morning, Alex.')
    process.env.TZ = 'Asia/Tokyo'; assert.equal(welcomeGreeting(instant, 'Alex'), 'Still up, Alex?')
    process.env.TZ = 'Pacific/Honolulu'; assert.equal(welcomeGreeting(instant, 'Alex'), 'Still up, Alex?')
    process.env.TZ = 'UTC'
    const ctx = personal({ applications: [application({ club: { name: 'One', applicationDeadline: '2026-11-02T01:00:00Z' } })] })
    assert.match(welcomeSubtitle(ctx, new Date('2026-11-01T23:59:59Z')), /tomorrow/)
    assert.match(welcomeSubtitle(ctx, new Date('2026-11-02T00:00:00Z')), /today/)
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before }
})

test('personal priorities: overdue/deadline, immediate interview, submission, today, progress, fallback', () => {
  const ctx = personal({ applications: [application()], events: [event('interview', 1)] })
  assert.match(welcomeSubtitle(ctx, now), /next interview/)
  ctx.applications[0].club.applicationDeadline = at(24)
  assert.match(welcomeSubtitle(ctx, now), /deadline tomorrow/)
  ctx.applications[0].club.applicationDeadline = at(24.001)
  assert.match(welcomeSubtitle(ctx, now), /next interview/)
  ctx.applications[0].club.applicationDeadline = at(-1)
  assert.match(welcomeSubtitle(ctx, now), /deadline has passed/)
  ctx.applications[0].status = 'SUBMITTED'
  assert.match(welcomeSubtitle(ctx, now), /next interview/)
  ctx.events = [event('later', 5)]
  assert.match(welcomeSubtitle(ctx, now), /next interview/)
  ctx.applications[0].status = 'DRAFTING'; ctx.applications[0].club.applicationDeadline = null
  assert.equal(welcomeSubtitle(ctx, now), 'You have 1 application to finish.')
  ctx.events = []; ctx.applications[0].status = 'SUBMITTED'
  assert.equal(welcomeSubtitle(ctx, now), 'You have 1 application in progress.')
  assert.equal(welcomeSubtitle(personal({ applications: [] }), now), "Explore what's new in OutClass.")
  assert.equal(welcomeSubtitle(personal({ applications: null, events: [event('hidden', 1)] }), now), "Explore what's new in OutClass.")
})

test('invalid/closed deadlines, decisions, declined and discovery events never produce invented activity', () => {
  for (const status of ['ACCEPTED', 'REJECTED', 'WAITLISTED']) assert.equal(welcomeSubtitle(personal({ applications: [application({ status })] }), now), "Explore what's new in OutClass.")
  const ctx = personal({ applications: [application({ club: { applicationDeadline: 'invalid' } })] })
  assert.equal(welcomeSubtitle(ctx, now), 'You have 1 application to finish.')
  ctx.applications[0].club = { applicationOpen: false, applicationDeadline: at(1) }
  assert.equal(welcomeSubtitle(ctx, now), 'You have 1 application to finish.')
  ctx.applications = []
  ctx.events = [event('declined', 1, { response: 'declined' }), event('discovery', 1, { response: undefined, type: 'Interest Meeting' }), event('invalid', 1, { startTime: 'invalid' }), event('past', -1)]
  assert.equal(welcomeSubtitle(ctx, now), "Explore what's new in OutClass.")
  ctx.memberClubIds = ['one']; ctx.events = [event('member', 1, { response: undefined, type: 'Other' })]
  assert.match(welcomeSubtitle(ctx, now), /next meeting/)
  ctx.memberClubIds = ['two']; assert.equal(welcomeSubtitle(ctx, now), "Explore what's new in OutClass.")
  ctx.events = [event('all-day', -5, { allDay: true, type: 'Other' })]
  assert.equal(welcomeSubtitle(ctx, now), 'Your next club event is today.')
})

test('ties use soonest time then stable IDs, regardless of input order', () => {
  const events = [event('b', 1), event('a', 1, { type: 'Other' }), event('c', 2)]
  assert.match(welcomeSubtitle(personal({ events }), now), /club event/)
  assert.equal(welcomeSubtitle(personal({ events }), now), welcomeSubtitle(personal({ events: [...events].reverse() }), now))
  events[0].startTime = at(.5)
  assert.match(welcomeSubtitle(personal({ events }), now), /next interview/)
})

test('club priorities use existing authorized counts and individual schedule times', () => {
  const ctx = club(); ctx.membership = member(['applications.review', 'applicants.identify', 'interviews.manage', 'tasks.manage']); ctx.data.membership = ctx.membership
  const op = ctx.data.operations
  op.rounds = [{ pending: 12, needsBooking: 3 }]
  assert.equal(welcomeSubtitle(ctx, now), '12 applications are ready for your review.')
  op.bookings = [{ id: 'booking', slot: { startTime: at(1) } }]
  assert.match(welcomeSubtitle(ctx, now), /next interview/)
  op.intake = { applicationOpen: true, applicationDeadline: at(8) }
  assert.equal(welcomeSubtitle(ctx, now), 'Your application deadline is approaching.')
  ctx.data.work = [{ id: 'task', task: { dueAt: at(-1) } }]
  assert.equal(welcomeSubtitle(ctx, now), 'You have an overdue assignment.')
  ctx.data.work = []; op.intake = null; op.bookings = []; op.rounds[0].pending = 0
  assert.equal(welcomeSubtitle(ctx, now), '3 interviews still need to be scheduled.')
  op.rounds[0].needsBooking = 0; op.tasks.awaitingReview = 1
  assert.equal(welcomeSubtitle(ctx, now), '1 submission is ready for review.')
  op.tasks.awaitingReview = null; op.meetings = [{ id: 'meeting', date: at(5) }]
  assert.match(welcomeSubtitle(ctx, now), /next meeting/)
  op.meetings = []; op.tasks.overdue = 2
  assert.equal(welcomeSubtitle(ctx, now), 'You have 2 overdue assignments.')
})

test('role switching, different clubs/members, revoked grants and partial data stay isolated', () => {
  const ctx = club(); const op = ctx.data.operations
  op.rounds = [{ pending: 99, needsBooking: 42 }]; op.tasks.awaitingReview = 10
  op.intake = { applicationOpen: true, applicationDeadline: at(1) }
  op.bookings = [{ id: 'private', slot: { startTime: at(.5) } }]
  assert.equal(welcomeSubtitle(ctx, now), "Here's what's happening in your club.")
  ctx.membership = member(['applications.review']); ctx.data.membership = member(['applications.review'])
  assert.match(welcomeSubtitle(ctx, now), /deadline/)
  op.intake = null
  assert.equal(welcomeSubtitle(ctx, now), '99 applications are ready for your review.')
  ctx.data.membership.permissions = []
  assert.equal(welcomeSubtitle(ctx, now), "Here's what's happening in your club.")
  ctx.data.membership = member(['applications.review'])
  for (const extra of [{ clubId: 'two' }, { membership: { ...ctx.membership, id: 'someone-else' } }, { membership: { ...ctx.membership, status: 'REVOKED' } }, { data: null }]) assert.equal(welcomeSubtitle({ ...ctx, ...extra }, now), "Here's what's happening in your club.")
  assert.equal(welcomeSubtitle(personal(), now), "Explore what's new in OutClass.")
  for (const invalid of [NaN, -1, 1.2, Infinity]) { op.rounds[0].pending = invalid; assert.equal(welcomeSubtitle(ctx, now), "Here's what's happening in your club.") }
})

test('clock aligns ticks, responds to lifecycle/clock changes, suspends hidden work, and cleans up', () => {
  let current = new Date(2026, 10, 1, 11, 59, 59), callback, delay, clears = 0
  const listeners = new Map(), ticks = []
  const surface = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  const doc = { ...surface, visibilityState: 'visible' }
  const stop = startWelcomeClock(value => ticks.push(value), { now: () => current, setTimeout: (fn, ms) => { callback = fn; delay = ms; return 1 }, clearTimeout: () => { clears++ }, window: surface, document: doc })
  assert.equal(delay, 1000); assert.equal(welcomeGreeting(ticks.at(-1)), 'Good morning.')
  current = new Date(+current + 1000); callback()
  assert.equal(welcomeGreeting(ticks.at(-1)), 'Good afternoon.'); assert.equal(delay, 60000)
  for (const name of ['focus', 'pageshow', 'visibilitychange']) { current = new Date(2026, 10, 2, 0); listeners.get(name)(); assert.equal(+ticks.at(-1), +current) }
  doc.visibilityState = 'hidden'; callback = null; listeners.get('visibilitychange')(); assert.equal(callback, null)
  doc.visibilityState = 'visible'; current = new Date(2026, 10, 2, 5); listeners.get('visibilitychange')(); assert.equal(welcomeGreeting(ticks.at(-1)), 'Good morning.')
  const staleCallback = callback, length = ticks.length
  stop(); assert.equal(listeners.size, 0); assert.ok(clears > 0)
  staleCallback(); assert.equal(ticks.length, length)
})


test('personal assignment urgency reuses structured task notifications and current memberships', () => {
  const { taskNotifications } = load('lib/task-notifications.ts')
  const source = { id: 'assignment', assignedAt: at(-48), submittedAt: null, reviewedAt: null, revisionRequestedAt: null, feedback: '', task: { id: 'task', clubId: 'one', title: 'Memo', kind: 'TASK', status: 'OPEN', dueAt: at(-1), club: { name: 'One', color: null } } }
  const ctx = personal({ memberClubIds: ['one'], notifications: taskNotifications([source], +now), events: [event('interview', .5)] })
  assert.equal(welcomeSubtitle(ctx, now), 'You have an overdue assignment.')
  ctx.memberClubIds = ['two']
  assert.match(welcomeSubtitle(ctx, now), /next interview/)
  ctx.memberClubIds = ['one']; source.reviewedAt = at(-.5)
  ctx.notifications = taskNotifications([source], +now)
  assert.match(welcomeSubtitle(ctx, now), /next interview/)
  source.reviewedAt = null; source.task.status = 'DONE'
  ctx.notifications = taskNotifications([source], +now)
  assert.match(welcomeSubtitle(ctx, now), /next interview/)
  ctx.events = []; source.task.status = 'OPEN'; source.task.dueAt = at(5)
  ctx.notifications = taskNotifications([source], +now)
  assert.equal(welcomeSubtitle(ctx, now), 'You have an assignment due today.')
  ctx.notifications = [{ clubId: 'one', title: 'Urgent task: 99 overdue assignments', urgent: true }]
  assert.equal(welcomeSubtitle(ctx, now), "Explore what's new in OutClass.")
})

test('personal welcome uses current authenticated applications, neutral loading and immediate data changes', () => {
  let auth = { user: { id: 'student', profile: { firstName: 'Alex' }, applications: [application({ club: { name: 'One', applicationDeadline: at(1) } })], memberships: [] }, loading: true }
  const state = { hydrated: true, events: [], notifications: [], trackedApps: [] }
  const mocks = {
    '@/contexts/auth-context': { useAuth: () => auth },
    '@/lib/application-state': { useApplicationState: () => state },
    '@/hooks/use-welcome-clock': { useWelcomeClock: () => now },
  }
  // Unrelated content uses element sentinels; the actual welcome logic is evaluated below.
  for (const name of [...fs.readFileSync('components/views/student-dashboard-view.tsx', 'utf8').matchAll(/from "(@\/components\/[^"]+)"/g)].map(m => m[1])) mocks[name] = new Proxy({}, { get: (_, key) => key })
  const { StudentDashboardView } = load('components/views/student-dashboard-view.tsx', mocks)
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
  const header = () => nodes(StudentDashboardView({ onNavigate() {}, authenticated: true, initialData: { applications: [] } })).find(n => n.type === 'WelcomeHeader').props
  assert.equal(welcomeSubtitle(header().context, header().now), "Explore what's new in OutClass.")
  auth.loading = false
  assert.equal(welcomeGreeting(header().now, header().firstName), 'Good morning, Alex.')
  assert.equal(welcomeSubtitle(header().context, header().now), 'You have an application deadline today.')
  auth.user.applications = []
  assert.equal(welcomeSubtitle(header().context, header().now), "Explore what's new in OutClass.")
  auth.user.memberships = [{ clubId: 'one', status: 'ACTIVE' }]
  state.personalTaskActivities = { userId: 'student', items: [{ clubId: 'one', taskActivity: { assignmentId: 'task', dueAt: at(-1), needsSubmission: true } }] }
  assert.equal(welcomeSubtitle(header().context, header().now), 'You have an overdue assignment.')
  state.personalTaskActivities.userId = 'other-student'
  assert.equal(welcomeSubtitle(header().context, header().now), "Explore what's new in OutClass.")
  auth.user = null
  assert.equal(welcomeGreeting(header().now, header().firstName), 'Good morning.')
})
