// S1-4 "Previously applied": reviewer-only history computed from existing
// Application rows in the same club, through the production CRM read with a
// stubbed transaction. No database, no network.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const icons = require('./helpers/icons.cjs')

function loadAny(file, mocks) {
  const mod = { exports: {} }
  const source = path.resolve(__dirname, '..', file)
  const code = ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const resolve = n => { const base = n.replace('@/', ''); return fs.existsSync(path.resolve(__dirname, '..', base + '.ts')) ? base + '.ts' : base + '.tsx' }
  new Function('require', 'module', 'exports', code)(n => n in mocks ? mocks[n] : n.startsWith('@/') ? loadAny(resolve(n), mocks) : require(n), mod, mod.exports)
  return mod.exports
}

const clubId = '00000000-0000-4000-8000-000000000002'
const otherClub = '00000000-0000-4000-8000-000000000009'
const at = d => new Date(`2026-${d}T12:00:00Z`)
const identifier = { id: 'm-lead', userId: 'u-lead', status: 'ACTIVE', permissions: ['applications.review', 'applicants.identify'], interviewOffices: [] }
const decider = { ...identifier, permissions: [...identifier.permissions, 'decisions.manage'] }

function application(id, studentId, { anonymous = false, submittedAt = at('09-01') } = {}) {
  return { id, clubId, roundId: anonymous ? 'anon' : 'round', status: 'SUBMITTED', studentId, submittedAt, recruitmentOffer: null, interviewAssignments: [], bookings: [], answers: [], evaluations: [],
    round: { id: anonymous ? 'anon' : 'round', name: 'Review', anonymousReview: anonymous, applicantDisplay: null },
    student: { id: studentId, email: `${studentId}@virginia.edu`, studentProfile: { id: `p-${studentId}`, firstName: 'A', lastName: studentId, gradYear: 2028, gpa: 3.5, experiences: [] } } }
}

