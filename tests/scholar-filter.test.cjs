// Leader scholar status: display, the pipeline filter and sort, and hiding in anonymous review.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { load, uuid } = require('./helpers/voting-harness.cjs')
const { loadComponent } = require('./helpers/component-module.cjs')

const scholar = load('lib/scholar-status.ts')
const { pagePipeline, completePipelineSelection, pipelinePageQuery } = load('lib/pipeline-page.ts')
const { pipelineSummaryProjection } = load('lib/pipeline-summary.ts')
const { compareApplicants } = load('lib/live-applicant-sorting.ts')
const visibility = load('lib/profile-field-visibility.ts')

const round = uuid(9100), anonymousRound = uuid(9101), reviewer = uuid(9102), user = uuid(9103)
const echols = { selections: ['ECHOLS'], other: '' }
const jeffersonOther = { selections: ['JEFFERSON', 'OTHER'], other: 'Lawn Scholar' }
const no = { selections: ['NOT_APPLICABLE'], other: '' }
const row = (i, scholarStatus, extra = {}) => ({ id: uuid(i), studentId: uuid(i + 5000), roundId: round, status: 'SUBMITTED',
  student: { email: `s${i}@example.invalid`, studentProfile: { firstName: 'Student', lastName: String(i).padStart(3, '0'), major: 'Math', academicYear: 'First Year', gpa: null, satScore: null, actScore: null, scholarStatus } },
  evaluations: [], roundScore: null, ...extra })
// 1 Echols, 2 Jefferson + Other, 3 answered No, 4 never answered, 5 anonymous applicant who is a scholar underneath.
const rows = () => [row(1, echols), row(2, jeffersonOther), row(3, no), row(4, null), row(5, null, { studentId: `anonymous-${uuid(5)}` })]
const data = (applications = rows()) => ({ rounds: [{ id: round, order: 0 }], genderCounts: null, applications })
const ids = page => page.applications.map(a => a.id)
const page = (q) => pagePipeline(data(), q, reviewer, user, 'scope')

test('Not Applicable and unanswered stay distinct; names come from the shared labels', () => {
  assert.equal(scholar.scholarState(echols), 'scholar')
  assert.equal(scholar.scholarState(no), 'none')
  assert.equal(scholar.scholarState(null), 'unknown')
  assert.equal(scholar.scholarState(undefined), 'unknown')
  assert.equal(scholar.scholarState({ selections: ['NOT_APPLICABLE', 'ECHOLS'], other: '' }), 'unknown', 'an invalid stored value is treated as not provided')
  assert.equal(scholar.scholarSummary(echols), 'Echols Scholars Program')
  assert.equal(scholar.scholarSummary(jeffersonOther), 'Jefferson Scholars Program, Lawn Scholar')
  assert.equal(scholar.scholarSummary(no), 'Not a scholar')
  assert.equal(scholar.scholarSummary(null), null)
  assert.deepEqual(scholar.scholarStatusValue({ selections: ['ECHOLS'], other: '', extra: 'x' }), null, 'unknown keys never pass through')
  assert.deepEqual([...scholar.scholarFilterPrograms], [...scholar.scholarPrograms, 'OTHER'])
})

test('the pipeline filter: any, scholars only, not a scholar, not provided, and programs', () => {
  assert.deepEqual(ids(page({})), [1, 2, 3, 4, 5].map(uuid))
  assert.deepEqual(ids(page({ scholar: 'scholar' })), [uuid(1), uuid(2)])
  assert.deepEqual(ids(page({ scholar: 'none' })), [uuid(3)])
  assert.deepEqual(ids(page({ scholar: 'unknown' })), [uuid(4)], 'not provided excludes the anonymous applicant')
  assert.deepEqual(ids(page({ scholarPrograms: ['JEFFERSON'] })), [uuid(2)])
  assert.deepEqual(ids(page({ scholar: 'scholar', scholarPrograms: ['ECHOLS', 'OTHER'] })), [uuid(1), uuid(2)])
  assert.deepEqual(ids(page({ scholar: 'none', scholarPrograms: ['ECHOLS'] })), [], 'programs imply a scholar')
  assert.equal(page({ scholar: 'scholar' }).page.baseTotal, 5, 'totals before filtering are unchanged')
  assert.deepEqual(completePipelineSelection(data(), { scholar: 'scholar' }, reviewer, user).applications.map(a => a.id), [uuid(1), uuid(2)])
  for (const q of [{ scholar: 'yes' }, { scholarPrograms: ['NOT_APPLICABLE'] }, { scholarPrograms: ['MADE_UP'] }, { scholarPrograms: 'ECHOLS' }])
    assert.equal(pipelinePageQuery.safeParse(q).success, false, JSON.stringify(q))
})

