const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,uuid,leaderId,voterId,apps,sessionId}=require('./helpers/voting-room-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
const entryOf=(h,app,pass=1)=>h.state().sessions[0].passes.find(p=>p.number===pass).candidates.find(c=>c.applicationId===app);
const decide=(h,choice,extra={})=>{const s=h.state().sessions[0];return h.command('DECIDE_WITHOUT_VOTE_AND_ADVANCE',{applicationId:s.activeApplicationId,passNumber:s.currentPass,choice,reason:'Clear fit after discussion',confirmed:true,...extra});};
async function started(extra){const h=harness();await h.create(extra);ok(await h.command('START'));return h;}

test('only session leaders with explicit decision rights can decide without a vote',async()=>{
 const h=await started();
 h.as(voterId);await assert.rejects(decide(h,'ACCEPT'),/Denied/);
 h.as(uuid(7));await assert.rejects(decide(h,'ACCEPT'),/Denied/);
 h.as(leaderId);h.members[0].permissions=h.members[0].permissions.filter(p=>p!=='decisions.manage');
 await assert.rejects(decide(h,'ACCEPT'),/leadership permission/);
 assert.equal(entryOf(h,apps[0]).ballotState,'PENDING');
});

test('Do not pass without vote: reason and confirmation required, no ballots, audited override, advances',async()=>{
 const h=await started();
 for(const extra of [{reason:undefined},{confirmed:false},{choice:'HOLD'}]){const r=await decide(h,extra.choice??'REJECT',extra);assert.equal(r.code,'CONFIRMATION_REQUIRED');}
 assert.equal(entryOf(h,apps[0]).ballotState,'PENDING');
 const r=await decide(h,'REJECT');ok(r);
 const e=entryOf(h,apps[0]);assert.equal(e.ballotState,'CONFIRMED');assert.equal(e.confirmedDecision,'NOT_PASS');assert.equal(e.override,'NOT_PASS');assert.equal(e.overrideBy,leaderId);assert.equal(e.ballots.length,0,'no synthetic ballots');assert.equal(e.withoutVote,false);
 assert.deepEqual({choice:r.result.decision.choice,withoutVote:r.result.decision.withoutVote,next:r.result.decision.nextApplicationId},{choice:'REJECT',withoutVote:true,next:apps[1]});
 const audit=h.state().audit.find(a=>a.action==='voting.room.decide_without_vote_and_advance');
 assert.equal(audit.actorId,leaderId);assert.equal(audit.reason,'Clear fit after discussion');assert.equal(audit.targetId,sessionId);
 assert.deepEqual([audit.details.applicationId,audit.details.passNumber,audit.details.decision,audit.details.previousState,audit.details.ballotsCast,audit.details.withoutVote,audit.details.overridden],[apps[0],1,'REJECT','PENDING',0,true,true]);
 const view=await h.read();assert.equal(view.history[0].candidates[0].withoutVote,true);assert.equal(view.history[0].candidates[0].outcome,'REJECT');assert.equal(view.currentApplicantId,apps[1]);
});

test('open vote: closing and the override are one operation; cast ballots are kept and separate; late ballots are refused',async()=>{
 const h=await started();ok(await h.command('OPEN_VOTING'));h.as(voterId);ok(await h.vote('ACCEPT'));h.as(leaderId);
 const before=entryOf(h,apps[0]);const stale={passNumber:1,applicationId:apps[0],ballotRevision:null};
 ok(await decide(h,'REJECT'));
 const e=entryOf(h,apps[0]);assert.equal(e.ballots.length,1);assert.equal(e.ballots[0].decision,'PASS','the cast ballot is preserved');assert.ok(e.closedAt);assert.equal(e.confirmedDecision,'NOT_PASS');
 const view=await h.read(),c=view.history[0].candidates[0];assert.deepEqual(c.totals,{ACCEPT:1,HOLD:0,REJECT:0});assert.equal(c.outcome,'REJECT');assert.equal(c.withoutVote,true,'override is distinguished from the ballot totals');
 assert.equal(h.state().audit.find(a=>a.action==='voting.room.decide_without_vote_and_advance').details.ballotsCast,1);
 // A ballot from the leader's device or a slow phone after the override is refused.
 const late=await h.api.castLiveVotingBallot({...h.scope,requestId:uuid(700),choice:'ACCEPT',...stale});assert.equal(late.ok,false);assert.equal(late.code,'VOTING_CLOSED');assert.equal(entryOf(h,apps[0]).ballots.length,1);
 assert.ok(before);
});

test('duplicate clicks replay once, a second leader tab cannot advance twice, and a failed save changes nothing',async()=>{
 const h=await started(),s=h.state().sessions[0],body={...h.scope,requestId:uuid(710),revision:s.revision,action:'DECIDE_WITHOUT_VOTE_AND_ADVANCE',applicationId:apps[0],passNumber:1,choice:'ACCEPT',reason:'Shoo-in',confirmed:true};
 // Failed save: the audit write fails inside the transaction, everything rolls back.
 const create=h.tx.auditLog.create;let fail=true;h.tx.auditLog.create=async a=>{if(fail){fail=false;throw Error('Injected save failure')}return create(a)};
 await assert.rejects(h.api.commandLiveVotingRoom(body),/Injected/);h.tx.auditLog.create=create;
 assert.equal(entryOf(h,apps[0]).ballotState,'PENDING');assert.equal(h.state().sessions[0].activeApplicationId,apps[0]);
 const [a,b]=await Promise.all([h.api.commandLiveVotingRoom(body),h.api.commandLiveVotingRoom(body)]);ok(a);ok(b);assert.deepEqual(a.result,b.result,'duplicate click replays the same receipt');
 const tab2=await h.api.commandLiveVotingRoom({...body,requestId:uuid(711)});assert.equal(tab2.ok,false);assert.equal(tab2.code,'STALE_STATE');
 assert.equal(h.state().audit.filter(x=>x.action==='voting.room.decide_without_vote_and_advance').length,1);assert.equal(h.state().sessions[0].activeApplicationId,apps[1]);
});

test('corrections, Undo, last applicant and exceeding the target',async()=>{
 const h=await started({targetSize:1});
 ok(await decide(h,'ACCEPT'));
 // Undo restores the applicant and clears the override (the original decision stays in the audit history).
 const receipt=h.state().receipts.at(-1);ok(await h.command('UNDO_DECISION',{applicationId:apps[0],passNumber:1,undoRequestId:receipt.requestId}));
 const undone=entryOf(h,apps[0]);assert.equal(undone.override,null);assert.equal(undone.confirmedDecision,null);assert.equal(h.state().sessions[0].activeApplicationId,apps[0]);
 assert.equal(undone.ballotState,'CLOSED','the instance it opened returns closed, with zero ballots');ok(await h.command('DECIDE_AND_ADVANCE',{applicationId:apps[0],passNumber:1,choice:'ACCEPT',reason:'Re-decided after Undo'}));
 ok(await decide(h,'ACCEPT'));ok(await decide(h,'ACCEPT'));
 const s=h.state().sessions[0];assert.equal(s.state,'PAUSED','last applicant completes the pass');assert.equal(s.passes[0].state,'COMPLETED');
 const view=await h.read();assert.equal(view.accepted,3,'target 1 is guidance only');
 ok(await h.command('CORRECT',{applicationId:apps[2],passNumber:1,choice:'HOLD',reason:'Reconsider with the full board'}));
 const corr=h.state().audit.at(-1);assert.equal(corr.action,'voting.room.correct');assert.equal(corr.details.previousDecision,'PASS');assert.equal(entryOf(h,apps[2]).confirmedDecision,'HOLD');
 assert.deepEqual(h.state().notifications,[],'no applicant messages');assert.ok(h.state().apps.every(a=>a.status==='IN_REVIEW'),'session outcome only; no recruitment change');
});
