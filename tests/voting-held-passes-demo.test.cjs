// Demo Mode: held passes and ending follow the same rules through the Demo adapter, with no live calls.
const {test}=require('node:test'),assert=require('node:assert/strict');const {harness}=require('./helpers/demo-harness.cjs');
test('Demo: only held applicants return with fresh ballots; Hold → Pass moves once; ending keeps Hold and Unreviewed distinct',async()=>{
 const h=harness(),{demoStore}=h.load('lib/demo/store.ts');demoStore.start();demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});
 const s=demoStore.get(),clubId=s.clubs[0].id,roundId=s.clubs[0].rounds.find(r=>r.name==='Interview').id;
 const leader=s.memberships.find(m=>m.clubId===clubId&&m.isOwner),voter=s.memberships.find(m=>m.clubId===clubId&&!m.isOwner);
 demoStore.mutate(s=>s.memberships.find(m=>m.id===voter.id).permissions.push('decisions.vote'));
 const api=h.load('lib/voting-room-api.ts'),setup=await api.getLiveVotingSetup({clubId,roundId,cycleId:clubId}),ids=setup.applicants.slice(0,3).map(a=>a.id);
 const run=async()=>{const sessionId=crypto.randomUUID(),scope={clubId,sessionId};
  await api.createLiveVotingRoom({...scope,cycleId:clubId,roundId,targetSize:1,applicationIds:ids,leaderMemberIds:[leader.id],participantIds:[leader.id,voter.id],presentationOptions:{fields:['name'],highlights:{}}});
  await api.joinLiveVotingRoom(scope,voter.id);
  const command=async(action,extra={})=>api.commandLiveVotingRoom({...scope,action,confirmed:true,revision:(await api.getLiveVotingRoom(scope)).revision,requestId:crypto.randomUUID(),...extra});
  const decide=async(choice)=>{const r=await api.getLiveVotingRoom(scope);await command('OPEN_VOTING');const v=await api.getLiveVotingRoom(scope,voter.id);
   assert.equal((await api.castLiveVotingBallot({...scope,requestId:crypto.randomUUID(),passNumber:v.passNumber,applicationId:v.currentApplicantId,choice,ballotRevision:v.history.at(-1).candidates.find(c=>c.applicationId===v.currentApplicantId).ownBallot?.revision??null},voter.id)).ok,true);
   await command('CLOSE_VOTING');assert.equal((await command('DECIDE_AND_ADVANCE',{applicationId:r.currentApplicantId,passNumber:r.passNumber,choice,reason:'Synthetic'})).ok,true);};
  const counts=async()=>{const r=await api.getLiveVotingRoom(scope);return Object.fromEntries(['ACCEPT','HOLD','REJECT','UNREVIEWED'].map(k=>[k,r.outcomes.filter(o=>o.outcome===k).length]));};
  await command('START');return {scope,command,decide,counts};};

 const a=await run();await a.decide('ACCEPT');await a.decide('HOLD');await a.decide('REJECT');
 let r=await api.getLiveVotingRoom(a.scope);assert.equal(r.status,'PAUSED');assert.equal(r.currentApplicantId,null);assert.deepEqual(await a.counts(),{ACCEPT:1,HOLD:1,REJECT:1,UNREVIEWED:0});
 assert.equal((await a.command('NEXT_PASS')).ok,true);r=await api.getLiveVotingRoom(a.scope,voter.id);
 assert.deepEqual(r.history[1].candidates.map(c=>c.applicationId),[ids[1]]);assert.equal(r.history[1].candidates[0].ownBallot,null,'fresh ballot');
 await a.decide('ACCEPT');assert.deepEqual(await a.counts(),{ACCEPT:2,HOLD:0,REJECT:1,UNREVIEWED:0},'over the target, still allowed');
 assert.equal((await a.command('END')).ok,true);assert.equal((await api.getLiveVotingRoom(a.scope)).status,'COMPLETED');

 const b=await run();await b.decide('ACCEPT');await b.decide('HOLD');assert.equal((await b.command('END')).ok,true);
 assert.deepEqual(await b.counts(),{ACCEPT:1,HOLD:1,REJECT:0,UNREVIEWED:1},'ending early keeps Hold and Unreviewed');
 assert.equal(h.calls(),0);demoStore.stop();
});