test('scholars-first sort groups scholars, then not a scholar, then not provided; anonymous last', () => {
  assert.deepEqual(ids(page({ sort: 'scholar' })), [1, 2, 3, 4, 5].map(uuid))
  const shuffled = data([row(4, null), row(5, null, { studentId: `anonymous-${uuid(5)}` }), row(3, no), row(2, jeffersonOther), row(1, echols)])
  assert.deepEqual(ids(pagePipeline(shuffled, { sort: 'scholar' }, reviewer, user, 'scope')), [1, 2, 3, 4, 5].map(uuid))
  const a = row(1, echols), anon = row(2, echols, { studentId: `anonymous-${uuid(2)}` })
  assert.ok(compareApplicants(a, anon, 'scholar', false) < 0)
  assert.ok(compareApplicants(a, anon, 'scholar', true) < 0, 'anonymous stays last in both directions')
})

test('anonymous review and missing identify access never project scholar status', () => {
  const owner = { id: reviewer, userId: user, isOwner: true, status: 'ACTIVE' }
  const reviewerOnly = { id: reviewer, userId: user, isOwner: false, status: 'ACTIVE', permissions: ['applications.review'] }
  const raw = (anonymous, scholarStatus = echols) => ({ id: uuid(7), roundId: anonymous ? anonymousRound : round, status: 'SUBMITTED', studentId: uuid(8), round: { anonymousReview: anonymous },
    student: { email: 'ada@example.invalid', studentProfile: { firstName: 'Ada', lastName: 'Lee', major: 'Math', gradYear: 2028, transferStudent: false, gpa: 3.5, satScore: null, actScore: null, scholarStatus } },
    evaluations: [], interviewAssignments: [] })
  const identified = pipelineSummaryProjection(raw(false), owner)
  assert.deepEqual(identified.student.studentProfile.scholarStatus, echols)
  for (const [app, member] of [[raw(true), owner], [raw(false), reviewerOnly], [raw(true), reviewerOnly]]) {
    const view = pipelineSummaryProjection(app, member)
    assert.ok(view.studentId.startsWith('anonymous-'))
    assert.equal(view.student.studentProfile.scholarStatus, null)
    assert.doesNotMatch(JSON.stringify(view), /ECHOLS|Echols/)
    const result = pagePipeline({ rounds: [{ id: round, order: 0 }, { id: anonymousRound, order: 1 }], genderCounts: null, applications: [view] }, { scholar: 'unknown' }, reviewer, user, 'scope')
    assert.equal(result.page.total, 0, 'an anonymous applicant never matches a scholar filter')
  }
  assert.equal(pipelineSummaryProjection(raw(false, { selections: ['ECHOLS'], other: '', note: 'x' }), owner).student.studentProfile.scholarStatus, null)
})

test('the club setting hides scholar status, its filter and its sort', () => {
  const all = on => Object.fromEntries(visibility.profileFieldKeys.map(k => [k, on]))
  assert.equal(visibility.defaultProfileFieldVisibility().scholarStatus, true)
  assert.equal(visibility.normalizeProfileFieldVisibility({ gpa: true }).scholarStatus, true, 'clubs that saved the older map keep the default')
  assert.equal(visibility.profileFieldLabels.scholarStatus, 'Scholar status')
  const hidden = { ...all(true), scholarStatus: false }
  assert.equal(visibility.restrictProfileFields({ scholarStatus: echols, major: 'Math' }, hidden).scholarStatus, null)
  assert.deepEqual(visibility.restrictProfileFields({ scholarStatus: echols }, all(true)).scholarStatus, echols)
  const q = visibility.withoutHiddenProfileFilters({ scholar: 'scholar', scholarPrograms: ['ECHOLS'], sort: 'scholar', descending: true }, hidden)
  assert.deepEqual(q, { sort: 'name', descending: false })
  assert.deepEqual(visibility.withoutHiddenProfileFilters({ scholar: 'none', sort: 'scholar' }, all(true)), { scholar: 'none', sort: 'scholar' })
})

test('leaders see the filter only with the field shown, identify access and a non-anonymous round', () => {
  const rounds = [{ id: round, anonymousReview: false }, { id: anonymousRound, anonymousReview: true }]
  assert.equal(scholar.scholarFilterAvailable(true, true, rounds), true)
  assert.equal(scholar.scholarFilterAvailable(true, true, rounds, round), true)
  assert.equal(scholar.scholarFilterAvailable(true, true, rounds, anonymousRound), false)
  assert.equal(scholar.scholarFilterAvailable(true, true, [{ id: anonymousRound, anonymousReview: true }]), false)
  assert.equal(scholar.scholarFilterAvailable(true, false, rounds), false)
  assert.equal(scholar.scholarFilterAvailable(false, true, rounds), false)
  assert.equal(scholar.scholarFilterAvailable(true, true, []), false)
})

