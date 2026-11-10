const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const { currentEligibleVoterIds, recusedVoterCounts } = load('utils/voting-rules.ts')
const { summarizeVoting } = load('lib/voting-engine.ts')
const voter = id => ({ id, status: 'ACTIVE', permissions: ['applications.review', 'decisions.vote', 'applicants.identify'] })
function tx(recusals) {
  return {
    clubMember: { findMany: async q => q.where.id.in.map(voter) },
    applicantRecusal: { findMany: async q => recusals.filter(r => (q.where.applicationId?.in ?? [q.where.applicationId]).includes(r.applicationId) && q.where.memberId.in.includes(r.memberId) && q.where.liftedAt === null) },
  }
}

test('a recused member is outside that applicant\'s electorate only', async () => {
  const t = tx([{ applicationId: 'a1', memberId: 'm2' }])
  assert.deepEqual(await currentEligibleVoterIds(t, 'c', ['m1', 'm2'], false, 'a1'), ['m1'])
  assert.deepEqual(await currentEligibleVoterIds(t, 'c', ['m1', 'm2'], false, 'a2'), ['m1', 'm2'])
  assert.deepEqual(await currentEligibleVoterIds(t, 'c', ['m1', 'm2'], false), ['m1', 'm2'], 'without an applicant nothing changes')
})

test('two-voter unanimous room: one recusal no longer blocks the other voter\'s Pass', async () => {
  const session = { participants: [{}, {}], targetSize: 5, autoAdvance: 'UNANIMOUS', threshold: 100, candidates: [{ applicationId: 'a1' }, { applicationId: 'a2' }],
    passes: [{ number: 1, candidates: [{ applicationId: 'a1', override: null, ballots: [{ decision: 'PASS' }] }, { applicationId: 'a2', override: null, ballots: [{ decision: 'PASS' }] }] }] }
  const counts = await recusedVoterCounts(tx([{ applicationId: 'a1', memberId: 'm2' }]), ['m1', 'm2'], ['a1', 'a2'])
  assert.deepEqual([...counts], [['a1', 1]])
  const out = summarizeVoting(session, counts).outcomes
  assert.deepEqual(out.map(o => [o.applicationId, o.outcome, o.automatic]), [['a1', 'PASS', true], ['a2', 'UNRESOLVED', false]])
  assert.deepEqual(summarizeVoting(session).outcomes.map(o => o.outcome), ['UNRESOLVED', 'UNRESOLVED'], 'default unchanged')
})

test('every electorate and legacy count path is applicant-aware', () => {
  const read = f => fs.readFileSync(f, 'utf8')
  const room = read('actions/voting-room.ts')
  assert.equal((room.match(/round\.anonymousReview,(d|current)\.applicationId\)/g) || []).length, 3, 'cast, open and close')
  assert.match(read('actions/voting-discussion.ts'), /round\.anonymousReview,d\.applicationId\)/)
  const legacy = read('actions/voting.ts')
  assert.match(legacy, /const voters=s\.participants\.length-/)
  assert.match(legacy, /summarizeVoting\(s,recused\)/)
  assert.match(legacy, /summarizeVoting\(s,await recusedVoterCounts/)
  assert.match(read('utils/voting-publication.ts'), /summarizeVoting\(s,recused\)/)
  assert.match(read('actions/decision-schedules.ts'), /session\._count\.participants-\(recused\.get\(id\)\?\?0\)/)
})
