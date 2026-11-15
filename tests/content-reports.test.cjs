const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
// Same isolated loader as tests/admin-workspace.test.cjs: real @/lib modules, mocked storage/auth.
function load(file, mocks = {}) { const mod = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name in mocks ? mocks[name] : name.startsWith('@/lib/') ? load(name.slice(2) + '.ts', mocks) : require(name), mod, mod.exports); return mod.exports }

const EVENT = '00000000-0000-4000-8000-0000000000e1', ANN = '00000000-0000-4000-8000-0000000000a1'
function world(over = {}) {
  const calls = { created: [], audits: [], touched: 0, notified: 0 }
  const state = { duplicate: null, recent: 0, staff: false, review: true, ...over }
  const member = () => state.staff ? { status: 'ACTIVE', isOwner: true, permissions: [], interviewOffices: [] } : state.review ? { status: 'ACTIVE', isOwner: false, permissions: ['applications.review'], interviewOffices: [] } : null
  const tx = {
    $queryRaw: async () => [],
    platformReport: {
      findFirst: async () => state.duplicate,
      count: async () => state.recent,
      create: async ({ data }) => { calls.created.push(data); return { id: 'report-1' } },
    },
    auditLog: { create: async ({ data }) => { calls.audits.push(data) } },
  }
  const prisma = {
    $transaction: async fn => { calls.touched++; return fn(tx) },
    club: { findFirst: async ({ where }) => where.id === 'club-1' && !state.suspended ? { id: 'club-1', marketing: { gallery: [{ url: 'https://example.edu/a.jpg', caption: '' }] } } : null },
    // The staff check selects interviewOffices; the applicant-review check does not.
    clubMember: { findUnique: async ({ where, select }) => where.userId_clubId.userId !== 'reporter' ? null : select.interviewOffices ? (state.staff ? member() : null) : member() },
    meeting: { findUnique: async ({ where }) => where.id === EVENT ? { id: EVENT, clubId: 'club-1', isPublic: true, audience: 'RECRUITMENT', revision: 2, club: { suspendedAt: null }, publication: { status: state.eventStatus ?? 'PUBLISHED', approvedRevision: 2, flyerId: 'flyer-1' } } : null },
    application: { findFirst: async ({ where }) => where.id === 'app-1' && where.clubId === 'club-1' ? { id: 'app-1', studentId: state.studentId ?? 'student-9' } : null },
    userNotification: {
      findFirst: async ({ where }) => where.userId === 'reporter' && where.announcementId === ANN && state.received !== false ? { announcement: { id: ANN, clubId: 'club-1', authorId: state.author ?? 'leader-2' } } : null,
      create: async () => { calls.notified++ }, createMany: async () => { calls.notified++ },
    },
  }
  const auth = over.anonymous ? async () => { throw Error('NEXT_REDIRECT') } : async () => ({ user: { id: 'reporter' }, impersonation: over.impersonating ? { id: 's' } : null })
  const server = load('actions/content-reports.ts', { '@/utils/prisma': { prisma }, '@/utils/auth': { requireAuth: auth } })
  return { server, calls, state }
}
const input = (target, reason = 'SPAM', details = '') => ({ target, reason, details })

test('anonymous reporters are refused before any storage is touched', async () => {
  const { server, calls } = world({ anonymous: true })
  await assert.rejects(server.reportContent(input({ type: 'club', id: 'club-1' })), /NEXT_REDIRECT/)
  assert.equal(calls.touched, 0); assert.equal(calls.created.length, 0)
})

test('support sessions cannot file reports as the impersonated user', async () => {
  const { server, calls } = world({ impersonating: true })
  assert.equal((await server.reportContent(input({ type: 'club', id: 'club-1' }))).ok, false)
  assert.equal(calls.created.length, 0)
})

test('hidden or unknown targets are refused with one indistinguishable message', async () => {
  const cases = [
    [{ suspended: true }, { type: 'club', id: 'club-1' }],
    [{}, { type: 'club', id: 'missing' }],
    [{}, { type: 'club-image', clubId: 'club-1', index: 4 }],
    [{ eventStatus: 'PENDING' }, { type: 'event', id: EVENT }],
    [{ eventStatus: 'PENDING' }, { type: 'event-flyer', eventId: EVENT }],
    [{ review: false }, { type: 'student', clubId: 'club-1', applicationId: 'app-1' }],
    [{}, { type: 'student', clubId: 'club-1', applicationId: 'other-app' }],
    [{ received: false }, { type: 'announcement', id: ANN }],
  ]
  const messages = new Set()
  for (const [over, target] of cases) {
    const { server, calls } = world(over)
    const result = await server.reportContent(input(target))
    assert.equal(result.ok, false, JSON.stringify(target)); messages.add(result.error)
    assert.equal(calls.created.length, 0)
  }
  assert.equal(messages.size, 1, 'no message reveals whether hidden content exists')
  const bad = world(); assert.equal((await bad.server.reportContent(input({ type: 'post', id: 'x' }))).ok, false)
  assert.equal((await bad.server.reportContent(input({ type: 'club', id: 'club-1' }, 'OTHER', 'x'.repeat(1001)))).ok, false)
})