test('profile facts show programs or "Not a scholar", follow the club setting, and leave no empty row', () => {
  const { ApplicantProfileFacts } = loadComponent('components/views/leader-dashboard/applicant-profile-facts.tsx')
  const fields = visibility.defaultProfileFieldVisibility()
  const render = (profile, f = fields) => renderToStaticMarkup(React.createElement(ApplicantProfileFacts, { profile, fields: f }))
  assert.match(render({ scholarStatus: jeffersonOther }), /data-profile-field="scholarStatus".*Jefferson Scholars Program, Lawn Scholar/)
  assert.match(render({ scholarStatus: no }), /Not a scholar/)
  assert.equal(render({ scholarStatus: null }), '')
  assert.equal(render({ scholarStatus: echols }, { ...fields, scholarStatus: false }), '')
})

test('leader surfaces gate scholar status on anonymity and the club setting', () => {
  const flow = fs.readFileSync('components/applicant-review/applicant-review-flow.tsx', 'utf8')
  assert.match(flow, /\{profile && !anonymous && <section aria-labelledby="review-profile"/, 'profile facts render only for identified applicants')
  const board = fs.readFileSync('components/applicant-review/applicant-board.tsx', 'utf8')
  assert.match(board, /const scholar = showScholar && !anonymous \? scholarSummary/)
  const list = fs.readFileSync('components/views/leader-dashboard/live-applicant-views.tsx', 'utf8')
  assert.match(list, /\.filter\(column => column\.id !== "scholar" \|\| showScholar\)/)
  assert.match(list, /export const applicantScholar = .*anonymous\(app\) \? null/)
  const workspace = fs.readFileSync('components/views/leader-dashboard/live-leader-workspace.tsx', 'utf8')
  assert.match(workspace, /const scholarVisible = !!data && scholarFilterAvailable\(profileFields\.scholarStatus, hasPermission\(membership, "applicants\.identify"\), data\.rounds, round \|\| undefined\)/)
  assert.match(workspace, /\{!decisionsOnly && scholarVisible && <div className="oc-filter-field">/)
  assert.match(workspace, /if \(data && !scholarVisible\) \{ setScholar\(""\); setScholarPrograms\(value => value\.length \? \[\] : value\) \}/, 'a hidden filter never keeps applying')
})

test('the interview room panel follows the club setting for scholar status and photo', async () => {
  const { harness } = require('./helpers/interview-harness.cjs')
  const h = harness(), api = h.load('actions/interview-resumes.ts')
  h.tx.studentProfile.findUnique = async () => ({ firstName: 'Ada', lastName: 'Lee', headshotUrl: `${h.app.studentId}/photo.jpg`, scholarStatus: { selections: ['ECHOLS'], other: '' } })
  let panel = await api.getInterviewApplicantPanel(h.scope)
  assert.deepEqual(panel.profile.scholarStatus, echols)
  assert.ok(panel.profile.headshotUrl, 'photo shown by default')
  const all = Object.fromEntries(visibility.profileFieldKeys.map(k => [k, true]))
  h.profileFields({ ...all, scholarStatus: false, photo: false })
  panel = await api.getInterviewApplicantPanel(h.scope)
  assert.equal(panel.profile.scholarStatus, null)
  assert.equal(panel.profile.headshotUrl, null)
  assert.doesNotMatch(JSON.stringify(panel), /ECHOLS|photo\.jpg/)
  h.profileFields(null)
  h.tx.studentProfile.findUnique = async () => ({ firstName: 'Ada', lastName: 'Lee', headshotUrl: null, scholarStatus: { selections: ['ECHOLS'], other: '', note: 'private' } })
  panel = await api.getInterviewApplicantPanel(h.scope)
  assert.equal(panel.profile.scholarStatus, null, 'a stored value with extra keys never reaches the browser')
})

test('the leader detail projection passes only validated scholar selections', () => {
  const { recruitmentProfile } = load('lib/recruitment-profile.ts')
  const base = { id: 'p', userId: 'u', firstName: 'Ada', lastName: 'Lee', computingId: 'al1', major: 'Math', gradYear: 2028, transferStudent: false, gpa: null, satScore: null, actScore: null, actEnglish: null, actMath: null, actReading: null, actScience: null, bio: null, linkedinUrl: null, resumeUrl: null, headshotUrl: null, experiences: [], gender: null }
  assert.deepEqual(recruitmentProfile({ ...base, scholarStatus: jeffersonOther }).scholarStatus, jeffersonOther)
  assert.equal(recruitmentProfile({ ...base, scholarStatus: { selections: ['ECHOLS'], other: '', secret: 'x' } }).scholarStatus, null)
  assert.equal(recruitmentProfile({ ...base, scholarStatus: null }).scholarStatus, null)
})
