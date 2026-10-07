const { test } = require('node:test')
const assert = require('node:assert/strict')
const { harness } = require('./helpers/demo-harness.cjs')
const persisted = value => JSON.parse(JSON.stringify(value))

function setup(legacy = false, alreadyHydrated = false) {
  const h = harness()
  const store = h.load('lib/demo/store.ts')
  const api = h.load('lib/workspace-api.ts')
  store.demoStore.start()
  store.demoStore.mutate(s => { s.perspective.role = 'leader' })
  if (legacy) {
    const saved = structuredClone(store.demoStore.get())
    for (const member of saved.memberships) {
      delete member.status
      delete member.isOwner
      delete member.permissions
      if (!alreadyHydrated) delete member.interviewOffices
      else member.interviewOffices = []
    }
    for (const application of saved.applications) for (const evaluation of application.evaluations) delete evaluation.roundId
    if (alreadyHydrated) saved.interviewFoundation = { assignments: [], documents: [], annotations: [], history: [], audit: [] }
    else delete saved.interviewFoundation
    localStorage.setItem(store.DEMO_KEY, JSON.stringify(saved))
    store.demoStore.stop()
    store.demoStore.start()
  }
  return { h, ...store, api }
}

for (const [label, legacy, hydrated] of [['fresh', false, false], ['legacy', true, false], ['previously hydrated legacy', true, true]]) {
  test(`${label} MII demo opens a prepared applicant, persists resume/notes/completion and submits a half-point score without live actions`, async () => {
    const { h, demoStore, demoMember, api } = setup(legacy, hydrated)
    const s = demoStore.get(), club = s.clubs[0], member = demoMember()
    assert.equal(club.id, 'de000000-0000-4000-8000-000000400000')
    const workspace = await api.getInterviewWorkspace(club.id)
    assert.ok(workspace.applications.length)
    const round = club.rounds.find(r => r.name === 'Interview')
    const applicant = workspace.applications.find(a => a.roundId === round.id && !s.interviews.some(r => r.applicationId === a.id && r.completedAt))
    assert.ok(applicant)
    const scope = { clubId: club.id, applicationId: applicant.id, roundId: round.id }
    const panel = await api.getInterviewApplicantPanel(scope)
    assert.ok(panel.profile.firstName)
    const kit = await api.getInterviewKit(club.id, round.id)
    assert.ok(kit.questions.length)
    const opened = await api.openInterviewSession(scope)
    const document = await api.pinInterviewResume(scope)
    assert.equal(document.source, '/demo/sample-resume.pdf')
    const annotationId = crypto.randomUUID()
    await api.saveInterviewResumeAnnotation({ ...scope, documentId: document.id, id: annotationId, content: { kind: 'GENERAL_NOTE', anchor: null, comment: 'Demo resume comment' } })
    const draft = { ...opened.draft, questionNotes: [{ questionId: opened.questions[0].id, notes: 'Preserved private demo note' }], completedQuestionIds: [opened.questions[0].id], applicantQuestions: 'Team discussion?', additionalNotes: 'Closing draft', score: null }
    await api.saveInterviewSession({ ...scope, revision: opened.revision, draft })
    demoStore.stop()
    demoStore.start()
    const restored = await api.openInterviewSession(scope)
    assert.deepEqual(restored.draft, draft)
    assert.equal((await api.pinInterviewResume(scope)).id, document.id)
    assert.equal((await api.getInterviewResumeAnnotations({ ...scope, documentId: document.id })).annotations[0].id, annotationId)
    const submission = { ...scope, revision: restored.revision, draft: { ...restored.draft, score: 8.5 }, complete: true }
    const first = await api.saveInterviewSession(submission)
    const retry = await api.saveInterviewSession(submission)
    assert.equal(first.evaluation.score, 8.5)
    assert.equal(first.evaluation.id, retry.evaluation.id)
    assert.equal(demoStore.get().applications.find(a => a.id === applicant.id).evaluations.filter(e => e.interviewerId === member.id && e.roundId === round.id).length, 1)
    await assert.rejects(api.getInterviewWorkspace(s.clubs[1].id), /access/)
    assert.equal(h.calls(), 0)
    demoStore.stop()
  })
}

test('demo hydration preserves current explicit denials, revoked assignments and saved interview content', async () => {
  const { h, demoStore, demoMember, api } = setup()
  const s = demoStore.get(), club = s.clubs[0], member = demoMember()
  const app = s.applications.find(a => a.clubId === club.id && a.studentId !== member.userId && a.status === 'INTERVIEWING' && !s.interviews.some(r => r.applicationId === a.id))
  const scope = { clubId: club.id, applicationId: app.id, roundId: app.roundId }
  const opened = await api.openInterviewSession(scope)
  await api.saveInterviewSession({ ...scope, revision: opened.revision, draft: { ...opened.draft, additionalNotes: 'Keep existing work' } })
  demoStore.mutate(s => {
    const m = s.memberships.find(m => m.id === member.id)
    m.isOwner = false
    m.permissions = []
    m.interviewOffices = []
    s.interviewFoundation.assignments.find(a => a.applicationId === app.id && a.memberId === m.id).revokedAt = '2026-10-01T00:00:00.000Z'
  })
  const before = structuredClone(demoStore.get())
  demoStore.stop()
  demoStore.start()
  assert.deepEqual(persisted(demoStore.get()), persisted(before))
  await assert.rejects(api.getInterviewWorkspace(club.id), /access/)
  assert.equal(h.calls(), 0)
  demoStore.stop()
})

