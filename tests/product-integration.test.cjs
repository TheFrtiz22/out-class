const { test } = require('node:test')
const assert = require('node:assert/strict')
const { harness } = require('./helpers/demo-harness.cjs')
function setup(anchor = '2099-10-03') {
  const h = harness(), { demoStore, demoDashboard } = h.load('lib/demo/store.ts')
  const { createDemoSeed } = h.load('lib/demo/seed.ts')
  demoStore.start(createDemoSeed(anchor))
  return { ...h, store: demoStore, dashboard: demoDashboard, api: h.load('lib/workspace-api.ts'), seed: createDemoSeed }
}
test('current demo graph is deterministic, connected, and resets every new workflow without production calls', async () => {
  const h = setup(), { demoSnapshotSchema } = h.load('lib/demo/validate.ts'), initial = structuredClone(h.store.get())
  assert.equal(demoSnapshotSchema.safeParse(initial).success, true)
  assert.deepEqual(initial, h.seed(initial.anchor))
  assert.ok(initial.students[0].profile.experiences.length >= 5)
  assert.equal(initial.votingSessions.length, 2)
  const published = initial.votingSessions.find(s => s.publishedAt), live = initial.votingSessions.find(s => !s.publishedAt)
  assert.equal(live.passes.length, 2)
  assert.ok(live.candidates.every(c => initial.applications.find(a => a.id === c.applicationId).status === c.expectedStatus))
  assert.ok(published.candidates.every(c => initial.applications.find(a => a.id === c.applicationId).status === c.publishedStatus))
  assert.ok(initial.observations.every(o => initial.applications.some(a => a.id === o.applicationId)))
  assert.ok(initial.interviews.some(i => i.completedAt) && initial.interviews.some(i => !i.completedAt))
  const original = JSON.stringify(initial)
  h.store.mutate(s => { s.corkboard = []; s.votingSessions = []; s.observations = []; s.recruitingRules = []; s.interviewRooms = []; s.roomBookings = []; s.interviews = []; s.tutorials.student.status = 'COMPLETED' })
  h.store.reset(); assert.equal(JSON.stringify(h.store.get()), original)
  h.store.reset(); assert.equal(JSON.stringify(h.store.get()), original)
  h.store.stop(); h.store.start(initial); assert.equal(JSON.stringify(h.store.get()), original)
  assert.equal(h.calls(), 0)
})
test('student profile → Explore filters → Corkboard → shared club → application draft/submission → tracker/calendar persists', async () => {
  const h = setup(), { filterDirectory, emptyDirectoryFilters } = h.load('lib/club-directory.ts')
  const profile = (await h.api.getStudentProfile()).profile
  assert.equal(profile.firstName, 'Jordan'); assert.ok(profile.experiences.length >= 5)
  await h.api.updateStudentProfileSection({ section: 'identity', firstName: 'Jordan', lastName: 'Avery' })
  const directory = (await h.api.getClubDirectory()).clubs
  const club = filterDirectory(directory, { ...emptyDirectoryFilters, query: 'AIF', category: 'Finance' })[0]
  assert.ok(club); await h.api.setCorkboardClub({ clubId: club.id, saved: true })
  assert.equal((await h.api.getCorkboard()).items.find(i => i.club.id === club.id).club.id, club.id)
  assert.equal((await h.api.getPublicClub(club.id)).club.id, club.id)
  const { applicationId } = await h.api.startClubApplication(club.id)
  const answers = club.questions.map(q => ({ questionId: q.id, response: 'Sample: tested assumptions, compared alternatives, and revised our evidence-based recommendation.' }))
  await h.api.saveApplicationDraft({ clubId: club.id, answers })
  h.store.stop(); h.store.start()
  assert.equal((await h.api.getStudentApplications()).find(a => a.id === applicationId).status, 'DRAFTING')
  await h.api.submitApplication({ clubId: club.id, answers })
  h.store.stop(); h.store.start()
  const app = (await h.api.getStudentApplications()).find(a => a.id === applicationId)
  assert.equal(app.status, 'SUBMITTED'); assert.ok(app.submittedAt); assert.equal(app.answers.length, answers.length)
  await assert.rejects(h.api.submitApplication({ clubId: club.id, answers }), /submitted/)
  const mii = (await h.api.getStudentApplications()).find(a => a.clubId === h.store.get().clubs[0].id)
  const schedule = await h.api.getApplicantSchedule(mii.id)
  assert.ok(schedule.booking); assert.equal(schedule.booking.id, mii.bookings[0].slot.id)
  assert.ok(h.load('lib/student-calendar-data.ts').studentCalendarEvents(h.dashboard()).some(event => event.id.includes(schedule.booking.id)))
  const invited = (await h.api.getStudentApplications()).find(a => a.clubId === h.store.get().clubs[1].id)
  let times = await h.api.getApplicantSchedule(invited.id)
  assert.equal(times.booking, null); assert.equal(times.rooms.length, 1)
  await h.api.reserveInterview({ applicationId: invited.id, slotId: times.rooms[0].slots[0].id })
  h.store.stop(); h.store.start(); times = await h.api.getApplicantSchedule(invited.id)
  assert.equal(typeof times.rooms[0].slots[0].startTime, 'string')
  assert.equal(typeof times.booking.startTime, 'string')
  assert.doesNotThrow(() => [...times.rooms[0].slots].sort((a,b) => a.startTime.localeCompare(b.startTime)))
  assert.ok(times.booking)
  assert.ok(h.load('lib/student-calendar-data.ts').studentCalendarEvents(h.dashboard()).some(e => e.id.includes(times.booking.id)))
  await h.api.reserveInterview({ applicationId: invited.id, slotId: times.rooms[0].slots[1].id })
  times = await h.api.getApplicantSchedule(invited.id)
  assert.equal(times.booking.slotId, times.rooms[0].slots[1].id)
  await h.api.cancelRoomBooking(times.booking.id)
  assert.equal((await h.api.getApplicantSchedule(invited.id)).booking, null)
  assert.equal(h.calls(), 0)
})
test('leader kits → configured applicant → Pros/Cons → interview → repeated voting → reopen → explicit publish reaches student', async () => {
  const h = setup(), clubId = h.store.get().clubs[0].id
  h.store.mutate(s => { s.perspective = { role: 'leader', clubId } })
  const draftRecord = h.store.get().interviews.find(i => i.clubId === clubId && !i.completedAt), scope = { clubId, applicationId: draftRecord.applicationId, roundId: draftRecord.roundId }
  const rooms = await h.api.getRoomWorkspace(clubId)
  assert.ok(rooms.rooms.every(r => r.slots.every(slot => typeof slot.startTime === 'string')))
  assert.equal(typeof rooms.bookings[0].startTime, 'string')
  const kit = await h.api.getInterviewKit(clubId, scope.roundId)
  await h.api.saveInterviewKit(clubId, scope.roundId, kit.version, [...kit.questions, { id: 'de000000-0000-4000-8000-000009999999', prompt: 'How did you measure impact?', guidance: 'Look for evidence.' }])
  let interview = await h.api.openInterviewSession(scope)
  assert.equal(interview.questions.length, kit.questions.length, 'existing interview preserves its kit snapshot')
  await h.api.saveApplicantObservation({ clubId, applicationId: scope.applicationId, kind: 'PRO', body: 'Sample: explained a concrete trade-off.' })
  const config = await h.api.getApplicantDisplayConfiguration(clubId, scope.roundId)
  await h.api.saveApplicantDisplayConfiguration({ clubId, roundId: scope.roundId, version: config.version, config: { version: 1, fields: ['name', 'experiences', 'gpa', 'resume', 'pros', 'cons', 'score', 'feedback'] } })
  let display = await h.api.getApplicantDisplay(scope)
  assert.ok(display.observations.some(o => o.body.includes('trade-off')))
  assert.equal(display.links[0].href, '/demo/sample-resume.pdf')
  const draft = { ...interview.draft, overallReview: 'Sample: strong reasoning and thoughtful follow-through.', score: 9 }
  await h.api.saveInterviewSession({ ...scope, revision: interview.revision, draft })
  h.store.stop(); h.store.start(); interview = await h.api.openInterviewSession(scope)
  assert.equal(interview.draft.score, 9)
  await h.api.saveInterviewSession({ ...scope, revision: interview.revision, draft, complete: true })
  display = await h.api.getApplicantDisplay(scope)
  assert.ok(display.sections.find(s => s.field === 'feedback').items.some(v => v.includes('strong reasoning')))
  let workspace = await h.api.getVotingWorkspace(clubId), sessionId = workspace.session.id
  const before = new Map(h.store.get().applications.map(a => [a.id, a.status]))
  const command = async (action, extra = {}) => { workspace = await h.api.getVotingWorkspace(clubId, sessionId); await h.api.commandVotingSession({ clubId, sessionId, revision: workspace.session.revision, action, ...extra }); workspace = await h.api.getVotingWorkspace(clubId, sessionId) }
  assert.equal(workspace.summary.targetReached, true); assert.equal(workspace.session.state, 'OPEN')
  const oldPass = JSON.stringify(workspace.session.passes[0])
  const current = workspace.session.passes[1]
  for (const c of current.candidates.filter(c => !c.ballots.length)) await h.api.submitVotingBallot({ clubId, sessionId, passNumber: 2, applicationId: c.applicationId, decision: 'PASS' })
  await command('COMPLETE_PASS'); await command('START_PASS')
  assert.equal(workspace.session.currentPass, 3)
  for (const c of workspace.session.passes[2].candidates) await h.api.submitVotingBallot({ clubId, sessionId, passNumber: 3, applicationId: c.applicationId, decision: 'PASS' })
  await command('COMPLETE_PASS'); await command('FINISH'); await command('REOPEN'); await command('FINISH')
  assert.equal(JSON.stringify(workspace.session.passes[0]), oldPass)
  assert.ok(h.store.get().applications.every(a => a.status === before.get(a.id)), 'all voting and finishing preserve application statuses')
  const passHistory = JSON.stringify(workspace.session.passes)
  await command('PUBLISH', { applicationIds: workspace.summary.outcomes.map(o => o.applicationId) })
  assert.ok(workspace.session.publishedAt); assert.equal(JSON.stringify(workspace.session.passes), passHistory)
  await assert.rejects(command('REOPEN'), /sealed/)
  h.store.stop(); h.store.start()
  h.store.mutate(s => { s.perspective.role = 'student' })
  const own = (await h.api.getStudentApplications()).find(a => a.clubId === clubId)
  assert.equal(own.status, 'ACCEPTED')
  assert.equal(h.calls(), 0)
})
test('demo tutorials persist independently, keep old indices, reset deterministically, and cannot access live actions', async () => {
  const h = setup(), clubId = h.store.get().clubs[0].id, { tutorialSteps } = h.load('lib/tutorials.ts')
  assert.equal(tutorialSteps.student.length, 8); assert.equal(tutorialSteps.leader.length, 6)
  assert.equal((await h.api.getTutorial('student')).status, 'SKIPPED')
  await h.api.saveTutorial({ experience: 'student', action: 'restart', step: 0 })
  await h.api.saveTutorial({ experience: 'student', action: 'progress', step: 6 })
  h.store.stop(); h.store.start(); assert.equal((await h.api.getTutorial('student')).step, 6)
  await assert.rejects(h.api.getTutorial('leader', clubId), /leader/)
  h.store.mutate(s => { s.perspective.role = 'leader' })
  await h.api.saveTutorial({ experience: 'leader', clubId, action: 'restart', step: 0 })
  await h.api.saveTutorial({ experience: 'leader', clubId, action: 'complete', step: 5 })
  assert.equal((await h.api.getTutorial('student')).step, 6)
  assert.equal((await h.api.getTutorial('leader', clubId)).status, 'COMPLETED')
  await assert.rejects(h.api.saveTutorial({ experience: 'leader', clubId, action: 'progress', step: 6 }))
  assert.match(tutorialSteps.leader.map(s => s.text).join(' '), /Pros and Cons.*interview kits.*passes.*publish/)
  h.store.reset(); assert.equal((await h.api.getTutorial('student')).status, 'SKIPPED')
  assert.equal(h.calls(), 0)
})
test('saved demo graph rejects broken current-workflow relationships and privacy configs', () => {
  const h = setup(), { demoSnapshotSchema } = h.load('lib/demo/validate.ts')
  for (const breakGraph of [
    s => { s.observations[0].applicationId = s.clubs[0].id },
    s => { s.interviewRooms[0].panelMemberIds = [s.memberships.find(m => m.clubId !== s.clubs[0].id).id] },
    s => { s.roomBookings[0].slotId = s.clubs[0].id },
    s => { s.roomBookings.push(structuredClone(s.roomBookings[0])) },
    s => { s.votingSessions[1].passes[0].candidates[0].ballots.push(structuredClone(s.votingSessions[1].passes[0].candidates[0].ballots[0])) },
    s => { s.applicantDisplay[s.clubs[0].rounds[0].id].config.fields = ['secret'] },
  ]) { const snapshot = structuredClone(h.store.get()); breakGraph(snapshot); assert.equal(demoSnapshotSchema.safeParse(snapshot).success, false) }
})

