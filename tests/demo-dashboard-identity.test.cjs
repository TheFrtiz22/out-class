const { test } = require('node:test')
const assert = require('node:assert/strict')
const { harness } = require('./helpers/demo-harness.cjs')

function setup() {
  const h = harness(), store = h.load('lib/demo/store.ts')
  store.demoStore.start(h.load('lib/demo/seed.ts').createDemoSeed('2026-10-16'))
  return { h, ...store }
}

function expectedMeetings(s, id) {
  return s.meetings.filter(m => m.audience === 'RECRUITMENT' || s.memberships.some(member => member.clubId === m.clubId && member.userId === id)).map(m => m.id)
}

test('dashboard retains membership-scoped meetings, applications and attendance without identity projections in comparisons', () => {
  const x = setup(), s = x.demoStore.get(), id = s.students[0].id
  const expected = x.demoUser()
  let profileReads = 0, applicationReads = 0
  const profile = s.students[0].profile, applications = s.applications
  Object.defineProperty(s.students[0], 'profile', { configurable: true, get() { profileReads++; return profile } })
  Object.defineProperty(s, 'applications', { configurable: true, get() { applicationReads++; return applications } })
  const result = x.demoDashboard()
  assert.deepEqual(result.meetings.map(m => m.id), expectedMeetings(s, id))
  assert.deepEqual(result.applications, expected.applications)
  assert.ok(result.attendances.every(a => a.studentId === id && result.meetings.some(m => m.id === a.eventId)))
  assert.equal(applicationReads, 1 + result.applications.length, 'one list projection and one join per returned application; none from membership comparisons')
  assert.equal(profileReads, 2 * result.applications.length, 'only application joins read profiles, never meeting comparisons')
  assert.equal(x.h.calls(), 0)
  x.demoStore.stop()
})

test('dashboard uses the current snapshot identity after switching, membership revocation, reset and restart', () => {
  const x = setup(), firstId = x.demoStore.get().students[0].id
  x.demoStore.mutate(s => { [s.students[0], s.students[1]] = [s.students[1], s.students[0]] })
  const s = x.demoStore.get(), secondId = s.students[0].id
  assert.notEqual(firstId, secondId)
  assert.deepEqual(x.demoDashboard().meetings.map(m => m.id), expectedMeetings(s, secondId))
  assert.deepEqual(x.demoDashboard().applications, x.studentApplications(secondId))
  assert.ok(x.demoDashboard().attendances.every(a => a.studentId === secondId))
  x.demoStore.mutate(s => { s.memberships = s.memberships.filter(m => m.userId !== secondId) })
  assert.ok(x.demoDashboard().meetings.every(m => m.audience === 'RECRUITMENT'))
  x.demoStore.reset()
  assert.equal(x.demoStore.get().students[0].id, firstId)
  assert.deepEqual(x.demoDashboard().meetings.map(m => m.id), expectedMeetings(x.demoStore.get(), firstId))
  x.demoStore.stop()
  assert.throws(() => x.demoDashboard(), /not active/)
  x.demoStore.start()
  assert.deepEqual(x.demoDashboard().applications, x.studentApplications(firstId))
  assert.equal(x.h.calls(), 0)
  x.demoStore.stop()
})

test('missing Demo identities fail closed and dashboard reads do not persist or notify', () => {
  const x = setup()
  let writes = 0, notices = 0
  const original = localStorage.setItem
  localStorage.setItem = function(...args) { writes++; return original.apply(this, args) }
  const off = x.demoStore.subscribe(() => notices++)
  for (let i = 0; i < 5; i++) x.demoDashboard()
  assert.deepEqual({ writes, notices }, { writes: 0, notices: 0 })
  x.demoStore.get().students = [] // damaged in-memory fixture; saved snapshots already reject this shape
  assert.throws(() => x.demoDashboard(), /identity is unavailable/)
  assert.deepEqual({ writes, notices }, { writes: 0, notices: 0 })
  off(); x.demoStore.stop()
})
