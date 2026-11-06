const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

function compile(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => mocks[name] || (name.startsWith('@/lib/') ? compile(name.replace('@/', '') + '.ts') : name.startsWith('@/') || name.startsWith('./') ? new Proxy({}, { get: (_, key) => String(key) }) : require(name)), mod, mod.exports)
  return mod.exports
}
// Expand function components so the rendered markup (not just the element tree) can be inspected.
function render(node) {
  if (Array.isArray(node)) return node.map(render)
  if (!node || typeof node !== 'object') return node
  if (typeof node.type === 'function') return render(node.type(node.props))
  return { ...node, props: { ...node.props, children: render(node.props?.children) } }
}
function nodes(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(nodes)
  return [node, ...nodes(node.props?.children)]
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : ''

const status = compile('lib/application-status.ts')
const prismaStatuses = fs.readFileSync('prisma/schema.prisma', 'utf8').match(/enum AppStatus \{([^}]*)\}/)[1].trim().split(/\s+/)
const trackerStatuses = fs.readFileSync('lib/data.ts', 'utf8').match(/export type TrackerStatus = ([^\n]*)/)[1].match(/"([^"]+)"/g).map(value => value.slice(1, -1))

test('every stored, legacy and alias status maps to exactly one of the six pill states', () => {
  assert.deepEqual([...status.applicationDisplayStates], ['Draft', 'Submitted', 'In review', 'Interview', 'Accepted', 'Not accepted'])
  assert.deepEqual(prismaStatuses, ['DRAFTING', 'SUBMITTED', 'IN_REVIEW', 'INTERVIEWING', 'ACCEPTED', 'REJECTED', 'WAITLISTED'])
  const expected = { DRAFTING: 'Draft', SUBMITTED: 'Submitted', IN_REVIEW: 'In review', INTERVIEWING: 'Interview', ACCEPTED: 'Accepted', REJECTED: 'Not accepted', WAITLISTED: 'In review' }
  for (const code of prismaStatuses) assert.equal(status.applicationDisplay(code).state, expected[code], code)
  const legacy = { Drafting: 'Draft', Submitted: 'Submitted', 'In Review': 'In review', Interviewing: 'Interview', Accepted: 'Accepted', Rejected: 'Not accepted', Waitlisted: 'In review', '1st Round Interview': 'Interview', 'Decision Pending': 'In review' }
  assert.deepEqual(trackerStatuses.sort(), Object.keys(legacy).sort(), 'every TrackerStatus is covered')
  for (const [value, state] of Object.entries(legacy)) assert.equal(status.applicationDisplay(value).state, state, value)
  for (const value of ['Draft', 'Applied', 'Review', 'Interview', 'Not selected', 'not_accepted', '2nd Round Interview', 'Something new', ''])
    assert.ok(status.applicationDisplayStates.includes(status.applicationDisplay(value).state), value)
})

test('unknown or pending values never read as an outcome, and the waitlist keeps its word', () => {
  for (const value of ['Something new', 'DECISION_STAGED', 'PASS', 'Decision Pending', ''])
    assert.ok(!['Accepted', 'Not accepted'].includes(status.applicationDisplay(value).state), value)
  assert.equal(status.applicationDisplay('Something new').state, 'Submitted')
  assert.deepEqual(status.applicationDisplay('WAITLISTED'), { code: 'WAITLISTED', state: 'In review', tone: 'warning', detail: 'Waitlisted' })
  assert.equal(status.applicationDisplay('ACCEPTED').tone, 'success')
  assert.equal(status.applicationDisplay('REJECTED').tone, 'danger')
  assert.equal(status.applicationDisplay('SUBMITTED').detail, undefined)
})

