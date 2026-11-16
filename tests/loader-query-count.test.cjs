// N+1 guard for the server loaders behind /home, /corkboard, Explore and the club workspace overview.
// Each loader runs against a counting Prisma stand-in that routes every operation through the same
// lib/server-phase-trace.ts hook the real client uses (utils/prisma.ts: traceDatabaseQuery), and the
// query count comes from the phase trace. The count must not grow with the number of clubs, events,
// members or applications returned. This counts Prisma operations, not SQL statements: relation
// loads inside one operation are batched by Prisma and are not a per-row JavaScript loop.
const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path')
const { loader } = require('./helpers/communications-loader.cjs')
const root = path.resolve(__dirname, '..')

const future = () => new Date(Date.now() + 86400000)
const uuid = (kind, i) => `00000000-0000-4000-${kind}-${String(i).padStart(12, '0')}`
function row(i) {
  return {
    id: uuid('8000', i), clubId: uuid('9000', i), userId: 'u1', memberId: 'm1', name: `Club ${i}`, title: `Item ${i}`, status: 'ACTIVE', state: 'OPEN',
    isOwner: true, permissions: [], interviewOffices: [], date: future(), endDate: null, allDay: false, location: 'Rotunda', description: '',
    isPublic: true, audience: 'RECRUITMENT', revision: 1, agenda: null, body: '', publishedAt: new Date(), scheduledAt: future(), kind: 'TASK', mode: 'LIVE',
    club: { name: `Club ${i}`, suspendedAt: null, logoUrl: null, marketing: null, color: null, _count: { questions: 0 } },
    publication: { status: 'PUBLISHED', approvedRevision: 1, category: 'Social', contact: '', rsvpEnabled: false, rsvpRequired: false, capacity: null, rsvpDeadline: null, template: 'CLASSIC', flyerId: null },
    _count: { rsvps: 0, applications: 1, assignments: 1, questions: 0 },
    marketing: null, tagline: '', logoUrl: null, bannerUrl: null, category: 'Service', color: null, acceptanceRate: null, aumValue: null,
    applicationOpen: true, applicationDeadline: null, testRequirement: null, claimedAt: null, campusKey: 'uva', directorySource: null,
    pipelineRounds: [], questions: [], events: [], answers: [], bookings: [], participants: [],
    startTime: future(), endTime: future(), panelScheduleVersionId: null, publishedPanelMemberIds: [], panelScheduleVersion: null,
    room: { clubId: uuid('9000', i), roundId: 'r1', name: 'Room', location: '', timezone: 'America/New_York', buffer: 0, panelApprovedBy: 'u1', approvedPanelMemberIds: [uuid('8000', i)], panelMemberIds: [uuid('8000', i)], round: { id: 'r1', name: 'Round' } },
    task: { id: 't1', title: 'Task', dueAt: future(), kind: 'TASK' }, dueAt: future(), submittedAt: new Date(), expiresAt: future(), applicationId: 'a1', roundId: 'r1',
    round: { name: 'Round', interviewKit: null, anonymousReview: true },
    application: { id: 'a1', student: { studentProfile: null }, round: { anonymousReview: true } },
    slot: { id: 's1', startTime: future(), endTime: future(), location: '', roomId: 'room1' },
    event: { id: uuid('a000', i), clubId: uuid('9000', i), date: future(), endDate: null, title: 'Event', location: '', club: { name: `Club ${i}` } },
  }
}

function countingPrisma(n, trace) {
  const result = (model, method) => {
    if (method === 'count') return n
    if (method === 'groupBy') return [{ status: 'SUBMITTED', _count: { _all: n } }]
    if (/^find(Many)$/.test(method)) return Array.from({ length: n }, (_, i) => row(i))
    return row(0)
  }
  const raw = (...args) => trace.traceDatabaseQuery(args, async () => [])
  const stub = new Proxy({}, {
    get(_, model) {
      if (model === '$transaction') return async fn => fn(stub)
      if (model === '$queryRaw' || model === '$executeRaw') return raw
      if (typeof model !== 'string' || model === 'then') return undefined
      return new Proxy({}, { get: (_, method) => args => trace.traceDatabaseQuery(args, async () => result(model, method)) })
    },
  })
  return stub
}

