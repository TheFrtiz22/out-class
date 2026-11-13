const {unwrapActions}=require('./helpers/action-result.cjs');
// Authorization review follow-ups: hidden profile fields cannot leak through voting selection,
// voting academic years, identity reveal, direct file routes, résumé highlights or the viewer.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const lib = load('lib/profile-field-visibility.ts')
const all = on => Object.fromEntries(lib.profileFieldKeys.map(k => [k, on]))
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const clubId = id(1), roundId = id(2)

// ---- 1. Voting candidate selection -------------------------------------------
test('voting selection: GPA, major and year filters and sorts cannot reveal hidden values', async () => {
  const { readVotingCandidateSelection } = load('lib/voting-candidate-selection.ts')
  // Names sort Ada, Ben, Cy; GPAs sort the other way; only Cy is above 3.5.
  const people = [['Cy', 3.9, 'Physics', 2027], ['Ada', 3.1, 'Math', 2028], ['Ben', 3.4, 'Math', 2029]]
  const rows = people.map(([first, gpa, major, gradYear], i) => ({ id: id(10 + i), roundId, status: 'IN_REVIEW', studentId: id(20 + i), student: { email: `${first}@virginia.edu`, studentProfile: { firstName: first, lastName: 'X', major, gradYear, transferStudent: false, gpa, satScore: 1400, actScore: 30 } } }))
  const tx = { application: { findMany: async () => structuredClone(rows) } }
  const m = { id: id(30), userId: id(31), status: 'ACTIVE', isOwner: true, permissions: [] }
  const rounds = [{ id: roundId, name: 'Review', order: 0, anonymousReview: false, applicantDisplay: {} }]
  const select = (query, fields) => readVotingCandidateSelection(tx, clubId, m, rounds, query, new Map([[roundId, false]]), fields).then(r => r.applications.map(a => a.id))
  const hidden = { ...all(true), gpa: false, major: false, academicYear: false }
  const base = await select({}, hidden)
  assert.deepEqual(await select({ gpa: 3.5 }, all(true)), [id(10)], 'control: the filter works when GPA is shown')
  assert.deepEqual(await select({ sort: 'gpa' }, all(true)), [id(11), id(12), id(10)], 'control: GPA order differs from name order')
  assert.deepEqual(await select({ gpa: 3.5 }, hidden), base, 'a GPA filter on a hidden GPA is ignored: same IDs as no filter')
  assert.deepEqual(await select({ sort: 'gpa' }, hidden), await select({ sort: 'name' }, hidden), 'GPA sort falls back to name order')
  assert.deepEqual(await select({ sort: 'gpa', descending: true }, hidden), await select({ sort: 'name' }, hidden))
  assert.deepEqual(await select({ major: 'Physics' }, hidden), base)
  assert.deepEqual(await select({ year: 'Fourth Year' }, hidden), base)
  assert.deepEqual(await select({ sort: 'year' }, hidden), await select({ sort: 'name' }, hidden))
  assert.deepEqual(base, await select({ sort: 'name' }, hidden))
  const voting = fs.readFileSync('actions/voting.ts', 'utf8')
  assert.match(voting, /select: \{ suspendedAt: true, profileFieldVisibility: true \}/)
  assert.match(voting, /new Map\(allRounds\.map\(round => \[round\.id, round\.anonymousReview\]\)\), profileFields\)/)
})

// ---- 2. Voting academic years ------------------------------------------------
test('voting workspace returns no academic years when the club hides class year', async () => {
  const { harness } = require('./helpers/voting-harness.cjs')
  const h = harness(); h.seed()
  assert.ok((await h.read()).academicYears.length > 0, 'control: years are returned by default')
  h.tx.club.findUnique = async () => ({ suspendedAt: null, profileFieldVisibility: { academicYear: false } })
  assert.deepEqual((await h.read()).academicYears, [])
})

