const {test}=require('node:test'),assert=require('node:assert/strict');const {harness}=require('./helpers/demo-harness.cjs');
test('isolated live-room Demo prepares, joins, votes, changes, refreshes and retries with zero live actions and unchanged reads do not persist',async()=>{
 const h=harness(),{demoStore}=h.load('lib/demo/store.ts');demoStore.start();demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});
 const s=demoStore.get(),clubId=s.clubs[0].id,roundId=s.clubs[0].rounds.find(r=>r.name==='Interview').id;
 const leader=s.memberships.find(m=>m.clubId===clubId&&m.isOwner),voter=s.memberships.find(m=>m.clubId===clubId&&!m.isOwner);
 demoStore.mutate(s=>s.memberships.find(m=>m.id===voter.id).permissions.push('decisions.vote'));
 const api=h.load('lib/voting-room-api.ts'),setup=await api.getLiveVotingSetup({clubId,roundId,cycleId:clubId});assert.ok(setup.applicants.length);
 const sessionId=crypto.randomUUID(),scope={clubId,sessionId};await api.createLiveVotingRoom({...scope,cycleId:clubId,roundId,targetSize:null,applicationIds:setup.applicants.slice(0,2).map(a=>a.id),leaderMemberIds:[leader.id],participantIds:[leader.id,voter.id],presentationOptions:{fields:['name','gpa','interviewScore'],highlights:{}}});
 assert.equal((await api.getLiveVotingJoinInfo({...scope,sessionId:crypto.randomUUID()},voter.id)).status,'EXPIRED');
 let writes=0,save=localStorage.setItem.bind(localStorage);localStorage.setItem=(...args)=>{writes++;save(...args)};
 for(let i=0;i<4;i++){await api.getLiveVotingRoom(scope);await api.getLiveVotingJoinInfo(scope,voter.id);await api.getLiveVotingSetup({clubId,roundId,cycleId:clubId});}assert.equal(writes,0);
 await api.joinLiveVotingRoom(scope,voter.id);await api.joinLiveVotingRoom(scope,voter.id);assert.equal(writes,1);
 const command=async action=>api.commandLiveVotingRoom({...scope,action,confirmed:true,revision:(await api.getLiveVotingRoom(scope)).revision,requestId:crypto.randomUUID()});await command('START');await command('OPEN_VOTING');
 let room=await api.getLiveVotingRoom(scope,voter.id);const input={...scope,requestId:crypto.randomUUID(),passNumber:room.passNumber,applicationId:room.currentApplicantId,choice:'ACCEPT',ballotRevision:null};
 assert.equal((await api.castLiveVotingBallot(input,voter.id)).ok,true);const after=writes;await api.castLiveVotingBallot(input,voter.id);assert.equal(writes,after);
 assert.equal((await api.castLiveVotingBallot({...input,requestId:crypto.randomUUID(),choice:'HOLD',ballotRevision:0},voter.id)).ok,true);
 room=await api.getLiveVotingRoom(scope);assert.deepEqual(room.participation,{voted:1,eligible:2});assert.equal(room.history[0].candidates[0].ownBallot,null);assert.ok(!('totals'in room.history[0].candidates[0]));
 await command('CLOSE_VOTING');const closedWrites=writes;assert.equal((await api.castLiveVotingBallot({...input,requestId:crypto.randomUUID()},voter.id)).code,'VOTING_CLOSED');assert.equal(writes,closedWrites);
 demoStore.stop();demoStore.start();assert.equal((await api.getLiveVotingRoom(scope,voter.id)).history[0].candidates[0].ownBallot.choice,'HOLD');
 const p=await api.getLiveVotingPresentation({...scope,applicationId:room.currentApplicantId});assert.ok(p.sections.some(s=>s.field==='name'));assert.equal(h.calls(),0);demoStore.stop();
});
test('isolated Demo meeting finalizes explicit admission once without real calls or fabricated ballots',async()=>{
 const h=harness(),{demoStore}=h.load('lib/demo/store.ts');demoStore.start();demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});const state=demoStore.get(),clubId=state.clubs[0].id,roundId=state.clubs[0].rounds.find(r=>r.name==='Interview').id,leader=state.memberships.find(m=>m.clubId===clubId&&m.isOwner),api=h.load('lib/voting-room-api.ts');
 const setup=await api.getLiveVotingSetup({clubId,cycleId:clubId,roundId}),scope={clubId,sessionId:crypto.randomUUID()},ids=setup.applicants.slice(0,2).map(a=>a.id);await api.createLiveVotingRoom({...scope,cycleId:clubId,roundId,applicationIds:ids,participantIds:[leader.id],leaderMemberIds:[leader.id],targetSize:1});
 const cmd=async action=>api.commandLiveVotingRoom({...scope,action,requestId:crypto.randomUUID(),revision:(await api.getLiveVotingRoom(scope)).revision,confirmed:true,reason:'Explicit synthetic decision'});
 for(const action of['START','ACCEPT_WITHOUT_VOTE','ADVANCE','ACCEPT_WITHOUT_VOTE','END'])assert.equal((await cmd(action)).ok,true);
 assert.equal((await api.getLiveVotingRoom(scope)).accepted,2);assert.ok(demoStore.get().votingSessions.find(s=>s.id===scope.sessionId).passes[0].candidates.every(c=>c.ballots.length===0));
 const plan=await api.previewLiveVotingFinalization({...scope,mapping:{kind:'ADMISSION'}}),body={...scope,mapping:plan.mapping,requestId:crypto.randomUUID(),guard:plan.guard,revision:plan.revision,confirmed:true};assert.equal((await api.finalizeLiveVotingRoom(body)).ok,true);assert.equal((await api.finalizeLiveVotingRoom(body)).ok,true);assert.equal(demoStore.get().votingAudit.filter(a=>a.sessionId===scope.sessionId&&a.action==='voting.room.finalized').length,1);assert.ok(ids.every(id=>demoStore.get().applications.find(a=>a.id===id).status==='ACCEPTED'));assert.equal(h.calls(),0);demoStore.stop();
});