function load(n, file) {
  const trace = loader({})(path.join(root, 'lib/server-phase-trace.ts'))
  const prisma = countingPrisma(n, trace)
  const membership = { id: 'm1', userId: 'u1', clubId: uuid('9000', 0), isOwner: true, status: 'ACTIVE', permissions: [], interviewOffices: [] }
  const mocks = {
    '@/utils/prisma': { prisma },
    '@/lib/server-phase-trace': trace,
    '@prisma/client': { Prisma: { sql: (strings, ...values) => ({ strings, values }) } },
    'next/cache': { unstable_cache: fn => fn, revalidatePath() {}, revalidateTag() {} },
    '@/utils/auth': {
      requireAuth: async () => ({ user: { id: 'u1' } }),
      requireClubMembership: async () => ({ user: { id: 'u1' }, membership }),
      requireClubPermission: async () => ({ user: { id: 'u1' }, membership }),
    },
    '@/utils/platform-admin': { requirePlatformAdmin: async () => ({}) },
    '@/utils/club-write-transaction': { clubWriteTransaction: async fn => fn(prisma), isWriteContention: () => false },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => {} },
  }
  return { mod: loader(mocks)(path.join(root, file)), trace }
}

/** Operations one loader call issues, read from the phase trace's structured log. */
async function queries(n, file, run) {
  const { mod, trace } = load(n, file)
  const logged = [], info = console.info, flag = process.env.OUTCLASS_PHASE_TRACE
  process.env.OUTCLASS_PHASE_TRACE = '1'; console.info = line => logged.push(line)
  try { await trace.traceWorkspaceRequest(async () => { await run(mod); return new Response(null) }) }
  finally { console.info = info; if (flag === undefined) delete process.env.OUTCLASS_PHASE_TRACE; else process.env.OUTCLASS_PHASE_TRACE = flag }
  return JSON.parse(logged.at(-1)).phases.database?.count ?? 0
}

const loaders = [
  ['/home dashboard (getStudentDashboardData + own panel assignments)', 'actions/applications.ts', mod => mod.getStudentDashboardData()],
  ['/corkboard public board (getPublicCorkboard)', 'actions/campus-events.ts', mod => mod.getPublicCorkboard()],
  ['/corkboard shared event (getPublicCampusEvent)', 'actions/campus-events.ts', mod => mod.getPublicCampusEvent('4f9c2e1a-0b2c-4d1e-8f00-123456789abc')],
  ['Explore directory (getClubDirectory)', 'actions/club-directory.ts', mod => mod.getClubDirectory()],
  ['Public club page (getPublicClub)', 'actions/club-directory.ts', mod => mod.getPublicClub(uuid('9000', 0))],
  ['Club workspace overview, full projection (getClubWorkspaceOverview)', 'actions/club-overview.ts', mod => mod.getClubWorkspaceOverview('4f9c2e1a-0b2c-4d1e-8f00-123456789abc', 'all')],
]

module.exports = { queries, loaders }
if (require.main === module) for (const [name, file, run] of loaders) {
  test(`${name}: query count is constant as rows grow (O(1), not O(n))`, async () => {
    const counts = []
    for (const n of [1, 10, 200]) counts.push(await queries(n, file, run))
    assert.ok(counts[0] > 0, 'the loader reached the database stand-in')
    assert.ok(await run(load(3, file).mod).then(value => !value?.error, () => false), 'the loader completed without an error result')
    assert.deepEqual(counts, [counts[0], counts[0], counts[0]], `queries for 1/10/200 rows: ${counts.join('/')}`)
  })
}

if (require.main === module) test('the harness detects a per-row query (control)', async () => {
  const counts = []
  for (const n of [1, 10]) counts.push(await queries(n, 'tests/fixtures/n-plus-one-loader.ts', mod => mod.perClubMeetings()))
  assert.deepEqual(counts, [2, 11])
})