test('reporters cannot report their own club, profile or announcement', async () => {
  for (const [over, target] of [[{ staff: true }, { type: 'club', id: 'club-1' }], [{ staff: true }, { type: 'event-flyer', eventId: EVENT }], [{ studentId: 'reporter' }, { type: 'student', clubId: 'club-1', applicationId: 'app-1' }], [{ author: 'reporter' }, { type: 'announcement', id: ANN }]]) {
    const { server, calls } = world(over)
    const result = await server.reportContent(input(target))
    assert.equal(result.ok, false); assert.match(result.error, /own content/); assert.equal(calls.created.length, 0)
  }
})

test('a valid report writes one report and one audit row, and never notifies anyone', async () => {
  const { server, calls } = world()
  const result = await server.reportContent(input({ type: 'event-flyer', eventId: EVENT }, 'INAPPROPRIATE', 'Offensive image'))
  assert.deepEqual(result, { ok: true, message: 'Thanks. Our team will review this.' })
  assert.equal(calls.created.length, 1)
  assert.equal(calls.created[0].kind, 'CONTENT'); assert.equal(calls.created[0].targetId, `event-flyer:${EVENT}:flyer-1`); assert.equal(calls.created[0].reporterId, 'reporter')
  assert.match(calls.created[0].summary, /^Inappropriate content · Event flyer\n\nOffensive image/)
  assert.ok(calls.created[0].summary.length >= 10)
  assert.equal(calls.audits.length, 1); assert.equal(calls.audits[0].action, 'platform.report.create'); assert.equal(calls.audits[0].details.reason, 'INAPPROPRIATE')
  assert.equal(calls.notified, 0)
  const student = world(); await student.server.reportContent(input({ type: 'student', clubId: 'club-1', applicationId: 'app-1' }, 'IMPERSONATION'))
  assert.equal(student.calls.created[0].kind, 'USER'); assert.equal(student.calls.created[0].targetId, 'student-9')
  const ann = world(); await ann.server.reportContent(input({ type: 'announcement', id: ANN }, 'HARASSMENT'))
  assert.equal(ann.calls.created[0].targetId, `announcement:club-1:${ANN}`)
})