test('student status comes only from the published Application.status, never staged decisions', () => {
  const source = fs.readFileSync('actions/applications.ts', 'utf8')
  const read = source.slice(source.indexOf('export async function getStudentApplications'), source.indexOf('export', source.indexOf('export async function getStudentApplications') + 10))
  assert.match(read, /where: \{ studentId: user\.id \}/)
  assert.match(read, /\n\s+status: true,/)
  for (const staged of ['votingCandidate', 'publishedStatus', 'expectedStatus', 'scheduledCommunication', 'evaluations', 'ballots'])
    assert.ok(!read.includes(staged), `student read must not select ${staged}`)
  // Home rows keep the canonical code; pre-decision codes never become decision states.
  const home = compile('lib/student-home.ts')
  const app = (code, id = code) => ({ id, clubId: id, status: code, club: { name: id } })
  const rows = home.homeApplications(prismaStatuses.map(code => app(code)), [], [])
  for (const row of rows) assert.equal(row.status, row.id)
  for (const row of rows.filter(row => !['ACCEPTED', 'REJECTED'].includes(row.id)))
    assert.ok(!['Accepted', 'Not accepted'].includes(status.applicationDisplay(row.status).state), row.id)
  assert.deepEqual(rows.filter(row => row.closed).map(row => row.id).sort(), ['ACCEPTED', 'REJECTED'])
  assert.deepEqual(rows.filter(row => row.draft).map(row => row.id), ['DRAFTING'])
  assert.equal(home.homeApplications(null, [{ id: 'l', clubId: 'l', clubName: 'L', color: '#000', status: 'Drafting' }], [])[0].draft, true)
})

test('StatusPill always renders a text label with tone and code attributes', () => {
  const { StatusPill } = compile('components/ui/status-pill.tsx', { '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') } })
  for (const code of prismaStatuses) {
    const pill = render(StatusPill({ status: code }))
    assert.equal(pill.type, 'span')
    assert.equal(pill.props['data-slot'], 'status-pill')
    assert.equal(pill.props['data-status-code'], code)
    assert.ok(text(pill).startsWith(status.applicationDisplay(code).state), code)
    assert.ok(pill.props['data-tone'])
  }
  assert.equal(text(render(StatusPill({ status: 'WAITLISTED' }))), 'In review · Waitlisted')
  assert.equal(render(StatusPill({ status: 'ACCEPTED', dot: false })).props['data-dot'], false)
  const css = fs.readFileSync('styles/product-components.css', 'utf8')
  for (const tone of ['info', 'interview', 'warning', 'success', 'danger']) assert.match(css, new RegExp(`\\.oc-status-pill\\[data-tone="${tone}"\\]`))
  assert.doesNotMatch(css.slice(css.indexOf('.oc-status-pill {')), /#[0-9a-f]{3,6}\b/i, 'pill uses semantic tokens only')
})

test('leader table uses the pill and a lock-marked hidden score, consistently per row', () => {
  const views = compile('components/views/leader-dashboard/live-applicant-views.tsx', { '@/components/icons': { Lock: 'Lock', ShieldCheck: 'ShieldCheck' } })
  const candidate = (id, statusCode, roundScore) => ({ id, studentId: id, status: statusCode, roundId: 'r', roundScore, bookings: [], student: { email: `${id}@demo.invalid`, studentProfile: null } })
  const applicants = [candidate('a', 'IN_REVIEW', null), candidate('b', 'WAITLISTED', null), candidate('c', 'ACCEPTED', { submitted: 2, required: 2, average: 8, provisional: false })]
  const tree = render(views.LiveApplicantList({ applicants, rounds: [{ id: 'r', name: 'Review' }], open() {}, compact: false, name: app => app.id, average: () => null }))
  const pills = nodes(tree).filter(node => node.type === 'StatusPill')
  assert.deepEqual(pills.map(pill => pill.props.status), ['IN_REVIEW', 'WAITLISTED', 'ACCEPTED', 'IN_REVIEW', 'WAITLISTED', 'ACCEPTED'], 'table and mobile list')
  assert.equal(nodes(tree).filter(node => node.props?.['data-slot'] === 'badge' || node.type === 'Badge').length, 0)
  const locked = nodes(tree).filter(node => node.props?.className === 'oc-review-locked')
  assert.equal(locked.length, 4, 'two hidden rows in the table and the mobile list')
  for (const row of locked) {
    assert.equal(text(row), 'Hidden until you review')
    const icon = nodes(row).find(node => node.type === 'Lock')
    assert.equal(icon.props['aria-hidden'], 'true')
  }
  assert.ok(!nodes(tree).some(node => node.type === 'Lock' && text(node.props?.children)), 'icon carries no text')
})

