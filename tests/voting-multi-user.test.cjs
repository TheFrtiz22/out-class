// Multi-user Voting room rules behind the applicant transition: a ballot never moves the shared applicant; only the
// group outcome, finalized by an authorized leader under the session's rules, advances everyone, exactly once.
// Synthetic members in independent sessions (harness actors), real action code, in-memory transaction.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {harness,uuid,apps,leaderId,voterId}=require('./helpers/voting-room-harness.cjs');
const thirdId=uuid(7);
async function room(){const h=harness();await h.create({participantIds:[leaderId,voterId,thirdId]});h.as(leaderId);await h.command('START');await h.command('OPEN_VOTING');return h;}
const read=async(h,actor)=>{h.as(actor);return h.read();};
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));

test('1. one member votes: the shared applicant does not move for anyone',async()=>{
 const h=await room(),before=await read(h,leaderId);
 h.as(voterId);ok(await h.vote('ACCEPT'));
 for(const actor of [leaderId,voterId,thirdId]){const r=await read(h,actor);assert.equal(r.currentApplicantId,apps[0],actor);assert.equal(r.passNumber,1);
  assert.equal(r.history[0].candidates[0].ballotState,'OPEN','voting stays open: no ballot decides');}
 assert.equal(h.state().sessions[0].activeApplicationId,apps[0]);
 // Every member voting still decides nothing: only the leader's confirmation does.
 h.as(leaderId);ok(await h.vote('ACCEPT'));h.as(thirdId);ok(await h.vote('ACCEPT'));
 const after=await read(h,leaderId);assert.equal(after.currentApplicantId,apps[0]);assert.equal(after.history[0].candidates[0].outcome,'UNREVIEWED');
 assert.ok(after.revision>before.revision,'ballots are newer room activity (revision), not an advance');
 assert.equal(h.state().audit.filter(a=>a.action==='voting.room.decide_and_advance').length,0);
});

test('2. the leader finalizes: everyone sees the next applicant, once; duplicates and racing leaders cannot advance twice',async()=>{
 const h=await room();h.as(voterId);ok(await h.vote('HOLD'));h.as(leaderId);ok(await h.command('CLOSE_VOTING'));
 const at=(await read(h,leaderId)).revision;
 const body={...h.scope,action:'DECIDE_AND_ADVANCE',applicationId:apps[0],passNumber:1,choice:'HOLD',reason:'Synthetic',revision:at};
 // The same click delivered twice (duplicate request) and a second leader tab deciding concurrently.
 // Two leader tabs deciding at once (different requests): one wins, the other is refused.
 const results=await Promise.all([h.api.commandLiveVotingRoom({...body,requestId:uuid(900)}),h.api.commandLiveVotingRoom({...body,requestId:uuid(901)})]);
 assert.equal(results.filter(r=>r.ok).length,1);
 const winner=results[0].ok?uuid(900):uuid(901);
 assert.equal(h.state().audit.filter(a=>a.action==='voting.room.decide_and_advance').length,1,'one finalization');
 for(const actor of [leaderId,voterId,thirdId]){const r=await read(h,actor);assert.equal(r.currentApplicantId,apps[1],actor);assert.equal(r.history[0].candidates[0].outcome,'HOLD');}
 // A late duplicate of the original click replays its receipt; it never decides the next applicant.
 h.as(leaderId);ok(await h.api.commandLiveVotingRoom({...body,requestId:winner}));
 assert.equal((await read(h,leaderId)).currentApplicantId,apps[1]);
 assert.equal(h.state().sessions[0].passes[0].candidates.find(c=>c.applicationId===apps[1]).ballotState,'PENDING');
});

test('3. repeated ballot clicks record one ballot; a stale ballot revision is refused',async()=>{
 const h=await room();h.as(voterId);
 const s=h.state().sessions[0],ballot={...h.scope,requestId:uuid(910),passNumber:1,applicationId:apps[0],choice:'ACCEPT',ballotRevision:null};
 const twice=await Promise.all([h.api.castLiveVotingBallot(ballot),h.api.castLiveVotingBallot(ballot)]);twice.forEach(ok);
 assert.deepEqual(twice[0],twice[1]);
 assert.equal(s.passes[0].candidates[0].ballots.filter(b=>b.memberId===voterId).length,1);
 // A second click from a view that hasn't seen the first ballot (revision null) is refused, not double-counted.
 const stale=await h.api.castLiveVotingBallot({...ballot,requestId:uuid(911),choice:'REJECT'});
 assert.equal(stale.ok,false);assert.equal(stale.code,'STALE_BALLOT');
 // Changing a vote is unchanged: allowed while open, with the current ballot revision.
 ok(await h.api.castLiveVotingBallot({...ballot,requestId:uuid(912),choice:'REJECT',ballotRevision:0}));
 assert.equal(h.state().sessions[0].passes[0].candidates[0].ballots.find(b=>b.memberId===voterId).decision,'NOT_PASS');
});

