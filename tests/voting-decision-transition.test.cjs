const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,uuid,apps,leaderId,voterId}=require('./helpers/voting-room-harness.cjs');
async function prepared(extra={}){const h=harness();await h.create(extra);await h.command('START');return h}
const context=h=>({applicationId:h.state().sessions[0].activeApplicationId,passNumber:h.state().sessions[0].currentPass});
async function decide(h,choice,extra={}){return h.command('DECIDE_AND_ADVANCE',{...context(h),choice,reason:'Synthetic leader decision',...extra})}
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
for(const choice of ['ACCEPT','HOLD','REJECT'])test(`${choice}: one atomic confirmation/advance and duplicate/lost-response replay`,async()=>{
 const h=await prepared();await h.command('OPEN_VOTING');await h.vote('ACCEPT');await h.command('CLOSE_VOTING');
 const body={...h.scope,...context(h),action:'DECIDE_AND_ADVANCE',choice,reason:'Recorded reason',requestId:uuid(700),revision:(await h.read()).revision};
 const results=await Promise.all([h.api.commandLiveVotingRoom(body),h.api.commandLiveVotingRoom(body)]);results.forEach(ok);
 assert.deepEqual(results[0],results[1]);assert.equal((await h.read()).currentApplicantId,apps[1]);assert.equal(h.state().audit.filter(a=>a.action==='voting.room.decide_and_advance').length,1);
 ok(await h.api.commandLiveVotingRoom(body));assert.equal((await h.read()).currentApplicantId,apps[1]);assert.equal(h.state().notifications.length,0);
});
test('member ballot never advances; reasons, close and exact applicant/pass are required',async()=>{
 const h=await prepared();assert.equal((await decide(h,'ACCEPT')).ok,false);await h.command('OPEN_VOTING');h.as(voterId);await h.vote('HOLD');assert.equal((await h.read()).currentApplicantId,apps[0]);await assert.rejects(decide(h,'ACCEPT'),/Denied/);h.as(leaderId);await h.command('CLOSE_VOTING');
 assert.equal((await decide(h,'ACCEPT',{reason:undefined})).code,'REASON_REQUIRED');assert.equal((await decide(h,'HOLD',{applicationId:apps[1]})).code,'STALE_STATE');assert.equal((await decide(h,'HOLD',{passNumber:2})).code,'STALE_STATE');ok(await decide(h,'HOLD'));
});
test('two leader tabs cannot skip and a failed transaction rolls back outcome and advance',async()=>{
 const h=await prepared();await h.command('OPEN_VOTING');await h.command('CLOSE_VOTING');const revision=(await h.read()).revision,body={...h.scope,...context(h),action:'DECIDE_AND_ADVANCE',choice:'HOLD',reason:'Discuss',revision};
 const create=h.tx.votingRoomCommand.create;h.tx.votingRoomCommand.create=async()=>{throw Error('Injected storage failure')};await assert.rejects(h.api.commandLiveVotingRoom({...body,requestId:uuid(701)}),/Injected/);assert.equal((await h.read()).currentApplicantId,apps[0]);assert.equal((await h.read()).history[0].candidates[0].ballotState,'CLOSED');h.tx.votingRoomCommand.create=create;
 const rs=await Promise.all([h.api.commandLiveVotingRoom({...body,requestId:uuid(702)}),h.api.commandLiveVotingRoom({...body,requestId:uuid(703)})]);assert.equal(rs.filter(r=>r.ok).length,1);assert.equal((await h.read()).currentApplicantId,apps[1]);
});
test('safe Undo restores closed instance and ballots once; newer activity blocks Undo with correction guidance',async()=>{
 const h=await prepared();await h.command('OPEN_VOTING');await h.vote('ACCEPT');await h.command('CLOSE_VOTING');const r=await decide(h,'ACCEPT');ok(r);const original=JSON.stringify(h.state().sessions[0].passes[0].candidates[0].ballots);
 const undo={...h.scope,action:'UNDO_DECISION',requestId:uuid(710),revision:r.result.revision,applicationId:apps[0],passNumber:1,undoRequestId:r.result.decision.requestId};ok(await h.api.commandLiveVotingRoom(undo));ok(await h.api.commandLiveVotingRoom(undo));assert.equal((await h.read()).currentApplicantId,apps[0]);assert.equal((await h.read()).history[0].candidates[0].ballotState,'CLOSED');assert.equal(JSON.stringify(h.state().sessions[0].passes[0].candidates[0].ballots),original);
 const next=await decide(h,'HOLD');await h.command('OPEN_VOTING');await h.vote('HOLD');const blocked=await h.command('UNDO_DECISION',{applicationId:apps[0],passNumber:1,undoRequestId:next.result.decision.requestId});assert.equal(blocked.code,'UNDO_UNSAFE');assert.match(blocked.message,/Correct an outcome/);assert.equal(h.state().audit.filter(a=>a.action==='voting.room.undo_decision').length,1);
});
test('last applicant enters pass summary; no-vote Undo and repeat Holds preserve target guidance and history',async()=>{
 const h=await prepared({applicationIds:[apps[0]]});
 const pass=()=>h.command('PASS_WITHOUT_VOTE_AND_ADVANCE',{...context(h),reason:'Recorded shoo-in',confirmed:true});
 const r=await pass();ok(r);assert.equal((await h.read()).status,'PAUSED');ok(await h.command('UNDO_DECISION',{applicationId:apps[0],passNumber:1,undoRequestId:r.result.decision.requestId}));assert.equal((await h.read()).history[0].candidates[0].ballotState,'PENDING');assert.equal((await h.read()).accepted,0);
 for(let i=0;i<2;i++){await h.command('OPEN_VOTING');await h.command('CLOSE_VOTING');ok(await decide(h,'HOLD'));assert.equal((await h.read()).status,'PAUSED');ok(await h.command('NEXT_PASS'))}
 ok(await pass());assert.equal((await h.read()).passNumber,3);assert.equal((await h.read()).status,'PAUSED');assert.equal(h.state().notifications.length,0);
});
