const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,load,uuid,leaderId,voterId,apps}=require('./helpers/voting-room-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
const third=uuid(7);
async function room(){
 const h=harness();await h.create({participantIds:[leaderId,voterId]});ok(await h.command('START'));
 const api=load('actions/voting-discussion.ts',h.mocks);
 const target=()=>{const s=h.state().sessions[0];return {...h.scope,passNumber:s.currentPass,applicationId:s.activeApplicationId};};
 const raise=(raised=true,extra={})=>api.setDiscussionRequest({...target(),raised,...extra});
 const respond=(memberId,action)=>api.respondToDiscussionRequest({...target(),memberId,action});
 return {h,api,target,raise,respond};
}

test('members raise and withdraw; the leader sees who and can acknowledge or clear; members see only their own request',async()=>{
 const {h,raise,respond}=await room();const revision=h.state().sessions[0].revision;
 h.as(voterId);ok(await raise());h.as(leaderId);ok(await raise());
 let lead=await h.read();assert.deepEqual(lead.discussion.requests.map(r=>r.memberId),[voterId,leaderId]);
 h.as(voterId);let mine=await h.read();assert.deepEqual(mine.discussion.requests,[],'members do not see others');assert.equal(mine.discussion.ownRequest.acknowledged,false);
 h.as(leaderId);ok(await respond(voterId,'ACKNOWLEDGE'));h.as(voterId);assert.equal((await h.read()).discussion.ownRequest.acknowledged,true);
 ok(await raise(false));assert.equal((await h.read()).discussion.ownRequest,null,'withdrawn');
 ok(await raise());assert.equal((await h.read()).discussion.ownRequest.acknowledged,false,'a new request starts unacknowledged');
 h.as(leaderId);ok(await respond(voterId,'CLEAR'));lead=await h.read();assert.deepEqual(lead.discussion.requests.map(r=>r.memberId),[leaderId]);
 // Never a ballot, outcome, observation or room revision change.
 const s=h.state().sessions[0];assert.equal(s.revision,revision);assert.equal(s.passes[0].candidates[0].ballots.length,0);assert.equal(s.passes[0].candidates[0].confirmedDecision,null);assert.equal(s.passes[0].candidates[0].ballotState,'PENDING');
 assert.equal(h.state().audit.filter(a=>/ballot|confirm|observation/.test(a.action)).length,0);
});

test('duplicate clicks create one request; reconnect restores current requests',async()=>{
 const {h,raise}=await room();h.as(voterId);
 const results=await Promise.all([raise(),raise(),raise()]);results.forEach(ok);
 assert.equal(h.state().hands.length,1);
 const first=await h.read(),again=await h.read();assert.deepEqual(again.discussion.ownRequest,first.discussion.ownRequest,'a fresh read (reconnect) restores the same request');
});

test('requests are scoped to the applicant and clear when the room advances; Undo does not revive them',async()=>{
 const {h,raise,target}=await room();h.as(voterId);ok(await raise());const old=target();h.as(leaderId);
 const r=await h.command('PASS_WITHOUT_VOTE_AND_ADVANCE',{applicationId:apps[0],passNumber:1,reason:'Clear fit',confirmed:true});ok(r);
 assert.ok(h.state().hands.every(x=>x.clearedAt),'cleared in the same transaction as advancing');
 h.as(voterId);assert.equal((await h.read()).discussion.ownRequest,null);
 const api=load('actions/voting-discussion.ts',h.mocks),stale=await api.setDiscussionRequest({...old,raised:true});assert.equal(stale.ok,false);assert.equal(stale.code,'APPLICANT_CHANGED');
 h.as(leaderId);ok(await h.command('UNDO_DECISION',{applicationId:apps[0],passNumber:1,undoRequestId:r.result.decision.requestId}));
 assert.equal(h.state().sessions[0].activeApplicationId,apps[0]);h.as(voterId);assert.equal((await h.read()).discussion.ownRequest,null,'old request is not revived');
});

test('eligibility is enforced; revoked members lose their request and cannot raise; interviewers outside the session gain nothing',async()=>{
 const {h,raise,respond}=await room();
 h.as(third);await assert.rejects(raise(),/voter|Denied/i);
 h.as(voterId);await assert.rejects(respond(leaderId,'CLEAR'),/Denied|leadership/i);
 ok(await raise());h.members[1].permissions=h.members[1].permissions.filter(p=>p!=='decisions.vote');
 await assert.rejects(raise(false),/Denied|voter/i);
 h.as(leaderId);assert.deepEqual((await h.read()).discussion.requests,[],'revoked request disappears immediately');
 const ack=await respond(voterId,'ACKNOWLEDGE');assert.deepEqual(ack,{ok:true,raised:false,acknowledged:false});assert.equal(h.state().hands.find(x=>x.memberId===voterId).acknowledgedAt,null,'no action on a revoked member request');
 // Interviewers use the slides' per-viewer interview gate: a leader with closing-review authority sees them,
 // a voter without that authority sees none, and only leaders learn who is on this session's roster.
 const roundId=h.round.id;
 h.state().interviewRecords.push({interviewerId:third,roundId,interviewer:{user:{studentProfile:{firstName:'Riley',lastName:'Interviewer'}}}},{interviewerId:leaderId,roundId,interviewer:{user:{studentProfile:{firstName:'Lee',lastName:'Leader'}}}});
 h.members[0].interviewOffices=['PRESIDENT'];
 const view=await h.read();assert.deepEqual(view.discussion.interviewers,[{label:'Riley Interviewer',roundName:h.round.name,inSession:false},{label:'Lee Leader',roundName:h.round.name,inSession:true}]);
 assert.doesNotMatch(JSON.stringify(view.discussion),/notes|draft|score/i);
 h.members[1].permissions.push('decisions.vote');h.as(voterId);const voterView=await h.read();assert.deepEqual(voterView.discussion.interviewers,[],'voter without interview-review authority sees no interviewer identities');
 h.as(leaderId);
 h.as(third);await assert.rejects(h.read(),/denied/i);
});

test('anonymous rounds show no interviewer identities',async()=>{
 const h=harness();h.round.anonymousReview=true;h.members.forEach(m=>m.permissions=m.permissions.filter(p=>p!=='applicants.identify'));
 await h.create({participantIds:[leaderId,voterId]});ok(await h.command('START'));
 let calls=0;const orig=h.tx.interviewRecord.findMany;h.tx.interviewRecord.findMany=async a=>{calls++;return orig(a)};
 const view=await h.read();assert.deepEqual(view.discussion.interviewers,[]);assert.equal(view.discussion.anonymous,true);assert.equal(calls,0);
});
