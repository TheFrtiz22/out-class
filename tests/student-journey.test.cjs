const { test } = require('node:test')
const assert = require('node:assert/strict')
const { harness } = require('./helpers/demo-harness.cjs')
const load = harness().load
const { clubRecruitment, recruitmentDate } = load('lib/recruitment-presentation.ts')
const { filterDirectory, emptyDirectoryFilters, directoryFiltersFromParams, directoryFilterParams } = load('lib/club-directory.ts')
const { applicationResponseProgress } = load('lib/student-applications.ts')
const { applicationStatusLabel } = load('lib/application-status.ts')
const { applicationStatusProgress } = load('lib/application-presentation.ts')
const now = +new Date('2026-10-07T12:00:00Z')
const club = (name, deadline, available = true) => ({ id: name, name, category: 'Finance', pitch: '', tags: [], timeCommitment: null, acceptanceRate: null, aumValue: null, applicationAvailable: available, applicationDeadline: deadline, source: 'database' })

test('cached open flags cannot advertise expired recruitment; absent dates never create urgency', () => {
  for (const date of ['2026-10-06T12:00:00Z', '2026-10-07T12:00:00Z']) {
    const state = clubRecruitment(club('expired', date), now)
    assert.equal(state.available, false)
    assert.equal(state.label, 'Deadline passed')
  }
  assert.equal(clubRecruitment(club('unknown', null), now).closingSoon, false)
  assert.equal(clubRecruitment(club('invalid', 'invalid'), now).deadline, null)
  assert.equal(clubRecruitment({ claimed: false }, now).label, 'Unclaimed profile')
  assert.equal(clubRecruitment({ source: 'preview', applicationAvailable: true }, now).available, false)
})
test('recruitment filters combine with search and sort only open published deadlines', () => {
  const source = [club('Later', '2026-10-20'), club('Expired', '2026-10-01'), club('Soon', '2026-10-10'), club('Unknown', null), club('Closed', '2026-10-09', false)]
  assert.deepEqual(filterDirectory(source, { ...emptyDirectoryFilters, recruitment: 'open', sort: 'deadline' }, now).map(c => c.name), ['Soon', 'Later', 'Unknown'])
  assert.deepEqual(filterDirectory(source, { ...emptyDirectoryFilters, recruitment: 'closing' }, now).map(c => c.name), ['Soon'])
  assert.deepEqual(filterDirectory(source, { ...emptyDirectoryFilters, query: 'finance soon', recruitment: 'open' }, now).map(c => c.name), ['Soon'])
  assert.deepEqual(source.map(c => c.name), ['Later', 'Expired', 'Soon', 'Unknown', 'Closed'])
})
test('directory query round trips preserve workspace context and clear every selected filter', () => {
  const original = new URLSearchParams('workspace=student&view=explore&category=Finance')
  const filters = { ...emptyDirectoryFilters, query: 'global markets', category: 'Finance', recruitment: 'closing', acceptance: '25', aum: 'medium', time: '3-5', sort: 'deadline' }
  const next = directoryFilterParams(original, filters)
  assert.deepEqual(directoryFiltersFromParams(next), filters)
  assert.equal(next.get('view'), 'explore')
  const cleared = directoryFilterParams(next, emptyDirectoryFilters)
  assert.equal(cleared.toString(), 'workspace=student&view=explore')
  const invalid = directoryFiltersFromParams(new URLSearchParams('recruitment=bogus&sort=bogus&time=bogus&aum=bogus&acceptance=bogus'))
  assert.deepEqual(invalid, emptyDirectoryFilters)
})
test('required response progress distinguishes nonempty answers from valid readiness', () => {
  const questions = [{ id: 'essay', type: 'ESSAY', prompt: 'Why?', required: true, wordLimit: 3 }, { id: 'choice', type: 'MULTIPLE_CHOICE', prompt: 'Choose', required: true, wordLimit: null, options: ['A', 'B'] }]
  const invalid = applicationResponseProgress(questions, [{ questionId: 'essay', response: 'too many words in here' }, { questionId: 'choice', response: 'C' }])
  assert.equal(invalid.completed, 0)
  assert.equal(invalid.ready, false)
  assert.equal(invalid.nextQuestionId, 'essay')
  const half = applicationResponseProgress(questions, [{ questionId: 'essay', response: 'A thoughtful reason' }])
  assert.equal(half.percent, 50)
  const ready = applicationResponseProgress(questions, [{ questionId: 'essay', response: 'A thoughtful reason' }, { questionId: 'choice', response: 'B' }])
  assert.equal(ready.percent, 100)
  assert.equal(ready.ready, true)
  assert.equal(ready.nextQuestionId, undefined)
  const optional = applicationResponseProgress([{ id: 'file', type: 'FILE_UPLOAD', required: false, wordLimit: null }], [{ questionId: 'file', response: 'invalid-url' }])
  assert.equal(optional.ready, false)
  assert.equal(applicationResponseProgress([], []).ready, true)
})
test('student terminology shares canonical labels without changing custom round names', () => {
  for (const status of ['DRAFTING', 'Drafting', 'Draft']) assert.equal(applicationStatusLabel(status), 'Draft')
  assert.equal(applicationStatusLabel('IN_REVIEW'), 'In review')
  assert.equal(applicationStatusLabel('In Review'), 'In review')
  assert.equal(applicationStatusLabel('INTERVIEWING'), 'Interview')
  assert.equal(applicationStatusLabel('Rejected'), 'Not selected')
  assert.equal(applicationStatusLabel('Research presentation'), 'Research presentation')
  const rounds = [{ id: 'r1', name: 'Evidence review', order: 0 }, { id: 'r2', name: 'Research presentation', order: 1 }]
  const app = { status: 'INTERVIEWING', club: { pipelineRounds: rounds }, round: rounds[1], bookings: [] }
  const stages = applicationStatusProgress(app)
  assert.equal(stages.current, 'r2')
  assert.equal(stages.stages.find(s => s.id === 'r2').name, 'Research presentation')
  assert.deepEqual(applicationStatusProgress({ ...app, status: 'DRAFTING' }).previous, [])
})
test('recruitment dates include UVA time zone and observe daylight saving changes', () => {
  assert.match(recruitmentDate('2026-10-07T20:00:00Z'), /4:00 PM EDT/)
  assert.match(recruitmentDate('2026-12-07T20:00:00Z'), /3:00 PM EST/)
})

