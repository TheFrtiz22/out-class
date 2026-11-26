// The interview room on a round reviewed without an interview (Application review, Case / Task) says "Review", not
// "Interview". Found live on LiveQA's "Written application" round: "Interview · Written application",
// "Interview complete" and "Average interview score".
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { harness } = require('./helpers/demo-harness.cjs')

test('review rounds are Application review and Case / Task; interview and custom rounds stay interviews', () => {
  const { isReviewRound } = harness().load('lib/interview-round-kind.ts')
  for (const type of ['APPLICATION_REVIEW', 'CASE_TASK']) assert.equal(isReviewRound(type), true, type)
  for (const type of ['INTERVIEW', 'GROUP_INTERVIEW', 'CUSTOM', 'VOTE', 'FINAL_DECISION', null, undefined]) assert.equal(isReviewRound(type), false, String(type))
})

test('the room workspace marks each round, on the server read and in Demo', async () => {
  const action = fs.readFileSync('actions/interview-kits.ts', 'utf8')
  assert.match(action, /select: \{ id: true, name: true, type: true, archivedAt: true/)
  assert.match(action, /review: isReviewRound\(r\.type\)/)
  const h = harness(), store = h.load('lib/demo/store.ts'), api = h.load('lib/workspace-api.ts')
  store.demoStore.start(); store.demoStore.mutate(s => { s.perspective.role = 'leader' })
  const club = store.demoStore.get().clubs[0], workspace = await api.getInterviewWorkspace(club.id)
  assert.ok(workspace.rounds.length)
  for (const round of workspace.rounds) assert.equal(round.review, ['APPLICATION_REVIEW', 'CASE_TASK'].includes(club.rounds.find(r => r.id === round.id).type), round.name)
})

test('room title, closing heading and round score follow the round kind', () => {
  const view = fs.readFileSync('components/views/interview-workspace-view.tsx', 'utf8')
  assert.match(view, /task: round \? `\$\{round\.review \? "Review" : "Interview"\} · \$\{round\.name\}`/)
  assert.match(view, /<InterviewKitSession key=\{`\$\{active\.id\}-\$\{round\.id\}`\} review=\{!!round\.review\}/)
  const kit = fs.readFileSync('components/interview-kit-session.tsx', 'utf8')
  assert.match(kit, /session\.completedAt \? \(review \? "Review complete" : "Interview complete"\)/)
  // A review round has no interview, so its closing note is "Final thoughts" (label and length message).
  assert.match(kit, /<label htmlFor="final-interview-thoughts">\{review \? "Final thoughts" : "Final interview thoughts"\}<\/label>/)
  assert.match(kit, /\$\{review \? "Final thoughts" : "Final interview thoughts"\} must be 50 words or fewer/)
  assert.match(kit, /<RoundScore review=\{review\}/)
  const refs = fs.readFileSync('components/interview-review-references.tsx', 'utf8')
  assert.match(refs, /review \? "Average review score" : "Average interview score"/)
})

test('"haven\'t booked a time slot yet" counts interview rounds only and opens that applicant', () => {
  const { firstUnbooked } = harness().load('lib/interview-round-kind.ts')
  const workspace = { rounds: [{ id: 'written', review: true }, { id: 'first', review: false }], applications: [{ id: 'a1', roundId: 'written', assignedRoundIds: ['written'] }, { id: 'a2', roundId: 'first', assignedRoundIds: ['written', 'first'] }] }
  assert.equal(firstUnbooked({ ...workspace, applications: [workspace.applications[0]] }, []), null, 'a review round is never "unbooked"')
  assert.deepEqual(firstUnbooked(workspace, []), { applicationId: 'a2', roundId: 'first' })
  assert.equal(firstUnbooked(workspace, [{ applicationId: 'a2', roundId: 'first' }]), null, 'a booked interview clears it')
  assert.equal(firstUnbooked({ ...workspace, applications: [{ id: 'a3', roundId: 'written', assignedRoundIds: ['first'] }] }, []), null, 'an assignment outside the applicant\'s current round cannot be opened, so it is not offered')
  assert.equal(firstUnbooked({ ...workspace, rounds: [{ id: 'first', archived: true }] }, []), null, 'nor one in an archived round')
  const src = fs.readFileSync('components/interviews/interview-rooms-list.tsx', 'utf8')
  assert.match(src, /interviewTab=rooms&roundId=\$\{encodeURIComponent\(unbooked\.roundId\)\}&applicationId=\$\{encodeURIComponent\(unbooked\.applicationId\)\}/)
})