test('older admin demo templates reset safely without restarting saved applications or requiring new tutorial fields', async () => {
  const h = setup(), template = h.seed('2099-10-03')
  for (const key of ['tutorials', 'interviewRooms', 'roomBookings', 'applicantDisplay', 'observations', 'votingSessions', 'votingAudit', 'corkboard']) delete template[key]
  for (const club of template.clubs) { delete club.claimed; for (const round of club.rounds) { delete round.interviewKit; delete round.kitVersion } }
  global.localStorage.data.clear(); h.store.stop(); h.store.start(template)
  const normalized = JSON.stringify(h.store.get())
  await h.api.saveTutorial({ experience: 'student', action: 'restart', step: 0 })
  h.store.reset()
  assert.equal(JSON.stringify(h.store.get()), normalized)
  assert.equal((await h.api.getTutorial('student')).status, 'SKIPPED')
  assert.equal((await h.api.getCorkboard()).items.length, 2)
  assert.deepEqual(h.store.get().applications, template.applications)
  assert.equal(h.calls(), 0)
})

test('demo publication enforces production conflict rules and atomically rejects duplicate or moved candidates', async () => {
  const h = setup(), clubId = h.store.get().clubs[0].id
  h.store.mutate(s => { s.perspective.role = 'leader' })
  let view = await h.api.getVotingWorkspace(clubId), sessionId = view.session.id
  const command = async (action, extra = {}) => { view = await h.api.getVotingWorkspace(clubId, sessionId); return h.api.commandVotingSession({ clubId, sessionId, revision: view.session.revision, action, ...extra }) }
  await command('COMPLETE_PASS'); await command('FINISH')
  view = await h.api.getVotingWorkspace(clubId, sessionId)
  const ids = view.summary.outcomes.filter(o => o.outcome === 'PASS').map(o => o.applicationId), initial = JSON.stringify(h.store.get())
  await assert.rejects(command('PUBLISH', { applicationIds: [ids[0], ids[0]] }), /Duplicate/)
  assert.equal(JSON.stringify(h.store.get()), initial)
  h.store.mutate(s => { s.applications.find(a => a.id === ids[1]).roundId = s.clubs[0].rounds[0].id })
  const moved = JSON.stringify(h.store.get())
  await assert.rejects(command('PUBLISH', { applicationIds: ids }), /changed/)
  assert.equal(JSON.stringify(h.store.get()), moved)
  assert.equal((await h.api.getVotingWorkspace(clubId, sessionId)).session.publishedAt, null)
  assert.equal(h.calls(), 0)
})

