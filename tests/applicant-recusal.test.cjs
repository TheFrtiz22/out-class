const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const clubId = '00000000-0000-4000-8000-000000000002', applicationId = '00000000-0000-4000-8000-000000000003', otherId = '00000000-0000-4000-8000-000000000004'

function harness(actor) {
  const state = { rows: [], audits: [] }
  const tx = {
    $queryRaw: async () => [],
    application: { findFirst: async q => q.where.id === applicationId ? { id: applicationId, studentId: 'student' } : null },
    clubMember: { findFirst: async q => ({ id: q.where.id }) },
    applicantRecusal: {
      findUnique: async q => state.rows.find(r => r.applicationId === q.where.applicationId_memberId.applicationId && r.memberId === q.where.applicationId_memberId.memberId) ?? null,
      findFirst: async q => state.rows.find(r => r.applicationId === q.where.applicationId && r.memberId === q.where.memberId && r.liftedAt === null) ?? null,
      create: async q => { state.rows.push({ ...q.data, liftedAt: null }) },
      update: async q => { Object.assign(state.rows.find(r => r.memberId === q.where.applicationId_memberId.memberId), q.data) },
      findMany: async q => state.rows.filter(r => r.liftedAt === null && (!q.where.memberId || r.memberId === q.where.memberId)).map(r => ({ memberId: r.memberId, member: { user: { studentProfile: { firstName: 'Ada', lastName: 'Lee' } } } })),
    },
    auditLog: { create: async q => { state.audits.push(q.data) } },
  }
  state.actions = load('actions/recusals.ts', {
    '@/utils/prisma': { prisma: { $transaction: fn => fn(tx) } },
    '@/utils/auth': { requireClubPermission: async () => ({ user: { id: 'u-' + actor.id } }) },
    '@/lib/club-transaction-authorization': { authorizeClubTransaction: async () => actor },
  })
  state.tx = tx
  return state
}
const reviewer = { id: 'm-rev', status: 'ACTIVE', permissions: ['applications.review'], interviewOffices: [], interviewerEligible: null }
const lead = { id: 'm-lead', status: 'ACTIVE', permissions: ['recruitment.manage'], interviewOffices: [], interviewerEligible: null }
const plain = { id: 'm-plain', status: 'ACTIVE', permissions: [], interviewOffices: [], interviewerEligible: null }

test('a reviewer can step out of an applicant but cannot undo it or recuse others', async () => {
  const s = harness(reviewer)
  assert.deepEqual(await s.actions.setApplicantRecusal({ clubId, applicationId, recused: true }), { changed: true })
  assert.deepEqual(await s.actions.setApplicantRecusal({ clubId, applicationId, recused: true }), { changed: false })
  await assert.rejects(s.actions.setApplicantRecusal({ clubId, applicationId, recused: false }), /recruitment lead/)
  await assert.rejects(s.actions.setApplicantRecusal({ clubId, applicationId, memberId: otherId, recused: true }), /Only recruitment leads/)
  assert.deepEqual(s.audits.map(a => [a.action, a.details.memberId]), [['recruitment.recusal.add', 'm-rev']])
  const view = await s.actions.getApplicantRecusals({ clubId, applicationId })
  assert.deepEqual(view, { selfRecused: true, canManage: false, recused: [] }, 'non-leads never see who else stepped out')
})

test('a recruitment lead can recuse others and lift a recusal, keeping the row', async () => {
  const s = harness(lead)
  await s.actions.setApplicantRecusal({ clubId, applicationId, memberId: otherId, recused: true })
  assert.deepEqual((await s.actions.getApplicantRecusals({ clubId, applicationId })).recused, [{ memberId: otherId, name: 'Ada Lee' }])
  await s.actions.setApplicantRecusal({ clubId, applicationId, memberId: otherId, recused: false })
  assert.equal(s.rows.length, 1); assert.ok(s.rows[0].liftedAt); assert.equal(s.rows[0].liftedById, 'u-m-lead')
  assert.deepEqual(s.audits.map(a => a.action), ['recruitment.recusal.add', 'recruitment.recusal.lift'])
})

test('members with no review role cannot recuse themselves; unknown applications are refused', async () => {
  await assert.rejects(harness(plain).actions.setApplicantRecusal({ clubId, applicationId, recused: true }), /reviewers and interviewers/)
  await assert.rejects(harness(reviewer).actions.setApplicantRecusal({ clubId, applicationId: otherId, recused: true }), /unavailable/)
})

test('assertNotRecused refuses only active recusals', async () => {
  const { assertNotRecused, isRecused } = load('lib/recusal.ts')
  const rows = [{ applicationId: 'a', memberId: 'm', liftedAt: null }]
  const tx = { applicantRecusal: { findFirst: async q => rows.find(r => r.applicationId === q.where.applicationId && r.memberId === q.where.memberId && r.liftedAt === q.where.liftedAt) ?? null } }
  await assert.rejects(assertNotRecused(tx, 'a', 'm'), /stepped out/)
  assert.equal(await isRecused(tx, 'a', 'other'), false)
  rows[0].liftedAt = new Date()
  await assertNotRecused(tx, 'a', 'm')
})

test('every scoring and voting path checks recusal inside its transaction', () => {
  const read = f => fs.readFileSync(f, 'utf8')
  assert.match(read('utils/interview-access.ts'), /await assertNotRecused\(tx, app\.id, actor\.member\.id\)/)
  assert.match(read('actions/evaluations.ts'), /await assertNotRecused\(tx, app\.id, member\.id\)/)
  assert.match(read('actions/voting.ts'), /await assertNotRecused\(tx,d\.applicationId,membership\.id\)/)
  assert.match(read('actions/voting-room.ts'), /isRecused\(tx,d\.applicationId,m\.id\)/)
  assert.match(read('actions/crm.ts'), /canEvaluate: false, recused: true/)
})