test('empty applicant views explain why and offer a different next action', () => {
  const views = compile('components/views/leader-dashboard/live-applicant-views.tsx', { 'next/link': { __esModule: true, default: 'Link' } })
  let cleared = 0
  const base = { clubId: 'club', canEditApplication: true, filtered: false, filtersActive: false, decisionsOnly: false, rejectedOnly: false, clearFilters: () => { cleared++ } }
  const action = props => { const tree = render(views.EmptyApplicants({ ...base, ...props })); return { tree, nodes: nodes(tree), text: text(tree) } }
  const filtered = action({ filtered: true, filtersActive: true })
  assert.match(filtered.text, /No applicants match these filters\./)
  filtered.nodes.find(node => node.type === 'Button' && text(node) === 'Clear filters').props.onClick(); assert.equal(cleared, 1)
  const empty = action({})
  assert.match(empty.text, /drafts stay private/)
  assert.equal(empty.nodes.find(node => node.type === 'Link').props.href, '/club/club/workspace?section=settings&setting=application')
  assert.equal(action({ canEditApplication: false }).nodes.find(node => node.type === 'Link').props.href, '/club/club/workspace?section=overview')
  assert.match(action({ rejectedOnly: true }).nodes.find(node => node.type === 'Link').props.href, /tool=applicants$/)
  for (const props of [{}, { canEditApplication: false }, { rejectedOnly: true }, { filtered: true }, { filtered: true, filtersActive: true }]) {
    const result = action(props)
    assert.equal(result.tree.props.role, 'status')
    assert.equal(result.nodes.filter(node => node.type === 'Button' || node.type === 'Link').filter(node => node.type !== 'Button' || !node.props.asChild).length, 1, JSON.stringify(props))
    assert.doesNotMatch(result.text, /reload|try again/i)
  }
})

test('student empty states route to a different view instead of reloading', () => {
  const home = fs.readFileSync('components/views/student-dashboard-view.tsx', 'utf8')
  const list = home.slice(home.indexOf('<div className="oc-home-empty">'), home.indexOf('oc-home-list-note'))
  assert.match(list, /onNavigate\(unavailable \? "tracker" : "explore"\)/)
  assert.doesNotMatch(list, /location\.reload/)
  const agenda = home.slice(home.indexOf('oc-home-agenda-empty'), home.indexOf('home-updates-title'))
  assert.match(agenda, /onNavigate\(agendaUnavailable \? "calendar" : "explore"\)/)
  assert.doesNotMatch(agenda, /location\.reload/)
  assert.match(home, /You’re all caught up<\/h3><p>[^<]+<\/p><Button[^\n]*onNavigate\("inbox"\)/)
  assert.match(home, /<StatusPill status=\{app\.status\} \/>/)
  const tracker = fs.readFileSync('components/views/application-tracker-view.tsx', 'utf8')
  assert.match(tracker, /No applications match “\{filter\}”\.<\/p><Button[^\n]*onClick=\{\(\) => setFilter\("All"\)\}>Show all applications/)
  for (const file of ['components/views/application-tracker-view.tsx', 'components/views/student-dashboard-view.tsx', 'components/applications/application-status-card.tsx', 'components/applications/application-status-detail.tsx', 'components/applications/application-management-card.tsx', 'components/applications/application-journey-card.tsx', 'components/views/leader-dashboard/live-applicant-views.tsx', 'components/views/leader-dashboard/live-leader-workspace.tsx']) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /StatusBadge|<Badge[^>]*>\{applicationStatusLabels/, file)
  }
})
