const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(n => n in mocks ? mocks[n] : n.startsWith('@/lib/') ? load(n.replace('@/', '') + '.ts', mocks) : require(n), mod, mod.exports)
  return mod.exports
}
const { declinedOfferLeaderNotification } = load('utils/decision-communications.ts')

function tx({ waitlisted = 2, leaders = [{ userId: 'lead1' }, { userId: 'owner' }], cycle = 'cycle-1' } = {}) {
  const state = { notes: [], queries: {} }
  state.tx = {
    application: {
      findUniqueOrThrow: async () => ({ recruitmentCycleId: cycle, club: { name: 'Test Club' } }),
      count: async q => { state.queries.count = q.where; return waitlisted },
    },
    clubMember: { findMany: async q => { state.queries.leaders = q.where; return leaders } },
    userNotification: { createMany: async q => { assert.equal(q.skipDuplicates, true); state.notes.push(...q.data); return { count: q.data.length } } },
  }
  return state
}

test('decision managers hear about a declined offer with the waitlist count for the same cycle', async () => {
  const s = tx()
  assert.equal(await declinedOfferLeaderNotification(s.tx, { id: 'app', clubId: 'club' }, 'offer'), 2)
  assert.deepEqual(s.queries.count, { clubId: 'club', status: 'WAITLISTED', recruitmentCycleId: 'cycle-1' })
  assert.deepEqual(s.queries.leaders, { clubId: 'club', status: 'ACTIVE', alumniSince: null, OR: [{ isOwner: true }, { permissions: { hasEvery: ['decisions.manage', 'applicants.identify'] } }] })
  assert.deepEqual(s.notes.map(n => n.userId), ['lead1', 'owner'])
  const note = s.notes[0]
  assert.equal(note.title, 'An offer to join Test Club was declined')
  assert.equal(note.body, '2 applicants are on the waitlist. Review the waitlist if you want to offer the spot.')
  assert.equal(note.href, '/club/club/workspace?section=recruitment&tool=applicants&decision=waitlisted')
  assert.equal(note.eventKey, 'offer:offer:declined:leaders', 'one notification per offer even if the decline is retried')
})

test('wording for an empty or single waitlist, and no leaders', async () => {
  let s = tx({ waitlisted: 0 }); await declinedOfferLeaderNotification(s.tx, { id: 'a', clubId: 'c' }, 'o')
  assert.equal(s.notes[0].body, 'No one is on the waitlist for this cycle.')
  s = tx({ waitlisted: 1 }); await declinedOfferLeaderNotification(s.tx, { id: 'a', clubId: 'c' }, 'o')
  assert.equal(s.notes[0].body, '1 applicant is on the waitlist. Review the waitlist if you want to offer the spot.')
  s = tx({ leaders: [] }); assert.equal(await declinedOfferLeaderNotification(s.tx, { id: 'a', clubId: 'c' }, 'o'), 0)
  s = tx({ cycle: null }); await declinedOfferLeaderNotification(s.tx, { id: 'a', clubId: 'c' }, 'o')
  assert.deepEqual(s.queries.count, { clubId: 'c', status: 'WAITLISTED' })
})

test('the decline path calls it after recording the student response; nothing is promoted automatically', () => {
  const src = fs.readFileSync('utils/recruitment-offers.ts', 'utf8')
  assert.match(src, /offerResponseNotification\(tx, app, offer\.id, "DECLINE"\);\n\s+await declinedOfferLeaderNotification\(tx, app, offer\.id\);/)
  assert.doesNotMatch(fs.readFileSync('utils/decision-communications.ts', 'utf8').split('declinedOfferLeaderNotification')[1], /application\.update|status:\s*'ACCEPTED'/)
})