test('Demo profile photos/PDF/LinkedIn survive reload and reset with no production uploads', async () => {
  const h=setup(), initial=structuredClone(h.store.get());
  assert.equal(initial.students[0].profile.resumeUrl,'/demo/sample-resume.pdf');
  assert.equal(initial.students[0].profile.headshotUrl,'/demo/sample-headshot.svg');
  assert.match(initial.students[0].profile.linkedinUrl,/^https:\/\/linkedin\.com\//);
  assert.ok(initial.students.some(s=>!s.profile.headshotUrl));
  const data=new FormData();data.set('kind','resume');data.set('file',new Blob(['%PDF-']), 'resume.pdf');
  await assert.rejects(h.api.uploadProfileFile(data),/disabled|Demo/i);
  h.store.mutate(s=>{s.students[0].profile.headshotUrl=null;s.students[0].profile.resumeUrl=null});
  h.store.stop();h.store.start();assert.equal((await h.api.getStudentProfile()).profile.headshotUrl,null);
  h.store.reset();assert.equal((await h.api.getStudentProfile()).profile.headshotUrl,initial.students[0].profile.headshotUrl);
  assert.equal((await h.api.getStudentProfile()).profile.resumeUrl,initial.students[0].profile.resumeUrl);assert.equal(h.calls(),0);
});

test('browser-origin Demo projection has one résumé link and a working photo URL',async t=>{
  const previous=global.window;t.after(()=>{if(previous===undefined)delete global.window;else global.window=previous});
  global.window={location:{origin:'http://localhost:3000'}};
  const h=setup();h.store.mutate(s=>{s.perspective.role='leader'});
  const student=h.store.get().students[0];const app=h.store.get().applications.find(a=>a.studentId===student.id&&a.clubId===h.store.get().clubs[0].id);
  h.store.mutate(s=>{const round=s.clubs[0].rounds.find(r=>r.id===app.roundId);round.anonymousReview=false});
  const view=await h.api.getApplicantDisplay({clubId:app.clubId,applicationId:app.id});
  assert.equal(view.links.filter(l=>l.field==='resume').length,1);assert.equal(view.photo,'http://localhost:3000/demo/sample-headshot.svg');
});

test('Demo voting setup → QR-scoped member join → synchronized voting → multiple passes → publish → reset stays isolated',async()=>{
 const h=setup(),state=h.store.get(),clubId=state.clubs[0].id,leader=state.memberships.find(m=>m.clubId===clubId&&m.role==='PRESIDENT'),member=state.memberships.find(m=>m.clubId===clubId&&m.id!==leader.id);
 h.store.mutate(s=>{s.perspective.role='leader'});
 const pool=state.applications.filter(a=>a.clubId===clubId&&a.status==='INTERVIEWING'),roundId=pool[0].roundId,candidates=pool.filter(a=>a.roundId===roundId).slice(0,2);
 const initial=structuredClone(state),config={version:1,fields:['name','photo','gpa','act','resume']};
 const id=await h.api.createVotingSession({clubId,roundId,applicationIds:candidates.map(a=>a.id),participantIds:[leader.id],targetSize:1,displayConfig:config});
 const command=(action,extra={})=>h.api.commandVotingSession({clubId,sessionId:id,revision:h.store.get().votingSessions.find(s=>s.id===id).revision,action,...extra});
 assert.equal((await h.api.getVotingJoinInfo(id)).status,'NOT_JOINABLE');await command('OPEN_JOIN');await h.api.joinVotingSession(id,member.id);await h.api.joinVotingSession(id,leader.id);
 assert.equal((await h.api.joinVotingSession(id,member.id)).alreadyJoined,true);assert.equal(h.store.get().votingSessions.find(s=>s.id===id).participants.length,2);
 await assert.rejects(command('CONFIGURE',{displayConfig:{version:1,fields:['gpa']}}),/locked/);
 await command('START_PASS');let joined=await h.api.getJoinedVotingWorkspace(id,member.id);assert.equal(joined.canManage,false);assert.equal(joined.session.activeApplicationId,candidates[0].id);
 const round=state.clubs[0].rounds.find(r=>r.id===roundId);h.store.mutate(s=>{s.applicantDisplay[round.id].config={version:1,fields:[]}});
 const view=await h.api.getApplicantDisplay({clubId,applicationId:candidates[0].id,sessionId:id});assert.deepEqual(view.configured,config.fields);
 for(const [i,app]of candidates.entries()){
  await command('SET_CANDIDATE',{applicationId:app.id});joined=await h.api.getJoinedVotingWorkspace(id,member.id);assert.equal(joined.session.activeApplicationId,app.id);
  for(const demoMemberId of [leader.id,member.id])await h.api.submitVotingBallot({clubId,sessionId:id,passNumber:1,applicationId:app.id,decision:i?'HOLD':'PASS',demoMemberId});
 }
 assert.equal(h.store.get().applications.find(a=>a.id===candidates[0].id).status,'INTERVIEWING');await command('COMPLETE_PASS');await command('START_PASS');
 for(const demoMemberId of [leader.id,member.id])await h.api.submitVotingBallot({clubId,sessionId:id,passNumber:2,applicationId:candidates[1].id,decision:'PASS',demoMemberId});
 await command('COMPLETE_PASS');await command('FINISH');assert.equal((await h.api.getVotingJoinInfo(id)).status,'FINISHED');await command('REOPEN');await h.api.joinVotingSession(id,member.id);await command('FINISH');await command('PUBLISH',{applicationIds:candidates.map(a=>a.id)});
 assert.equal(h.store.get().votingSessions.find(s=>s.id===id).passes.length,2);assert.ok(candidates.every(a=>h.store.get().applications.find(v=>v.id===a.id).status==='ACCEPTED'));
 h.store.reset();h.store.mutate(s=>{s.perspective.role='leader'});assert.deepEqual(h.store.get().votingSessions,initial.votingSessions);assert.equal(h.calls(),0);
});