test('4. a stale client cannot vote for an applicant the room has left, nor for the next one by mistake',async()=>{
 const h=await room();h.as(leaderId);ok(await h.command('CLOSE_VOTING'));
 ok(await h.command('DECIDE_AND_ADVANCE',{applicationId:apps[0],passNumber:1,choice:'ACCEPT',reason:'Synthetic'}));
 ok(await h.command('OPEN_VOTING'));
 // The voter's screen still shows applicant 1 and sends a delayed click for it.
 h.as(voterId);
 const late=await h.api.castLiveVotingBallot({...h.scope,requestId:uuid(920),passNumber:1,applicationId:apps[0],choice:'REJECT',ballotRevision:null});
 assert.equal(late.ok,false);assert.equal(late.code,'VOTING_CLOSED');assert.match(late.message,/not recorded/);
 const pass=h.state().sessions[0].passes[0];
 assert.equal(pass.candidates.find(c=>c.applicationId===apps[1]).ballots.length,0,'nothing recorded for the applicant now on screen');
 assert.equal(pass.candidates.find(c=>c.applicationId===apps[0]).ballots.filter(b=>b.memberId===voterId).length,0);
 // A delayed leader decision for the old applicant cannot decide the new one either.
 h.as(leaderId);const stale=await h.command('DECIDE_AND_ADVANCE',{applicationId:apps[0],passNumber:1,choice:'REJECT',reason:'Late click'});
 assert.equal(stale.ok,false);assert.equal(h.state().sessions[0].activeApplicationId,apps[1]);
});

test('5. reconnecting reads the authoritative current state directly',async()=>{
 const h=await room();h.as(leaderId);
 for(const a of [apps[0],apps[1]]){if(a!==apps[0])ok(await h.command('OPEN_VOTING'));ok(await h.command('CLOSE_VOTING'));ok(await h.command('DECIDE_AND_ADVANCE',{applicationId:a,passNumber:1,choice:'HOLD',reason:'Synthetic'}));}
 // A member who was offline for both decisions reads once and lands on the current applicant and counters.
 const r=await read(h,voterId);assert.equal(r.currentApplicantId,apps[2]);
 assert.deepEqual(r.history[0].candidates.map(c=>c.outcome),['HOLD','HOLD','UNREVIEWED']);
 // The client animates only between neighbours; a jump of two applicants is shown directly (no replay).
 const load=file=>{const m={exports:{}};const src=[file,file+'.ts'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());new Function('require','module','exports',ts.transpileModule(fs.readFileSync(src,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n.startsWith('@/')?load(path.join(n.slice(2))):require(n),m,m.exports);return m.exports;};
 const lib=load('lib/voting-room.ts');
 const history=r.history;
 assert.equal(lib.adjacentApplicants(history,{passNumber:1,applicationId:apps[1]},{passNumber:1,applicationId:apps[2]}),true,'one advance animates');
 assert.equal(lib.adjacentApplicants(history,{passNumber:1,applicationId:apps[0]},{passNumber:1,applicationId:apps[2]}),false,'two missed advances: direct');
 assert.equal(lib.adjacentApplicants(history,{passNumber:1,applicationId:apps[1]},{passNumber:1,applicationId:apps[0]}),true,'Undo back one animates');
 assert.equal(lib.adjacentApplicants(history,{passNumber:1,applicationId:apps[2]},{passNumber:1,applicationId:null}),true,'last applicant to pass end');
 assert.equal(lib.adjacentApplicants(history,{passNumber:1,applicationId:apps[1]},{passNumber:1,applicationId:null}),false);
 assert.equal(lib.adjacentApplicants(history,{passNumber:1,applicationId:apps[2]},{passNumber:2,applicationId:apps[0]}),false,'a new pass: direct');
});

test('6. private ballot choices never appear in other viewers\' responses; totals only after voting closes',async()=>{
 const h=await room();h.as(voterId);ok(await h.vote('REJECT'));
 const otherIds=[leaderId,thirdId];
 for(const actor of otherIds){
  const r=await read(h,actor),json=JSON.stringify(r),c=r.history[0].candidates[0];
  assert.equal(c.ownBallot,null,`${actor} sees no ballot of theirs`);assert.ok(!('totals'in c),'no totals while voting is open');
  assert.ok(!json.includes('"ballots"'),'no ballot list in any snapshot');assert.ok(!json.includes('REJECT"')||!json.includes(voterId+'"'),'the voter\'s choice is not tied to them');
  assert.equal(r.participation.voted,1,'participation is a count only');
 }
 // The voter sees only their own choice.
 const mine=await read(h,voterId);assert.equal(mine.history[0].candidates[0].ownBallot.choice,'REJECT');
 // After the leader closes voting, totals appear (existing rule), still with no per-member choices.
 h.as(leaderId);ok(await h.command('CLOSE_VOTING'));
 const closed=await read(h,thirdId),c=closed.history[0].candidates[0];
 assert.deepEqual(c.totals,{ACCEPT:0,HOLD:0,REJECT:1});assert.equal(c.ownBallot,null);assert.ok(!JSON.stringify(closed).includes('"ballots"'));
});