test('public club entry retains unified Status, submitted responses, Calendar, and profile navigation', () => {
  const fs = require('node:fs'), ts = require('typescript')
  const slots = []; let cursor = 0
  const react = { ...require('react'), useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value }] }, useRef: value => { const i = cursor++; return slots[i] ??= { current: value } }, useEffect() {} }
  const window = { location: { href: '', pathname: '/club/club', search: '?ref=campus', hash: '#apply' } }
  const dependencies = { react, '@/lib/application-state': { ApplicationStateProvider: 'Provider' }, '@/contexts/auth-context': { useAuth: () => ({ user: null }) }, '@/components/views/club-profile-view': { ClubProfileView: 'ClubProfile' }, '@/components/views/application-tracker-view': { ApplicationTrackerView: 'ApplicationTracker' }, '@/components/views/calendar-view': { CalendarView: 'Calendar' }, '@/components/views/auth-view': { AuthView: 'Auth' }, '@/components/views/student-onboarding-wizard': { StudentOnboardingWizard: 'Onboarding' }, '@/components/ui/button': { Button: 'Button' }, '@/lib/workspace-api': {} }
  const mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('components/qr/public-club-page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  dependencies['@/components/landing/public-navigation'] = { PublicNavigation: 'PublicNavigation' }
  dependencies['@/components/views/landing.css'] = {}
  new Function('require', 'module', 'exports', 'window', code)(name => dependencies[name] || require(name), mod, mod.exports, window)
  function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)] }
  const render = () => { cursor = 0; return nodes(mod.exports.PublicClubPage({ club: { id: 'club' } })) }
  const profile = render().find(node => node.type === 'ClubProfile')
  assert.equal(profile.props.backLabel, 'Back to OutClass')
  profile.props.onNavigate('auth')
  assert.equal(window.location.href, '/login?next=%2Fclub%2Fclub%3Fref%3Dcampus%23apply')
  profile.props.onNavigate('student-onboarding')
  assert.equal(window.location.href, '/signup?next=%2Fclub%2Fclub%3Fref%3Dcampus%23apply')
  profile.props.onNavigate('status')
  let tracker = render().find(node => node.type === 'ApplicationTracker')
  assert.equal(tracker.props.scope, 'status')
  tracker.props.onNavigate('tracker')
  tracker = render().find(node => node.type === 'ApplicationTracker')
  assert.equal(tracker.props.scope, 'all')
  tracker.props.onNavigate('calendar')
  assert.ok(render().find(node => node.type === 'Calendar'))
  tracker.props.onNavigate('student-profile')
  assert.equal(window.location.href, '/?workspace=student&view=student-profile')
})
