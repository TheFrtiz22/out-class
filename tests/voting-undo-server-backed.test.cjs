const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,uuid,apps,leaderId,voterId}=require('./helpers/voting-room-harness.cjs');
async function prepared(extra={}){const h=harness();await h.create(extra);await h.command('START');return h}
const context=h=>({applicationId:h.state().sessions[0].activeApplicationId,passNumber:h.state().sessions[0].currentPass});
async function decide(h,choice,extra={}){return h.command('DECIDE_AND_ADVANCE',{...context(h),choice,reason:'Synthetic leader decision',...extra})}
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
const asLeader=async h=>{h.as(leaderId);return h.read();};

test('the room snapshot carries the latest undoable decision for leaders on every read (refresh, other devices)',async()=>{
 const h=await prepared();await h.command('OPEN_VOTING');await h.command('CLOSE_VOTING');
 assert.equal((await asLeader(h)).undo,null,'nothing to undo before a decision');
 const r=await decide(h,'ACCEPT');ok(r);
 // Every fresh read (a refresh, or another leader device) derives the same Undo from the stored receipt.
 for(let i=0;i<2;i++)assert.deepEqual((await asLeader(h)).undo,{...r.result.decision,decidedBy:null});
 // Voters and observers never receive it.
 h.as(voterId);assert.equal((await h.read()).undo,null);
 // Undo from the snapshot alone (no client copy of the receipt) succeeds, once, and is audited as before.
 const room=await asLeader(h),body={...h.scope,action:'UNDO_DECISION',requestId:uuid(810),revision:room.revision,applicationId:room.undo.applicationId,passNumber:room.undo.passNumber,undoRequestId:room.undo.requestId};
 ok(await h.api.commandLiveVotingRoom(body));ok(await h.api.commandLiveVotingRoom(body));
 assert.equal((await asLeader(h)).currentApplicantId,apps[0]);
 assert.equal(h.state().audit.filter(a=>a.action==='voting.room.undo_decision').length,1);
 assert.equal(h.state().audit.filter(a=>a.action==='voting.room.undo_authorized').length,1);
 assert.equal((await asLeader(h)).undo,null,'an undone decision is not offered again');
});

test('newer activity hides Undo: opening voting, a ballot, Continue, another decision, ending or finalizing',async()=>{
 const h=await prepared();await h.command('OPEN_VOTING');await h.command('CLOSE_VOTING');ok(await decide(h,'REJECT'));
 assert.ok((await asLeader(h)).undo);
 await h.command('OPEN_VOTING');assert.equal((await asLeader(h)).undo,null,'opening voting on the next applicant');
 h.as(voterId);await h.vote('HOLD');assert.equal((await asLeader(h)).undo,null,'a ballot on the next applicant');
 await h.command('CLOSE_VOTING');const second=await decide(h,'HOLD');ok(second);
 assert.deepEqual((await asLeader(h)).undo,{...second.result.decision,decidedBy:null},'only the newest decision is offered');
 ok(await h.command('END',{confirmed:true}));assert.equal((await asLeader(h)).undo,null,'room no longer OPEN or PAUSED');
});

test('the last decision of a pass stays undoable while PAUSED; the next pass hides it',async()=>{
 const h=await prepared({applicationIds:[apps[0]]});
 const r=await h.command('PASS_WITHOUT_VOTE_AND_ADVANCE',{...context(h),reason:'Recorded',confirmed:true});ok(r);
 const paused=await asLeader(h);assert.equal(paused.status,'PAUSED');assert.deepEqual(paused.undo,{...r.result.decision,decidedBy:null});
 const held=await prepared({applicationIds:[apps[0]]});await held.command('OPEN_VOTING');await held.command('CLOSE_VOTING');ok(await decide(held,'HOLD'));
 assert.ok((await asLeader(held)).undo);ok(await held.command('NEXT_PASS'));assert.equal((await asLeader(held)).undo,null,'a new pass');
});

