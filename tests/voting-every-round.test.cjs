const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,load,uuid,clubId,cycleId,roundId,leaderId,voterId,apps}=require('./helpers/voting-room-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
const finalApi=h=>load('actions/voting-room-finalization.ts',h.mocks);
const interview={id:uuid(60),clubId,name:'First interview',type:'INTERVIEW',order:1,archivedAt:null,anonymousReview:false};
function applicationReview(){
 const h=harness();Object.assign(h.round,{type:'APPLICATION_REVIEW',name:'Application review'});h.rounds.push(structuredClone(interview));
 h.state().apps.forEach(a=>a.status='SUBMITTED');h.members[0].permissions.push('recruitment.manage');return h;
}
async function decide(h,leaderChoice,voterChoice,confirm=leaderChoice,reason){
 ok(await h.command('OPEN_VOTING'));ok(await h.vote(leaderChoice));h.as(voterId);ok(await h.vote(voterChoice));h.as(leaderId);
 ok(await h.command('CLOSE_VOTING'));ok(await h.command('CONFIRM',{choice:confirm,...(reason?{reason}:{})}));ok(await h.command('ADVANCE'));
}

test('application review before interviews: voting, repeated Hold passes, explicit advance into the interview round, retry-safe finalization',async()=>{
 const h=applicationReview(),f=finalApi(h);
 await h.create();ok(await h.command('START'));
 await decide(h,'ACCEPT','ACCEPT');await decide(h,'HOLD','HOLD');await decide(h,'REJECT','REJECT');
 // Hold passes never create recruitment rounds and keep the applicant in the session's round.
 for(const n of [2,3]){ok(await h.command('NEXT_PASS'));const s=h.state().sessions[0];assert.equal(s.currentPass,n);assert.deepEqual(s.passes.at(-1).candidates.map(c=>c.applicationId),[apps[1]]);await decide(h,'HOLD','HOLD');}
 assert.equal(h.rounds.length,2);assert.ok(h.state().apps.every(a=>a.roundId===roundId));
 ok(await h.command('END'));
 // Admission from a round that has later rounds is explicit, never implied.
 const admission=await f.previewLiveVotingFinalization({...h.scope,mapping:{kind:'ADMISSION'}});assert.equal(admission.laterRounds,1);assert.equal(admission.roundType,'APPLICATION_REVIEW');
 const mapping={kind:'ADVANCE',roundId:interview.id},plan=await f.previewLiveVotingFinalization({...h.scope,mapping});
 assert.deepEqual(plan.stale,[]);assert.equal(plan.targetRoundName,'First interview');
 assert.deepEqual(plan.changes.map(c=>[c.outcome,c.fromStatus,c.toStatus,c.toRoundId===interview.id]),[['ACCEPT','SUBMITTED','SUBMITTED',true],['HOLD','SUBMITTED','SUBMITTED',false],['REJECT','SUBMITTED','REJECTED',false]]);
 const body={...h.scope,mapping,requestId:uuid(70),revision:plan.revision,guard:plan.guard,confirmed:true};
 ok(await f.finalizeLiveVotingRoom(body));const moves=h.state().audit.filter(a=>a.action==='club.round.move').length;
 ok(await f.finalizeLiveVotingRoom(body));assert.equal(h.state().audit.filter(a=>a.action==='club.round.move').length,moves,'retry does not move twice');
 const [passed,held,rejected]=h.state().apps;
 assert.equal(passed.roundId,interview.id);assert.equal(passed.status,'SUBMITTED','advancing is not admission');
 assert.equal(held.roundId,roundId);assert.equal(held.status,'SUBMITTED','Hold is preserved');assert.equal(rejected.status,'REJECTED');
 // Prior votes and outcomes stay with the original session and round.
 const s=h.state().sessions[0];assert.equal(s.roundId,roundId);assert.equal(s.passes.length,3);assert.equal(s.passes[0].candidates[0].ballots.length,2);
 assert.deepEqual(h.state().notifications,[],'finalization sends no applicant messages');
});

test('interview round after application review keeps its own session; earlier session history is unchanged',async()=>{
 const h=applicationReview(),f=finalApi(h);
 await h.create();ok(await h.command('START'));await decide(h,'ACCEPT','ACCEPT');await decide(h,'ACCEPT','ACCEPT');await decide(h,'ACCEPT','ACCEPT');ok(await h.command('END'));
 const plan=await f.previewLiveVotingFinalization({...h.scope,mapping:{kind:'ADVANCE',roundId:interview.id}});
 ok(await f.finalizeLiveVotingRoom({...h.scope,mapping:{kind:'ADVANCE',roundId:interview.id},requestId:uuid(71),revision:plan.revision,guard:plan.guard,confirmed:true}));
 const first=structuredClone(h.state().sessions[0]);
 // A second session in the interview round uses the applicants' new current round.
 h.round.id=interview.id;Object.assign(h.round,{type:'INTERVIEW',name:'First interview',order:1});h.rounds.splice(0,2,h.round);
 const second=uuid(72);ok(await h.api.createLiveVotingRoom({clubId,sessionId:second,cycleId,roundId:interview.id,leaderMemberIds:[leaderId],participantIds:[leaderId,voterId],applicationIds:apps,targetSize:2}).then(r=>({ok:!!r.sessionId})));
 const later=h.state().sessions.find(s=>s.id===second);assert.equal(later.roundId,interview.id);
 assert.deepEqual(h.state().sessions.find(s=>s.id===first.id),first,'earlier session, ballots and outcomes unchanged');
 // Applicants not in the selected round are refused rather than silently included.
 await assert.rejects(h.api.createLiveVotingRoom({clubId,sessionId:uuid(73),cycleId,roundId,leaderMemberIds:[leaderId],participantIds:[leaderId],applicationIds:apps,targetSize:null}),/eligible applicants|round/);
});

test('applicants whose round, cycle or status changed are listed individually and nothing is finalized',async()=>{
 const h=applicationReview(),f=finalApi(h);
 await h.create();ok(await h.command('START'));await decide(h,'ACCEPT','ACCEPT');await decide(h,'REJECT','REJECT');await decide(h,'ACCEPT','ACCEPT');ok(await h.command('END'));
 const mapping={kind:'ADVANCE',roundId:interview.id},before=await f.previewLiveVotingFinalization({...h.scope,mapping});
 const [moved,withdrawn,otherCycle]=h.state().apps;moved.roundId=interview.id;withdrawn.status='WITHDRAWN';otherCycle.recruitmentCycleId=uuid(99);
 const plan=await f.previewLiveVotingFinalization({...h.scope,mapping});
 assert.deepEqual(plan.stale.map(a=>a.reason),['moved to First interview after this session began','status changed from SUBMITTED to WITHDRAWN','moved to another recruitment cycle']);assert.equal(plan.changes.length,0);
 const snapshot=structuredClone(h.state().apps);
 for(const p of [before,plan]){const r=await f.finalizeLiveVotingRoom({...h.scope,mapping,requestId:uuid(80+(p===plan?1:0)),revision:p.revision,guard:p.guard,confirmed:true});assert.equal(r.ok,false);assert.match(r.message,/changed since voting began/);}
 assert.deepEqual(h.state().apps,snapshot,'no applicant changed');assert.equal(h.state().sessions[0].finalizedAt,null);
});

test('early-round slides say there are no interview scores instead of showing zero',async()=>{
 const helper=load('utils/voting-room-presentation.ts',{'@/utils/interview-access':{authorizeInterview:async()=>{throw Error('unexpected')}}});
 // No interview round has submitted evaluations and the current round is application review.
 const tx={pipelineRound:{findMany:async args=>{assert.deepEqual(args.where.type.in,['INTERVIEW','GROUP_INTERVIEW']);return[]},findFirst:async({where})=>{assert.equal(where.clubId,clubId);return{id:roundId,name:'Application review',order:0,type:'APPLICATION_REVIEW',anonymousReview:false}}}};
 const r=await helper.votingSelectedEvidence(tx,clubId,apps[0],leaderId,['interviewScore','finalInterviewThoughts'],false,roundId);
 assert.deepEqual(r.interviewScore.current,{roundId,roundName:'Application review',status:'none',average:null,submitted:0});
 assert.equal(r.interviewScore.average,null);assert.deepEqual(r.interviewScore.byRound,[]);assert.equal('interviewFeedback'in r,false);assert.deepEqual(r.earlierInterviewRounds,[]);
 assert.doesNotMatch(JSON.stringify(r),/"average":0|"score":0/);
});