/** Every Application row in the "database", across two clubs. */
function harness(viewer, current, { history = [], recusals = [] } = {}) {
  const queries = { detail: 0, history: [] }
  const rows = [...current.map(a => ({ ...a, recruitmentCycle: { name: 'Fall 2026' } })), ...history]
  const tx = {
    applicantRecusal: { findMany: async q => recusals.filter(r => r.memberId === q.where.memberId && q.where.applicationId.in.includes(r.applicationId)) },
    pipelineRound: { findMany: async () => [
      { id: 'round', name: 'Review', order: 0, type: 'REVIEW', anonymousReview: false, applicantDisplay: null, archivedAt: null },
      { id: 'anon', name: 'Blind', order: 1, type: 'REVIEW', anonymousReview: true, applicantDisplay: null, archivedAt: null }] },
    application: { findMany: async q => {
      if (q.include) { queries.detail++; return current.map(a => structuredClone(a)) }
      queries.history.push(q)
      // Honour exactly the scope the production query asked for.
      return rows.filter(r => r.clubId === q.where.clubId && q.where.studentId.in.includes(r.studentId) && r.status !== q.where.status.not)
        .map(r => Object.fromEntries(Object.keys(q.select).map(k => [k, r[k]])))
    } },
  }
  const crm = loadAny('actions/crm.ts', { '@/utils/auth': { requireClubPermission: async () => ({ membership: viewer }) }, '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx) } }, 'next/cache': { revalidatePath: () => {} } })
  return { queries, read: async () => (await crm.getClubPipeline(clubId)).applications }
}
const earlier = (id, studentId, club = clubId, cycle = 'Spring 2026') => ({ id, clubId: club, studentId, status: 'REJECTED', submittedAt: at('02-01'), recruitmentCycle: { name: cycle } })

test('a prior application in the same club shows the badge with its cycle', async () => {
  const h = harness(identifier, [application('a2', 's1')], { history: [earlier('a1', 's1')] })
  const [app] = await h.read()
  assert.deepEqual(app.priorApplications, [{ cycleName: 'Spring 2026', submittedAt: at('02-01'), status: null }])
  assert.equal(h.queries.history[0].where.clubId, clubId)
})

test('the earlier outcome is sent only to viewers who may already see decisions', async () => {
  const plain = harness(identifier, [application('a2', 's1')], { history: [earlier('a1', 's1')] })
  await plain.read()
  assert.equal(plain.queries.history[0].select.status, undefined, 'status is not even selected')
  const lead = harness(decider, [application('a2', 's1')], { history: [earlier('a1', 's1')] })
  assert.equal((await lead.read())[0].priorApplications[0].status, 'REJECTED')
})

test('an application to another club never produces the badge', async () => {
  const h = harness(decider, [application('a2', 's1')], { history: [earlier('x1', 's1', otherClub, 'Other Club Fall')] })
  const [app] = await h.read()
  assert.deepEqual(app.priorApplications, [])
  assert.doesNotMatch(JSON.stringify(app), /Other Club Fall|x1/)
})

test('anonymous review hides the badge entirely and skips the history read', async () => {
  const h = harness(decider, [application('a2', 's1', { anonymous: true })], { history: [earlier('a1', 's1')] })
  const [app] = await h.read()
  assert.deepEqual(app.priorApplications, [])
  assert.equal(h.queries.history.length, 0)
  assert.doesNotMatch(JSON.stringify(app), /Spring 2026/)
})

test('a recused reviewer does not see history for that applicant; others still do', async () => {
  const h = harness(decider, [application('a2', 's1'), application('b2', 's2')], { history: [earlier('a1', 's1'), earlier('b1', 's2')], recusals: [{ applicationId: 'a2', memberId: 'm-lead' }] })
  const [recused, other] = await h.read()
  assert.equal(recused.recused, true)
  assert.deepEqual(recused.priorApplications, [])
  assert.deepEqual(h.queries.history[0].where.studentId.in, ['s2'], 'the recused applicant is not even queried')
  assert.equal(other.priorApplications.length, 1)
})

test('never shown about the viewer\'s own application', async () => {
  const h = harness(decider, [application('a2', 'u-lead')], { history: [earlier('a1', 'u-lead')] })
  assert.deepEqual((await h.read())[0].priorApplications, [])
  assert.equal(h.queries.history.length, 0)
})

test('a list of 50 applicants reads history in exactly one narrow query', async () => {
  const current = Array.from({ length: 50 }, (_, i) => application(`c${i}`, `s${i}`))
  const history = current.map((a, i) => earlier(`p${i}`, a.studentId))
  const h = harness(decider, current, { history })
  const apps = await h.read()
  assert.equal(h.queries.detail, 1)
  assert.equal(h.queries.history.length, 1, 'no N+1')
  assert.deepEqual(Object.keys(h.queries.history[0].select).sort(), ['id', 'recruitmentCycle', 'status', 'studentId', 'submittedAt'])
  assert.deepEqual(h.queries.history[0].select.recruitmentCycle, { select: { name: true } })
  assert.ok(apps.every(app => app.priorApplications.length === 1))
})

test('the chip reuses StatusMark with a Phosphor icon and short copy', () => {
  const { PreviouslyAppliedBadge } = loadAny('components/previously-applied-badge.tsx', { '@/components/icons': icons, '@/lib/utils': { cn: (...c) => c.filter(Boolean).join(' ') } })
  const render = props => renderToStaticMarkup(React.createElement(PreviouslyAppliedBadge, props))
  assert.equal(render({ priors: [] }), '')
  const list = render({ priors: [{ cycleName: 'Spring 2026', submittedAt: null, status: null }] })
  assert.match(list, /data-slot="status-pill"/)
  assert.match(list, /data-icon-pack="phosphor"/)
  assert.match(list, /Previously applied<span class="sr-only">: Spring 2026<\/span>/)
  assert.doesNotMatch(list, /selected/i, 'no outcome when the server withheld it')
  const detail = render({ priors: [{ cycleName: 'Spring 2026', submittedAt: '2026-02-01T12:00:00Z', status: 'REJECTED' }, { cycleName: null, submittedAt: '2025-09-10T12:00:00Z', status: null }], detail: true })
  assert.match(detail, / · Spring 2026 \(not selected\), Sep 2025/)
})

test('students never receive history: the badge only renders inside reviewer pipeline views', () => {
  const users = require('node:child_process').execFileSync('git', ['grep', '--untracked', '-l', 'PreviouslyAppliedBadge', '--', 'app', 'components'], { encoding: 'utf8' }).trim().split('\n').sort()
  assert.deepEqual(users, ['components/previously-applied-badge.tsx', 'components/views/leader-dashboard/live-applicant-views.tsx', 'components/views/leader-dashboard/live-leader-workspace.tsx'])
  const prior = require('node:child_process').execFileSync('git', ['grep', '--untracked', '-l', 'loadPriorApplications', '--', 'actions', 'app', 'lib', 'utils'], { encoding: 'utf8' }).trim().split('\n').sort()
  assert.deepEqual(prior, ['actions/crm.ts', 'lib/prior-applications.ts'])
})