test('a stale Undo is refused with clear wording once newer activity exists',async()=>{
 const h=await prepared();await h.command('OPEN_VOTING');await h.command('CLOSE_VOTING');
 const r=await decide(h,'ACCEPT');ok(r);const seen=await asLeader(h);
 // Another leader device opens voting on the next applicant; this device still holds the older snapshot.
 ok(await h.command('OPEN_VOTING'));
 const stale=await h.api.commandLiveVotingRoom({...h.scope,action:'UNDO_DECISION',requestId:uuid(820),revision:seen.revision,applicationId:seen.undo.applicationId,passNumber:seen.undo.passNumber,undoRequestId:seen.undo.requestId});
 assert.equal(stale.ok,false);assert.ok(['STALE_STATE','UNDO_UNSAFE'].includes(stale.code),stale.code);
 // With a current revision the server still refuses, naming the safe alternative.
 const current=await h.command('UNDO_DECISION',{applicationId:seen.undo.applicationId,passNumber:seen.undo.passNumber,undoRequestId:seen.undo.requestId});
 assert.equal(current.code,'UNDO_UNSAFE');assert.match(current.message,/Newer room activity prevents Undo\. Use Correct an outcome/);
 assert.equal((await asLeader(h)).currentApplicantId,apps[1]);
 assert.equal(h.state().audit.filter(a=>a.action==='voting.room.undo_decision').length,0);
 // A receipt that is not the latest is refused even if it was once undoable.
 const h2=await prepared();await h2.command('OPEN_VOTING');await h2.command('CLOSE_VOTING');const first=await decide(h2,'ACCEPT');ok(first);
 await h2.command('OPEN_VOTING');await h2.command('CLOSE_VOTING');ok(await decide(h2,'REJECT'));
 assert.equal((await h2.command('UNDO_DECISION',{applicationId:apps[0],passNumber:1,undoRequestId:first.result.decision.requestId})).code,'UNDO_UNSAFE');
});

test('only leaders with decisions.manage can Undo; the snapshot never offers it to non-leaders',async()=>{
 const h=await prepared();const r=await h.command('PASS_WITHOUT_VOTE_AND_ADVANCE',{...context(h),reason:'Recorded',confirmed:true});ok(r);
 h.members[0].permissions=h.members[0].permissions.filter(p=>p!=='decisions.manage');
 await assert.rejects(h.command('UNDO_DECISION',{applicationId:apps[0],passNumber:1,undoRequestId:r.result.decision.requestId}),/permission/);
 // A leader without decisions.manage is not offered Undo (nor its receipt) in the snapshot.
 assert.equal((await asLeader(h)).undo,null);
 h.members[0].permissions.push('decisions.manage');
 h.as(voterId);assert.equal((await h.read()).undo,null);
 assert.deepEqual((await asLeader(h)).undo,{...r.result.decision,decidedBy:null});
});

test('other receipts that share the revision number (slide preparation, setup) never hide the decision',async()=>{
 const h=await prepared();const r=await h.command('PASS_WITHOUT_VOTE_AND_ADVANCE',{...context(h),reason:'Recorded',confirmed:true});ok(r);
 // A slide-preparation receipt numbers its own revisions; one landing later with the same number must be skipped.
 h.state().receipts.push({sessionId:h.state().sessions[0].id,requestId:uuid(830),actorId:'synthetic',fingerprint:'x',result:{revision:r.result.revision},createdAt:new Date(Date.now()+1000)});
 assert.deepEqual((await asLeader(h)).undo,{...r.result.decision,decidedBy:null});
});

test('Undo names the other leader who made the decision; your own decision is not attributed',async()=>{
 const h=await prepared();await h.command('OPEN_VOTING');await h.command('CLOSE_VOTING');
 const r=await decide(h,'ACCEPT');ok(r);
 const own=await asLeader(h);assert.equal(own.undo.decidedBy,null,'your own decision');
 assert.equal(own.undo.requestId,r.result.decision.requestId);
 // The same receipt, recorded as another leader's (a second leader on another device).
 const receipt=h.state().receipts.find(x=>x.requestId===r.result.decision.requestId);receipt.actorId=voterId;
 h.members[1].user.studentProfile={firstName:'Alex',lastName:'Kim'};
 assert.equal((await asLeader(h)).undo.decidedBy,'Alex Kim');
 // Without a profile name, still clearly someone else.
 delete h.members[1].user.studentProfile;assert.equal((await asLeader(h)).undo.decidedBy,'Another leader');
 // Attribution never reaches non-leaders: they get no Undo at all.
 h.as(voterId);assert.equal((await h.read()).undo,null);
 // Undo still works on another leader's decision, and is audited under the leader who undid it.
 const room=await asLeader(h);ok(await h.api.commandLiveVotingRoom({...h.scope,action:'UNDO_DECISION',requestId:uuid(840),revision:room.revision,applicationId:room.undo.applicationId,passNumber:room.undo.passNumber,undoRequestId:room.undo.requestId}));
 assert.equal(h.state().audit.filter(a=>a.action==='voting.room.undo_decision').at(-1).actorId,leaderId);
});
