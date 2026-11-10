const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const { reviewerCalibration, calibrationLabel, recruitingFunnel } = load('lib/recruiting-insights.ts')
const ev = (interviewerId, applicationId, score, roundId = 'r1') => ({ interviewerId, applicationId, roundId, score })

test('calibration compares each reviewer only with others on the same applicant and round', () => {
  const rows = []
  for (const app of ['a1', 'a2', 'a3', 'a4']) rows.push(ev('lenient', app, 9), ev('typical', app, 7), ev('typical2', app, 7))
  rows.push(ev('solo', 'a9', 10)) // nobody to compare with
  const result = reviewerCalibration(rows)
  assert.deepEqual(result[0], { memberId: 'lenient', scored: 4, compared: 4, offset: 2 })
  assert.deepEqual(result.find(r => r.memberId === 'typical'), { memberId: 'typical', scored: 4, compared: 4, offset: -1 })
  assert.deepEqual(result.find(r => r.memberId === 'solo'), { memberId: 'solo', scored: 1, compared: 0, offset: null })
})

test('a reviewer who only saw strong applicants is not called lenient', () => {
  const rows = [ev('a', 'strong1', 9), ev('b', 'strong1', 9), ev('a', 'strong2', 9), ev('b', 'strong2', 9), ev('a', 'strong3', 9), ev('b', 'strong3', 9), ev('c', 'weak1', 3), ev('d', 'weak1', 3), ev('c', 'weak2', 3), ev('d', 'weak2', 3), ev('c', 'weak3', 3), ev('d', 'weak3', 3)]
  assert.ok(reviewerCalibration(rows).every(r => r.offset === 0))
})

test('needs at least three shared applicants; different rounds are separate', () => {
  const rows = [ev('x', 'a1', 9, 'r1'), ev('y', 'a1', 5, 'r1'), ev('x', 'a1', 9, 'r2'), ev('y', 'a2', 5, 'r2'), ev('x', 'a2', 9, 'r2')]
  const x = reviewerCalibration(rows).find(r => r.memberId === 'x')
  assert.deepEqual([x.compared, x.offset], [2, null])
})

test('labels and funnel', () => {
  assert.equal(calibrationLabel(null), 'Not enough shared applicants yet')
  assert.equal(calibrationLabel(0.3), 'In line with other panelists')
  assert.equal(calibrationLabel(-1.25), 'Scores 1.3 lower than other panelists on the same applicants')
  assert.deepEqual(recruitingFunnel([{ status: 'ACCEPTED', interviewed: true, offerAccepted: true }, { status: 'REJECTED', interviewed: true, offerAccepted: false }, { status: 'IN_REVIEW', interviewed: false, offerAccepted: false }]), { applied: 3, interviewed: 2, admitted: 1, joined: 1 })
})

test('action: recruitment leads only, rechecked in a read-only snapshot, no applicant identity returned', async () => {
  const checks = []
  const tx = {
    recruitmentCycle: { findMany: async () => [{ id: 'cyc', createdAt: new Date() }], findUnique: async () => ({ name: 'Spring 2027' }) },
    application: { findMany: async q => { assert.equal(q.where.recruitmentCycleId, 'cyc'); assert.equal(q.select.student, undefined); return [{ id: 'a1', status: 'ACCEPTED', bookings: [{ id: 'b' }], interviewAssignments: [], recruitmentOffer: { status: 'ACCEPTED' } }] } },
    evaluation: { findMany: async q => { assert.deepEqual(q.where.submittedAt, { not: null }); return [] } },
    clubMember: { findMany: async () => [] },
  }
  const { getRecruitingInsights } = load('actions/recruiting-insights.ts', {
    '@/utils/prisma': { prisma: { $transaction: async (fn, opts) => { assert.equal(opts.isolationLevel, 'RepeatableRead'); return fn(tx) } } },
    '@/utils/auth': { requireClubPermission: async (_c, perms) => { checks.push(perms); return { user: { id: 'u' } } } },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async (_tx, _c, _u, perms, opts) => { checks.push([perms, opts]); return { id: 'm', userId: 'u', status: 'ACTIVE', permissions: ['recruitment.manage', 'applicants.identify'], interviewOffices: ['PRESIDENT'] } } },
  })
  const result = await getRecruitingInsights('00000000-0000-4000-8000-000000000001')
  assert.deepEqual(checks, [['recruitment.manage'], [['recruitment.manage'], { readOnly: true, allowSuspendedRead: true }]])
  assert.deepEqual(result, { cycleName: 'Spring 2027', funnel: { applied: 1, interviewed: 1, admitted: 1, joined: 1 }, reviewers: [] })
})