test('copyright reports point to the DMCA section of the Terms', async () => {
  const { server } = world()
  const result = await server.reportContent(input({ type: 'club-image', clubId: 'club-1', index: 0 }, 'COPYRIGHT'))
  assert.equal(result.ok, true); assert.match(result.dmcaHref, /^\/terms#/)
})

test('the same reporter and target within 24 hours is deduplicated without a new row', async () => {
  const { server, calls } = world({ duplicate: { id: 'earlier' } })
  const result = await server.reportContent(input({ type: 'club', id: 'club-1' }))
  assert.equal(result.ok, true); assert.equal(calls.created.length, 0); assert.equal(calls.audits.length, 0)
})

test('more than 10 reports an hour from one user are refused', async () => {
  const limited = world({ recent: 10 })
  const result = await limited.server.reportContent(input({ type: 'club', id: 'club-1' }))
  assert.equal(result.ok, false); assert.match(result.error, /Try again later/); assert.equal(limited.calls.created.length, 0)
  const under = world({ recent: 9 })
  assert.equal((await under.server.reportContent(input({ type: 'club', id: 'club-1' }))).ok, true)
})

test('the admin Reports list shows a new content report with target link, reason and reporter', async () => {
  const row = { id: 'r1', kind: 'CONTENT', targetId: `announcement:club-1:${ANN}`, summary: 'Harassment or bullying · Club announcement', status: 'OPEN', revision: 0, createdAt: new Date(), reporterId: 'reporter', reporter: { id: 'reporter', email: 'r@virginia.edu', studentProfile: { firstName: 'Rae', lastName: 'Lee' } } }
  const club = { ...row, id: 'r2', kind: 'CLUB', targetId: 'club-1', summary: 'Spam · Club profile', reporter: { id: 'reporter', email: 'r@virginia.edu', studentProfile: null } }
  let where
  const prisma = { platformReport: { findMany: async q => { where = q; return [row, club] } }, clubAnnouncement: { findMany: async () => [{ id: ANN, title: 'Dues', club: { name: 'Chess' } }] }, auditLog: { create: async () => {} } }
  const server = load('actions/admin-workspace.ts', {
    'next/cache': { revalidatePath() {}, revalidateTag() {} }, '@/utils/prisma': { prisma }, '@/utils/platform-admin': { requirePlatformAdmin: async () => ({ id: 'admin' }) }, '@/utils/auth': { requireAuth: async () => ({}) },
    '@/actions/platform-organization-onboarding': {}, '@/actions/club-onboarding': {}, '@/actions/platform-admin': {}, '@/utils/club-onboarding': {}, '@/utils/email': {}, '@/utils/invitation-delivery': {}, '@/utils/invitation-background': {},
  })
  const rows = await server.listAdminReports({})
  // Support requests (and, once account deletion lands, deletion requests) stay out of the Reports list.
  const kind = where.where.kind
  assert.ok(kind.not === 'SUPPORT' || (kind.notIn || []).includes('SUPPORT'), JSON.stringify(kind))
  assert.notEqual(kind, 'SUPPORT')
  assert.equal(rows[0].target.label, 'Club announcement · Chess: Dues'); assert.equal(rows[0].target.href, '/platform/clubs?clubId=club-1')
  assert.deepEqual(rows[0].reporter, { id: 'reporter', email: 'r@virginia.edu', name: 'Rae Lee' })
  assert.match(rows[0].summary, /Harassment/)
  assert.equal(rows[1].target.href, '/club/club-1'); assert.equal(rows[1].reporter.name, '')
  const ui = fs.readFileSync('components/admin/admin-reports.tsx', 'utf8')
  assert.match(ui, /row\.target\.href/); assert.match(ui, /row\.reporter\.email/); assert.match(ui, /row\.summary/)
})

test('Report appears on every listed surface with the shared control, and stays out of live voting', () => {
  const surfaces = {
    'components/views/club-profile-view.tsx': /type: "club", id: club\.id/,
    'components/clubs/marketing-profile.tsx': /type: "club-image"/,
    'components/events/public-event-board.tsx': /type: "event", id: selected\.id[\s\S]*type: "event-flyer"/,
    // The applicant review flow (#281) replaced the workspace drawer.
    'components/applicant-review/applicant-review-flow.tsx': /type: "student"[\s\S]*hidden=\{app\.studentId === membership\.userId \|\| !canReview\}/,
    'components/views/inbox-view.tsx': /type: "announcement"[\s\S]*hidden=\{selected\.ownAnnouncement\}/,
  }
  for (const [file, pattern] of Object.entries(surfaces)) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /import \{ ReportContentButton \} from "@\/components\/reports\/report-content-button"/, file)
    assert.match(source, pattern, file)
  }
  assert.match(fs.readFileSync('components/views/club-profile-view.tsx', 'utf8'), /real && !preview && <ReportContentButton/)
  const control = fs.readFileSync('components/reports/report-content-button.tsx', 'utf8')
  assert.match(control, /import \{ Flag \} from "@\/components\/icons"/)
  assert.match(control, /if \(!user \|\| demo\.isDemoEnabled \|\| isImpersonating \|\| hidden\) return null/)
  assert.match(control, /ownerUserId === user\.id/); assert.match(control, /hasWorkspace\(m\)/)
  assert.match(control, /from "@\/components\/ui\/dialog"/)
  for (const file of fs.readdirSync('components/live-voting')) if (/\.tsx?$/.test(file)) assert.doesNotMatch(fs.readFileSync(`components/live-voting/${file}`, 'utf8'), /ReportContentButton/)
  assert.doesNotMatch(fs.readFileSync('actions/content-reports.ts', 'utf8'), /notification-delivery|sendEmail|enqueue|userNotification\.create/)
})

test('the older platform report action only files support requests', () => {
  const src = fs.readFileSync('actions/admin-workspace.ts', 'utf8')
  const fn = src.slice(src.indexOf('export async function submitPlatformReport'), src.indexOf('export async function resolveAdminReport'))
  // User, club, event and content reports must go through reportContent, which checks visibility.
  assert.match(fn, /kind: z\.literal\("SUPPORT"\)/)
  assert.doesNotMatch(fn, /findUnique/)
  assert.match(fn, /if \(impersonation\) throw/)
})