test('Demo atomic decision, safe Undo and stale Undo retain isolated persistence',async()=>{
 const h=harness(),{demoStore}=h.load('lib/demo/store.ts');demoStore.start();demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});const state=demoStore.get(),clubId=state.clubs[0].id,roundId=state.clubs[0].rounds.find(r=>r.name==='Interview').id,leader=state.memberships.find(m=>m.clubId===clubId&&m.isOwner),api=h.load('lib/voting-room-api.ts');
 const setup=await api.getLiveVotingSetup({clubId,cycleId:clubId,roundId}),scope={clubId,sessionId:crypto.randomUUID()},ids=setup.applicants.slice(0,2).map(a=>a.id);await api.createLiveVotingRoom({...scope,cycleId:clubId,roundId,applicationIds:ids,participantIds:[leader.id],leaderMemberIds:[leader.id]});
 const cmd=async(action,extra={})=>api.commandLiveVotingRoom({...scope,action,requestId:crypto.randomUUID(),revision:(await api.getLiveVotingRoom(scope)).revision,confirmed:true,reason:'Synthetic decision',...extra});
 await cmd('START');const r=await cmd('PASS_WITHOUT_VOTE_AND_ADVANCE',{applicationId:ids[0],passNumber:1});assert.equal(r.ok,true);assert.equal((await api.getLiveVotingRoom(scope)).currentApplicantId,ids[1]);assert.equal((await cmd('UNDO_DECISION',{applicationId:ids[0],passNumber:1,undoRequestId:r.result.decision.requestId})).ok,true);assert.equal((await api.getLiveVotingRoom(scope)).currentApplicantId,ids[0]);
 const again=await cmd('PASS_WITHOUT_VOTE_AND_ADVANCE',{applicationId:ids[0],passNumber:1});await cmd('OPEN_VOTING');assert.equal((await cmd('UNDO_DECISION',{applicationId:ids[0],passNumber:1,undoRequestId:again.result.decision.requestId})).code,'UNDO_UNSAFE');demoStore.stop();demoStore.start();assert.equal((await api.getLiveVotingRoom(scope)).currentApplicantId,ids[1]);assert.equal(h.calls(),0);demoStore.stop();
});
