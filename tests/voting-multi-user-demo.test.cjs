// Demo Mode, same multi-user rules through its existing adapter: a ballot never advances the shared applicant;
// the leader's finalization advances once; stale and duplicate clicks change nothing; ballots stay private.
const {test}=require('node:test'),assert=require('node:assert/strict');const {harness}=require('./helpers/demo-harness.cjs');
test('Demo: ballots never advance; one leader finalization advances once; stale and duplicate clicks are refused; ballots stay private',async()=>{
 const h=harness(),{demoStore}=h.load('lib/demo/store.ts');demoStore.start();demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});
 const s=demoStore.get(),clubId=s.clubs[0].id,roundId=s.clubs[0].rounds.find(r=>r.name==='Interview').id;
 const leader=s.memberships.find(m=>m.clubId===clubId&&m.isOwner),voter=s.memberships.find(m=>m.clubId===clubId&&!m.isOwner);
 demoStore.mutate(s=>s.memberships.find(m=>m.id===voter.id).permissions.push('decisions.vote'));
 const api=h.load('lib/voting-room-api.ts'),setup=await api.getLiveVotingSetup({clubId,roundId,cycleId:clubId});
 const ids=setup.applicants.slice(0,3).map(a=>a.id);assert.equal(ids.length,3);
 const sessionId=crypto.randomUUID(),scope={clubId,sessionId};
 await api.createLiveVotingRoom({...scope,cycleId:clubId,roundId,targetSize:null,applicationIds:ids,leaderMemberIds:[leader.id],participantIds:[leader.id,voter.id],presentationOptions:{fields:['name','sat','interviewScore'],highlights:{}}});
 await api.joinLiveVotingRoom(scope,voter.id);
 const command=async(action,extra={})=>api.commandLiveVotingRoom({...scope,action,confirmed:true,revision:(await api.getLiveVotingRoom(scope)).revision,requestId:crypto.randomUUID(),...extra});
 await command('START');await command('OPEN_VOTING');

 // 1. The member votes (twice: a duplicate click): the shared applicant stays for both viewers.
 const first=await api.getLiveVotingRoom(scope,voter.id),ballot={...scope,requestId:crypto.randomUUID(),passNumber:first.passNumber,applicationId:first.currentApplicantId,choice:'REJECT',ballotRevision:null};
 const dup=await Promise.all([api.castLiveVotingBallot(ballot,voter.id),api.castLiveVotingBallot(ballot,voter.id)]);dup.forEach(r=>assert.equal(r.ok,true));
 for(const who of [undefined,voter.id]){const r=await api.getLiveVotingRoom(scope,who);assert.equal(r.currentApplicantId,ids[0]);assert.equal(r.history[0].candidates[0].ballotState,'OPEN');}
 assert.equal((await api.castLiveVotingBallot({...ballot,requestId:crypto.randomUUID(),choice:'HOLD'},voter.id)).ok,false,'a stale ballot revision is refused');

 // 6. Privacy: the leader sees a count, not the member's choice; the member sees only their own.
 const leaderView=await api.getLiveVotingRoom(scope),c=leaderView.history[0].candidates[0];
 assert.deepEqual(leaderView.participation,{voted:1,eligible:2});assert.equal(c.ownBallot,null);assert.ok(!('totals'in c));assert.ok(!JSON.stringify(leaderView).includes('"ballots"'));
 assert.equal((await api.getLiveVotingRoom(scope,voter.id)).history[0].candidates[0].ownBallot.choice,'REJECT');

 // 2. The leader finalizes: both viewers move to the next applicant, once.
 await command('CLOSE_VOTING');
 const decide={action:'DECIDE_AND_ADVANCE',applicationId:ids[0],passNumber:1,choice:'REJECT',reason:'Synthetic'};
 const requestId=crypto.randomUUID(),revision=(await api.getLiveVotingRoom(scope)).revision;
 const a=await api.commandLiveVotingRoom({...scope,...decide,revision,requestId}),again=await api.commandLiveVotingRoom({...scope,...decide,revision,requestId});
 assert.equal(a.ok,true);assert.deepEqual(again,a,'a duplicate click replays the same result');
 for(const who of [undefined,voter.id]){const r=await api.getLiveVotingRoom(scope,who);assert.equal(r.currentApplicantId,ids[1]);assert.equal(r.history[0].candidates[1].ballotState,'PENDING','the next applicant is untouched');}

 // 4. A delayed click for the applicant that has left is refused and records nothing.
 await command('OPEN_VOTING');
 const late=await api.castLiveVotingBallot({...ballot,requestId:crypto.randomUUID(),ballotRevision:0},voter.id);
 assert.equal(late.ok,false);assert.equal(late.code,'VOTING_CLOSED');
 const late2=await command('DECIDE_AND_ADVANCE',{...decide,choice:'ACCEPT'});assert.notEqual(late2.ok,true,'a late decision for the old applicant cannot decide the new one');
 assert.equal((await api.getLiveVotingRoom(scope)).currentApplicantId,ids[1]);
 // 5. Reconnect: a fresh read is the authoritative state.
 demoStore.stop();demoStore.start();const back=await api.getLiveVotingRoom(scope,voter.id);assert.equal(back.currentApplicantId,ids[1]);assert.equal(back.history[0].candidates[0].outcome,'REJECT');
 assert.equal(h.calls(),0,'no live calls in Demo');demoStore.stop();
});