// ---- 4. Direct file routes ---------------------------------------------------
const pdf = new Blob([new Uint8Array([37, 80, 68, 70, 45, 49])], { type: 'application/pdf' })
const storage = blob => ({ createClient: () => ({ storage: { getBucket: async () => ({ data: { public: false } }), from: () => ({ download: async () => ({ data: blob }) }) } }) })
test('/api/recruiting-resumes returns 404 when the club hides résumés', async () => {
  const studentId = id(51), appId = id(50)
  let visibility = null
  const tx = { $queryRaw: async () => [], application: { findFirst: async q => { assert.deepEqual(q.include.club, { select: { profileFieldVisibility: true } }); return { id: appId, clubId, roundId, studentId, round: { anonymousReview: false }, club: { profileFieldVisibility: visibility } } } }, pipelineRound: { findFirst: async () => ({ anonymousReview: false }) }, studentProfile: { findUnique: async () => ({ resumeUrl: `${studentId}/resume.pdf` }) } }
  const shared = { '@/lib/profile-field-visibility': lib, '@/utils/interview-access': { interviewActor: async () => ({ member: { status: 'ACTIVE', isOwner: true } }) } }
  // The proxy and the résumé summary share utils/recruiting-resume.ts for the authorized read.
  const deps = { ...shared, '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } }, '@/utils/support-audit': { auditSupportAction: async () => {} }, '@supabase/supabase-js': storage(pdf) }
  const route = load('app/api/recruiting-resumes/route.ts', { ...deps,
    '@/utils/auth': { requireAuth: async () => ({ user: { id: 'leader' } }) },
    '@/utils/recruiting-resume': load('utils/recruiting-resume.ts', deps),
  })
  const get = () => route.GET(new Request(`https://out-class.net/api/recruiting-resumes?clubId=${clubId}&applicationId=${appId}`))
  process.env.SUPABASE_SECRET_KEY ??= 'test-only'
  assert.equal((await get()).status, 200, 'control: served when résumés are shown')
  visibility = { resume: false }
  const hidden = await get()
  assert.equal(hidden.status, 404)
  assert.equal(await hidden.text(), 'Not found')
})

test('/api/profile-photos returns 404 for CRM access when the club hides photos; a student’s own photo is unchanged', async () => {
  const studentId = id(61), appId = id(60), path = `${studentId}/p.png`
  let visibility = null
  const tx = { application: { findFirst: async q => { assert.deepEqual(q.select.club, { select: { profileFieldVisibility: true } }); return { id: appId, clubId, status: 'IN_REVIEW', club: { profileFieldVisibility: visibility }, round: { anonymousReview: false }, student: { studentProfile: { headshotUrl: path } } } } } }
  const shared = { '@/lib/profile-field-visibility': lib, '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => ({}) } }
  let actor = 'leader'
  const route = load('app/api/profile-photos/route.ts', { ...shared,
    'next/server': { NextResponse: class extends Response {} },
    '@/utils/auth': { requireAuth: async () => ({ user: { id: actor } }) }, '@/utils/support-audit': { auditSupportAction: async () => {} },
    '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } }, '@/lib/crm-photo-authorization': load('lib/crm-photo-authorization.ts', shared),
    '@/actions/applicant-intelligence': {}, '@/actions/interview-resumes': {}, '@/actions/evaluations': {},
    '@supabase/supabase-js': storage(new Blob([new Uint8Array([1])], { type: 'image/png' })),
  })
  const get = query => route.GET(new Request(`https://out-class.net/api/profile-photos?${new URLSearchParams(query)}`))
  process.env.SUPABASE_SECRET_KEY ??= 'test-only'
  const crm = { path, clubId, applicationId: appId, mode: 'crm' }
  assert.equal((await get(crm)).status, 200, 'control: leader sees the photo by default')
  visibility = { photo: false }
  assert.equal((await get(crm)).status, 404)
  actor = studentId
  assert.equal((await get({ path })).status, 200, 'the student’s own photo is not affected')
})

// ---- 5. Résumé highlights ----------------------------------------------------
test('résumé highlights follow the résumé setting: not offered, cited or shown, and setup refuses them', async () => {
  assert.equal(lib.allowedByProfileCeiling('resumeHighlight', all(true)), true)
  assert.equal(lib.allowedByProfileCeiling('resumeHighlight', { ...all(true), resume: false }), false)
  const { votingHighlightChoices } = load('utils/voting-room-presentation.ts', { '@/utils/interview-access': { authorizeInterview: async () => {} }, '@/utils/additional-observations': {} })
  let visibility = null
  const tx = { interviewResumeAnnotation: { findMany: async q => { assert.deepEqual(q.select.document.select.round, { select: { club: { select: { profileFieldVisibility: true } } } }); return [{ id: 'h1', anchor: { page: 1, quote: 'Led a fund' }, document: { id: 'd', roundId, round: { club: { profileFieldVisibility: visibility } } } }] } } }
  assert.equal((await votingHighlightChoices(tx, clubId, id(70), 'u')).length, 1, 'control: offered when résumés are shown')
  visibility = { resume: false }
  assert.deepEqual(await votingHighlightChoices(tx, clubId, id(70), 'u'), [], 'no choices, so setup, preparation and prepared slides have nothing to cite')
  // Setup refuses resumeHighlight when résumés are hidden.
  const { validateVotingSetup } = load('utils/voting-room-setup.ts', { '@/utils/voting-room-presentation': { votingHighlightChoices: async () => [] } })
  const setupTx = { pipelineRound: { findFirst: async () => ({ id: roundId, clubId, anonymousReview: false, club: { profileFieldVisibility: { resume: false } } }) }, recruitmentCycle: { findFirst: async () => ({ id: id(3) }) }, application: { findMany: async () => { throw new Error('past field validation') } } }
  const input = { clubId, sessionId: id(71), cycleId: id(3), roundId, leaderMemberIds: [id(72)], participantIds: [id(72)], applicationIds: [id(73)], targetSize: null, presentationOptions: { fields: ['name', 'resumeHighlight'], highlights: {} } }
  await assert.rejects(validateVotingSetup(setupTx, input, { id: 'u' }, { rejectHiddenProfileFields: true }), /hidden by the club/)
  // The live slide only asks for a highlight when the club shows résumés.
  assert.match(fs.readFileSync('actions/voting-room.ts', 'utf8'), /options\?\.fields\.includes\("resumeHighlight"\)&&allowedByProfileCeiling\("resumeHighlight",normalizeProfileFieldVisibility\(app\.club\?\.profileFieldVisibility\)\)/)
})

// ---- 6. Résumé viewer --------------------------------------------------------
test('external image résumé links are not fetched when the viewer opens', () => {
  const { resumePreviewKind } = load('lib/resume-preview-kind.ts')
  assert.equal(resumePreviewKind('https://files.example.edu/r.png'), 'external')
  assert.equal(resumePreviewKind('https://files.example.edu/r.JPG?x=1'), 'external')
  const src = fs.readFileSync('components/resume-viewer-dialog.tsx', 'utf8')
  assert.doesNotMatch(src, /<img\b/, 'no third-party image request')
})

// ---- 3. Identity reveal ------------------------------------------------------
test('identity reveal returns the identity but not profile fields the club hides', async () => {
  const appId = id(40)
  const application = club => ({ id: appId, clubId, roundId, status: 'SUBMITTED', studentId: id(41), submittedAt: new Date(), club, round: { anonymousReview: true, applicantDisplay: {} }, student: { id: id(41), email: 'ada@virginia.edu', createdAt: new Date(), studentProfile: { id: 'p', userId: id(41), firstName: 'Ada', lastName: 'Lee', major: 'Math', computingId: 'al1', gradYear: 2028, gpa: 3.6, satScore: 1500, actScore: 32, actMath: 33, resumeUrl: 'https://example.com/r.pdf', headshotUrl: null, linkedinUrl: 'https://www.linkedin.com/in/ada', bio: null, experiences: [] } }, answers: [], bookings: [], evaluations: [] })
  let row
  const tx = { user: { findUnique: async () => ({ disabledAt: null }) }, clubMember: { findUnique: async () => ({ status: 'ACTIVE', isOwner: true }) }, $queryRaw: async () => [], application: { findFirst: async q => { assert.deepEqual(q.include.club, { select: { profileFieldVisibility: true } }); return row } }, auditLog: { create: async () => {} } }
  const api = unwrapActions(load('actions/crm.ts', {
    '@/utils/auth': { requireClubPermission: async () => ({ user: { id: 'manager' } }) },
    '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } },
    '@/utils/club-write-transaction': {}, '@/utils/recruitment-offers': {}, 'next/cache': { revalidatePath() {} },
  }))
  row = application(null)
  let result = await api.revealApplicantIdentity(clubId, appId, 'Resolve an application issue')
  assert.equal(result.student.email, 'ada@virginia.edu')
  assert.equal(result.student.studentProfile.firstName, 'Ada')
  assert.equal(result.student.studentProfile.gpa, null, 'GPA hidden by default')
  assert.equal(result.student.studentProfile.linkedinUrl, null, 'LinkedIn hidden by default')
  assert.equal(result.student.studentProfile.major, 'Math')
  assert.equal('club' in result, false)
  row = application({ profileFieldVisibility: { gpa: true, linkedin: true, major: false, resume: false } })
  result = await api.revealApplicantIdentity(clubId, appId, 'Resolve an application issue')
  assert.equal(result.student.studentProfile.gpa, 3.6)
  assert.equal(result.student.studentProfile.major, '')
  assert.equal(result.student.studentProfile.resumeUrl, null)
})
