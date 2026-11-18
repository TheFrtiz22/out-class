// Applicants table photos: the row shows only the server-authorized CRM photo URL. Anonymous
// rounds, members without applicants.identify and clubs that hide photos receive none.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const clubId = id(1), appId = id(2), studentId = id(3), path = `${studentId}/photo.png`
const visibility = load('lib/profile-field-visibility.ts')
const { pipelineDetailProjection } = load('lib/pipeline-detail.ts')

function raw({ anonymousReview = false } = {}) {
  return {
    id: appId, clubId, roundId: id(4), status: 'IN_REVIEW', studentId, decisionVersion: 0, decisionStateRevision: 0, recruitmentCycleId: null, submittedAt: new Date(0), anonymousReviewText: null,
    recruitmentOffer: null, round: { id: id(4), anonymousReview, applicantDisplay: {} },
    evaluations: [], interviewAssignments: [], answers: [], bookings: [],
    student: { id: studentId, email: 's@virginia.edu', role: 'STUDENT', createdAt: new Date(0), disabledAt: null, studentProfile: {
      id: id(5), userId: studentId, firstName: 'Ada', lastName: 'Lovelace', computingId: 'al1x', major: 'Math', gradYear: 2028, transferStudent: false, gpa: 3.9, satScore: null, actScore: null,
      actEnglish: null, actMath: null, actReading: null, actScience: null, bio: '', linkedinUrl: null, resumeUrl: null, headshotUrl: path, experiences: [], scholarStatus: null, gender: null, phone: null } },
  }
}
const member = permissions => ({ id: id(6), userId: id(7), status: 'ACTIVE', isOwner: false, permissions, alumniSince: null })
const photoOf = (app, fields = visibility.defaultProfileFieldVisibility()) => visibility.restrictApplicationProfile(app, fields).student.studentProfile?.headshotUrl ?? null

test('identified rows carry only the scoped CRM photo URL, never the storage path', () => {
  const url = photoOf(pipelineDetailProjection(raw(), member(['applicants.identify', 'applications.review'])))
  assert.ok(url.startsWith('/api/profile-photos?'))
  const params = new URL(url, 'https://out-class.net').searchParams
  assert.deepEqual(Object.fromEntries(params), { path, clubId, applicationId: appId, mode: 'crm' })
})

test('anonymous rounds, members without identify and clubs hiding photos get no photo', () => {
  assert.equal(photoOf(pipelineDetailProjection(raw({ anonymousReview: true }), member(['applicants.identify', 'applications.review']))), null)
  assert.equal(photoOf(pipelineDetailProjection(raw(), member(['applications.review']))), null)
  const hidden = { ...visibility.defaultProfileFieldVisibility(), photo: false }
  assert.equal(photoOf(pipelineDetailProjection(raw(), member(['applicants.identify', 'applications.review'])), hidden), null)
})

test('the CRM photo route re-checks identify, anonymity, club visibility and the stored photo', async () => {
  let required, where, row
  const tx = { application: { findFirst: async q => { where = q.where; return row } } }
  const { authorizeCrmPhoto } = load('lib/crm-photo-authorization.ts', {
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async (_tx, _club, _user, permissions) => { required = permissions } },
    '@/lib/profile-field-visibility': visibility,
  })
  row = { id: appId, clubId, status: 'IN_REVIEW', club: { profileFieldVisibility: null }, round: { anonymousReview: false }, student: { studentProfile: { headshotUrl: path } } }
  assert.equal(await authorizeCrmPhoto(tx, 'leader', clubId, appId, path), true, 'control')
  assert.deepEqual(required, ['applicants.identify'])
  assert.deepEqual(where.round, { anonymousReview: false })
  assert.equal(await authorizeCrmPhoto(tx, 'leader', clubId, appId, `${id(9)}/other.png`), false, 'another student’s photo')
  row = { ...row, round: { anonymousReview: true } }
  assert.equal(await authorizeCrmPhoto(tx, 'leader', clubId, appId, path), false, 'anonymous round')
  row = { ...row, round: { anonymousReview: false }, club: { profileFieldVisibility: { photo: false } } }
  await assert.rejects(() => authorizeCrmPhoto(tx, 'leader', clubId, appId, path), visibility.ProfileFieldHiddenError)
  row = null
  assert.equal(await authorizeCrmPhoto(tx, 'leader', clubId, appId, path), false, 'no visible application')
})

test('the table shows the authorized photo lazily, with initials as the fallback', () => {
  const views = fs.readFileSync('components/views/leader-dashboard/live-applicant-views.tsx', 'utf8')
  assert.match(views, /fields\.photo && !anonymous\(app\) \? app\.student\.studentProfile\?\.headshotUrl \?\? null : null/)
  assert.match(views, /<AvatarImage src=\{photo\} alt="" width=\{24\} height=\{24\} loading="lazy" decoding="async"/)
  assert.match(views, /photo=\{applicantPhoto\(app, profileFields\)\}/)
  assert.match(views, /<AvatarFallback delayMs=/)
})
