const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/demo-harness.cjs');
test('legacy and fresh Demo rooms simulate selection/invitations without calling any live action',async()=>{
 const h=harness(),{demoStore,demoMember}=h.load('lib/demo/store.ts'),api=h.load('lib/workspace-api.ts'),sim=h.load('lib/demo/interview-collaboration.ts');
 demoStore.start();demoStore.mutate(s=>s.perspective.role='leader');const s=demoStore.get(),club=s.clubs[0],round=club.rounds.find(r=>r.name==='Interview');
 const work=await api.getInterviewWorkspace(club.id),app=work.applications.find(a=>a.roundId===round.id&&!a.completedRoundIds.includes(round.id));
 const scope={clubId:club.id,roundId:round.id,applicationId:app.id,clientId:crypto.randomUUID()};const own=await api.openInterviewSession(scope);
 const joined=await api.getInterviewCollaboration(scope);assert.equal(joined.simulated,true);assert.match(joined.participants[1].name,/simulated/);
 sim.simulateDemoInterviewSelection(scope);assert.ok((await api.getInterviewCollaboration(scope)).selection);
 const privateDraft={...own.draft,additionalNotes:'Private simulation note',score:null};await api.saveInterviewSession({...scope,revision:own.revision,draft:privateDraft});
 sim.simulateDemoInterviewAdvance(scope);const invite=(await api.getInterviewCollaboration(scope)).invitation;assert.ok(invite);await assert.rejects(api.prepareInterviewAdvance({...scope,invitationId:invite.id}),/Finish/);
 await api.dismissInterviewInvitation({...scope,invitationId:invite.id});assert.equal((await api.getInterviewCollaboration(scope)).invitation,null);assert.equal((await api.openInterviewSession(scope)).draft.additionalNotes,'Private simulation note');
 demoStore.stop();demoStore.start();demoStore.mutate(s=>s.perspective.role='leader');assert.equal((await api.getInterviewCollaboration(scope)).revision,1);assert.equal((await api.openInterviewSession(scope)).interviewerId,demoMember().id);assert.equal(h.calls(),0);demoStore.stop();
});