// Reviewer calibration follows main's reviewer-score visibility and anonymous-review rules.
const CLUB = '00000000-0000-4000-8000-000000000001'
const T0 = new Date('2026-11-01T00:00:00Z')
function insights({ member, apps, evaluations, studentOf = {}, assignments = {} }) {
  const seen = { evaluationWhere: null }
  const tx = {
    recruitmentCycle: { findMany: async () => [{ id: 'cyc', createdAt: T0 }], findUnique: async () => ({ name: 'Spring 2027' }) },
    application: { findMany: async q => apps.filter(a => !q.where.round || a.anonymousRound === q.where.round.anonymousReview).map(a => ({ id: a.id, status: 'IN_REVIEW', studentId: studentOf[a.id] || `student-${a.id}`, roundId: a.roundId || 'r1', bookings: [], interviewAssignments: assignments[a.id] || [], recruitmentOffer: null })) },
    evaluation: { findMany: async q => {
      seen.evaluationWhere = q.where
      return evaluations.filter(e => q.where.applicationId.in.includes(e.applicationId) && e.submittedAt
        && !(q.where.stableRound && q.where.stableRound.anonymousReview === false && e.roundAnonymous)
        && !(q.where.interviewRecords && q.where.interviewRecords.none.anonymousReview === true && e.recordAnonymous))
        .map(({ roundAnonymous, recordAnonymous, ...e }) => e)
    } },
    clubMember: { findMany: async q => q.where.id.in.map(id => ({ id, user: { studentProfile: { firstName: id, lastName: '' } } })) },
  }
  const { getRecruitingInsights } = load('actions/recruiting-insights.ts', {
    '@/utils/prisma': { prisma: { $transaction: async fn => fn(tx) } },
    '@/utils/auth': { requireClubPermission: async () => ({ user: { id: member.userId } }) },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => member },
  })
  return getRecruitingInsights(CLUB).then(r => ({ ...r, seen }))
}
const scored = (interviewerId, applicationId, score, extra = {}) => ({ interviewerId, applicationId, roundId: 'r1', score, submittedAt: T0, ...extra })
const panel = ids => ids.flatMap(app => [scored('p', app, 9), scored('q', app, 7)])
const officer = { id: 'm-lead', userId: 'u-lead', status: 'ACTIVE', permissions: ['recruitment.manage', 'applicants.identify', 'applications.review'], interviewOffices: ['BOARD'] }

test('action: a recruitment lead with no interview office gets the funnel but no reviewer rows', async () => {
  const lead = { ...officer, interviewOffices: [] }
  const result = await insights({ member: lead, apps: ['a1', 'a2', 'a3'].map(id => ({ id })), evaluations: panel(['a1', 'a2', 'a3']) })
  assert.equal(result.funnel.applied, 3)
  assert.deepEqual(result.reviewers, [])
  const owner = await insights({ member: { ...lead, isOwner: true, permissions: [] }, apps: [{ id: 'a1' }], evaluations: panel(['a1']) })
  assert.deepEqual(owner.reviewers, [], 'no owner bypass for named scores')
})

test('action: an officer sees named calibration from visible, submitted scores', async () => {
  const result = await insights({ member: officer, apps: ['a1', 'a2', 'a3'].map(id => ({ id })), evaluations: panel(['a1', 'a2', 'a3']) })
  assert.deepEqual(result.reviewers.map(r => [r.memberId, r.compared, r.offset]), [['p', 3, 2], ['q', 3, -2]])
  assert.deepEqual(result.seen.evaluationWhere.interviewer, { clubId: CLUB })
})

test('action: anonymous-round and anonymous-record scoring contributes nothing to named rows', async () => {
  const evaluations = [
    ...panel(['a1', 'a2', 'a3']).map(e => ({ ...e, roundAnonymous: true })),
    ...['a4', 'a5', 'a6'].flatMap(app => [scored('x', app, 9), scored('y', app, 7, { recordAnonymous: true })]),
  ]
  const result = await insights({ member: officer, apps: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map(id => ({ id })), evaluations })
  assert.deepEqual(result.reviewers.map(r => [r.memberId, r.compared]), [['x', 0]])
})

test("action: evaluations on the caller's own application are excluded", async () => {
  const result = await insights({ member: officer, apps: ['mine', 'a2', 'a3'].map(id => ({ id })), studentOf: { mine: 'u-lead' }, evaluations: panel(['mine', 'a2', 'a3']) })
  assert.deepEqual(result.reviewers.map(r => [r.memberId, r.scored, r.compared, r.offset]), [['p', 2, 2, null], ['q', 2, 2, null]])
})

test('action: an officer on the panel who has not submitted cannot back out co-panelist scores', async () => {
  const seat = [{ memberId: 'm-lead', roundId: 'r1', member: officer }]
  const apps = ['a1', 'a2', 'a3'].map(id => ({ id }))
  const assignments = { a1: seat, a2: seat, a3: seat }
  const before = await insights({ member: officer, apps, assignments, evaluations: panel(['a1', 'a2', 'a3']) })
  assert.deepEqual(before.reviewers, [])
  const after = await insights({ member: officer, apps, assignments, evaluations: [...panel(['a1', 'a2', 'a3']), ...['a1', 'a2', 'a3'].map(app => scored('m-lead', app, 8))] })
  assert.deepEqual(after.reviewers.map(r => [r.memberId, r.compared]).sort(), [['m-lead', 3], ['p', 3], ['q', 3]])
})

test('action: without applicants.identify the funnel counts anonymous-round applications only', async () => {
  const result = await insights({ member: { ...officer, permissions: ['recruitment.manage'] }, apps: [{ id: 'a1', anonymousRound: true }, { id: 'a2', anonymousRound: false }], evaluations: [] })
  assert.equal(result.funnel.applied, 1)
})