test('legacy upgrade preserves revoked grants, application edits, kit snapshots and annotations', async () => {
  const { h, demoStore, demoMember, DEMO_KEY, api } = setup()
  const s = demoStore.get(), club = s.clubs[0], member = demoMember()
  const app = s.applications.find(a => a.clubId === club.id && a.studentId !== member.userId && a.status === 'INTERVIEWING' && !s.interviews.some(r => r.applicationId === a.id))
  const scope = { clubId: club.id, applicationId: app.id, roundId: app.roundId }
  await api.openInterviewSession(scope)
  const saved = structuredClone(demoStore.get())
  const manager = saved.memberships.find(m => m.id === member.id)
  delete manager.status; delete manager.isOwner; delete manager.permissions
  saved.interviewFoundation.assignments.find(a => a.applicationId === app.id && a.memberId === member.id).revokedAt = '2026-10-01T00:00:00.000Z'
  saved.applications.find(a => a.id === app.id).answers[0].response = 'Retain customized answer'
  const protectedWork = structuredClone({ applications: saved.applications, interviews: saved.interviews, documents: saved.interviewFoundation.documents, annotations: saved.interviewFoundation.annotations })
  localStorage.setItem(DEMO_KEY, JSON.stringify(saved))
  demoStore.stop(); demoStore.start(); demoStore.refresh()
  const restored = demoStore.get()
  assert.deepEqual(persisted({ applications: restored.applications, interviews: restored.interviews, documents: restored.interviewFoundation.documents, annotations: restored.interviewFoundation.annotations }), persisted(protectedWork))
  await assert.rejects(api.openInterviewSession(scope), /panel/)
  const assignmentCount = restored.interviewFoundation.assignments.length
  demoStore.stop(); demoStore.start()
  assert.equal(demoStore.get().interviewFoundation.assignments.length, assignmentCount)
  assert.equal(h.calls(), 0)
  demoStore.stop()
})

test('legacy score mapping uses canonical identities, preserves exact historical values and leaves ambiguous records blocked', async () => {
  const { h, demoStore, DEMO_KEY, api } = setup()
  const saved = structuredClone(demoStore.get()), club = saved.clubs[0]
  const app = saved.applications.find(a => a.clubId === club.id && a.studentId !== saved.students[0].id && a.evaluations.length > 1 && a.roundId === club.rounds.find(r => r.name === 'Interview').id && !saved.interviews.some(r => r.applicationId === a.id && r.completedAt))
  const evaluation = app.evaluations[0], roundId = evaluation.roundId
  evaluation.score = 8.25
  evaluation.notes = 'Preserve historical notes exactly'
  delete evaluation.roundId
  const unknown = { ...evaluation, id: crypto.randomUUID(), roundId: null }
  app.evaluations.push(unknown)
  const before = persisted(evaluation)
  localStorage.setItem(DEMO_KEY, JSON.stringify(saved))
  demoStore.stop(); demoStore.start()
  const restored = demoStore.get().applications.find(a => a.id === app.id)
  assert.deepEqual(persisted(restored.evaluations.find(e => e.id === evaluation.id)), { ...before, roundId })
  assert.equal(restored.evaluations.find(e => e.id === unknown.id).roundId, null)
  const scope = { clubId: club.id, applicationId: app.id, roundId: app.roundId }
  const session = await api.openInterviewSession(scope)
  await assert.rejects(api.saveInterviewSession({ ...scope, revision: session.revision, draft: { ...session.draft, score: 8.5 }, complete: true }), /Historical evaluation/)
  assert.equal(h.calls(), 0)
  demoStore.stop()
})

test('profile additions preserve historical GPA and saved Demo work instead of resetting the snapshot',async()=>{
 const {h,demoStore,DEMO_KEY}=setup(),saved=structuredClone(demoStore.get());
 saved.students[0].profile.gpa=3.1234;saved.students[1].profile.gpa=4.6;saved.students[0].profile.major='Preserve customized education';
 saved.students[0].profile.highSchool='Example school';saved.students[0].profile.gender='Female';saved.students[0].profile.pronouns='She/Her';saved.students[0].profile.transferStudent=true;
 const interviews=persisted(saved.interviews);localStorage.setItem(DEMO_KEY,JSON.stringify(saved));demoStore.stop();demoStore.start();demoStore.refresh();
 const restored=demoStore.get();assert.equal(restored.students[0].profile.gpa,3.1234);assert.equal(restored.students[1].profile.gpa,4.6);assert.equal(restored.students[0].profile.major,'Preserve customized education');assert.equal(restored.students[0].profile.highSchool,'Example school');assert.equal(restored.students[0].profile.gender,'Female');assert.equal(restored.students[0].profile.pronouns,'She/Her');assert.equal(restored.students[0].profile.transferStudent,true);assert.deepEqual(persisted(restored.interviews),interviews);assert.equal(h.calls(),0);demoStore.stop();
});
