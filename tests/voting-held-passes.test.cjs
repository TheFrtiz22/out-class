// Held-applicant passes and ending, server rules behind the intermission: only applicants on Hold come back, with
// fresh ballots; counts move once; the target never stops voting; ending keeps Hold and Unreviewed distinct and sends
// nothing. Synthetic members, real action code.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,uuid,apps,leaderId,voterId}=require('./helpers/voting-room-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
const counts=room=>Object.fromEntries(['ACCEPT','HOLD','REJECT','UNREVIEWED'].map(k=>[k,room.outcomes.filter(o=>o.outcome===k).length]));
async function decide(h,applicationId,choice){h.as(leaderId);const s=h.state().sessions[0];ok(await h.command('OPEN_VOTING'));h.as(voterId);ok(await h.vote(choice));h.as(leaderId);ok(await h.command('CLOSE_VOTING'));ok(await h.command('DECIDE_AND_ADVANCE',{applicationId,passNumber:s.currentPass,choice,reason:'Synthetic'}));}
const read=async(h,actor=leaderId)=>{h.as(actor);return h.read();};

test('full session: Pass, Hold, Do not pass; Hold again in pass 2; Pass in pass 3 over the target; end with no holds',async()=>{
 const h=harness();await h.create({targetSize:1});h.as(leaderId);ok(await h.command('START'));
 await decide(h,apps[0],'ACCEPT');await decide(h,apps[1],'HOLD');await decide(h,apps[2],'REJECT');
 let r=await read(h);assert.equal(r.status,'PAUSED');assert.equal(r.currentApplicantId,null,'no wrap back to the first applicant');
 assert.deepEqual(counts(r),{ACCEPT:1,HOLD:1,REJECT:1,UNREVIEWED:0});
 // Nothing starts automatically; the leader chooses.
 assert.equal(h.state().sessions[0].currentPass,1);
 ok(await h.command('NEXT_PASS'));r=await read(h);
 assert.equal(r.passNumber,2);assert.deepEqual(r.history[1].candidates.map(c=>c.applicationId),[apps[1]],'only the held applicant returns');
 // Fresh ballots: the voter's pass-1 Hold is history, not their pass-2 vote.
 const voterView=await read(h,voterId);assert.equal(voterView.history[1].candidates[0].ownBallot,null);assert.equal(voterView.history[0].candidates[1].ownBallot.choice,'HOLD');
 assert.deepEqual(r.history[0].candidates.map(c=>c.outcome),['ACCEPT','HOLD','REJECT'],'pass-1 decisions preserved');
 await decide(h,apps[1],'HOLD');r=await read(h);assert.equal(r.status,'PAUSED');assert.deepEqual(counts(r),{ACCEPT:1,HOLD:1,REJECT:0+1,UNREVIEWED:0});
 ok(await h.command('NEXT_PASS'));
 // Passing beyond the target (1) is allowed: the target is guidance only.
 await decide(h,apps[1],'ACCEPT');r=await read(h);
 assert.deepEqual(counts(r),{ACCEPT:2,HOLD:0,REJECT:1,UNREVIEWED:0},'Hold → Pass moves one count each, once');
 assert.equal(r.targetSummary.progress.over,1);
 // No holds remain: another pass is refused; End voting is the leader's explicit step.
 const empty=await h.command('NEXT_PASS');assert.equal(empty.ok,false);assert.equal(empty.code,'EMPTY_QUEUE');
 ok(await h.command('END',{confirmed:true}));r=await read(h);assert.equal(r.status,'COMPLETED');
 assert.deepEqual(counts(r),{ACCEPT:2,HOLD:0,REJECT:1,UNREVIEWED:0});
 assert.equal(h.state().notifications.length,0,'ending sends nothing');
 assert.ok(h.state().apps.every(a=>!['ACCEPTED','REJECTED','WAITLISTED'].includes(a.status)),'no recruitment change without finalization');
});

test('held passes have no limit and never reintroduce passed or not-passed applicants',async()=>{
 const h=harness();await h.create();h.as(leaderId);ok(await h.command('START'));
 await decide(h,apps[0],'ACCEPT');await decide(h,apps[1],'HOLD');await decide(h,apps[2],'HOLD');
 for(let pass=2;pass<=6;pass++){ok(await h.command('NEXT_PASS'));const r=await read(h);assert.equal(r.passNumber,pass);
  assert.deepEqual(r.history.at(-1).candidates.map(c=>c.applicationId).sort(),[apps[1],apps[2]].sort());
  await decide(h,apps[1],'HOLD');await decide(h,apps[2],'HOLD');}
 const r=await read(h);assert.deepEqual(counts(r),{ACCEPT:1,HOLD:2,REJECT:0,UNREVIEWED:0});
 assert.equal(r.history.length,6,'every pass kept in history');
});

test('ending early keeps Hold and Unreviewed distinct from Do not pass, and sends nothing',async()=>{
 const h=harness();await h.create();h.as(leaderId);ok(await h.command('START'));
 await decide(h,apps[0],'ACCEPT');await decide(h,apps[1],'HOLD');
 // Applicant 3 is current and never voted on; the leader ends now.
 ok(await h.command('END',{confirmed:true}));const r=await read(h);
 assert.equal(r.status,'COMPLETED');assert.deepEqual(counts(r),{ACCEPT:1,HOLD:1,REJECT:0,UNREVIEWED:1});
 assert.equal(h.state().notifications.length,0);
 // Members get the same counts.
 assert.deepEqual(counts(await read(h,voterId)),{ACCEPT:1,HOLD:1,REJECT:0,UNREVIEWED:1});
});
