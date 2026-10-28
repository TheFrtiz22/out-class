const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,uuid,clubId,cycleId,roundId,sessionId,leaderId,voterId,apps,load}=require('./helpers/voting-room-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
async function begin(h){await h.create();ok(await h.command('START'));ok(await h.command('OPEN_VOTING'));}

test('creation is scoped, retry safe, and validates current leaders/voters; ID alone is not access',async()=>{
 const h=harness();await h.create();await h.create();assert.equal(h.state().sessions.length,1);assert.equal(h.state().audit.length,1);
 await assert.rejects(h.create({targetSize:2}),/already used/);h.as(uuid(7));await assert.rejects(h.read(),/access denied/);h.as(voterId);await assert.rejects(h.create(),/Denied/);await assert.rejects(h.command('START'),/Denied/);
 for(const change of [{cycleId:uuid(99)},{roundId:uuid(99)},{clubId:uuid(99)},{participantIds:[uuid(99)]},{leaderMemberIds:[voterId]}])await assert.rejects(harness().create(change));
 const wrong=harness();wrong.state().apps[0].recruitmentCycleId=uuid(99);await assert.rejects(wrong.create(),/eligible/);
 const disabled=harness();disabled.members[1].user.disabledAt=new Date();await assert.rejects(disabled.create(),/permissions/);
});
test('room discovery exposes only authorized club/cycle/round metadata, including anonymous restrictions',async()=>{
 const h=harness();await h.create();h.state().sessions.push({...structuredClone(h.state().sessions[0]),id:uuid(900),clubId:uuid(99)});
 h.as(voterId);let rows=await h.api.listLiveVotingRooms({clubId,cycleId,roundId});assert.deepEqual(rows.map(r=>r.id),[sessionId]);assert.doesNotMatch(JSON.stringify(rows),/participants|displayConfig|ballots|leaderMemberIds/);
 assert.deepEqual(await h.api.listLiveVotingRooms({clubId,cycleId:uuid(99)}),[]);h.as(uuid(7));assert.deepEqual(await h.api.listLiveVotingRooms({clubId}),[]);
 h.as(voterId);h.members[1].permissions=h.members[1].permissions.filter(p=>p!=='applicants.identify');assert.deepEqual(await h.api.listLiveVotingRooms({clubId}),[]);h.round.anonymousReview=true;assert.equal((await h.api.listLiveVotingRooms({clubId})).length,1);
});
test('one current ballot is replaceable only while open, retries do not overwrite newer choices, totals never leak',async()=>{
 const h=harness();await begin(h);h.as(voterId);const requestId=uuid(300);ok(await h.vote('ACCEPT',{requestId}));
 const first={...h.scope,requestId,applicationId:apps[0],passNumber:1,ballotRevision:null,choice:'ACCEPT'};
 ok(await h.vote('REJECT'));ok(await h.api.castLiveVotingBallot(first));assert.equal(h.state().sessions[0].passes[0].candidates[0].ballots.length,1);
 assert.equal((await h.read()).history[0].candidates[0].ownBallot.choice,'REJECT');h.as(leaderId);let view=await h.read();
 assert.equal('totals'in view.history[0].candidates[0],false);assert.equal(view.history[0].candidates[0].ownBallot,null);assert.doesNotMatch(JSON.stringify(view),/"(?:memberId|fingerprint|ballots)":/);assert.equal(view.ballotsReceived,1,'count-only closure information contains no individual choices');
 assert.ok(h.state().audit.filter(a=>a.action.includes('ballot')).every(a=>!('decision'in a.details)));
 ok(await h.command('CLOSE_VOTING'));view=await h.read();assert.deepEqual(view.history[0].candidates[0].totals,{ACCEPT:0,HOLD:0,REJECT:1});
 h.as(voterId);assert.equal((await h.vote('HOLD')).code,'VOTING_CLOSED');ok(await h.api.castLiveVotingBallot(first));
});
test('concurrent leader requests advance only once and replay does not create an outcome twice',async()=>{
 const h=harness();await begin(h);ok(await h.command('CLOSE_VOTING'));ok(await h.command('CONFIRM',{choice:'HOLD',reason:'No complete ballot result'}));
 const revision=h.state().sessions[0].revision,base={...h.scope,revision,action:'ADVANCE'};
 const [a,b]=await Promise.all([h.api.commandLiveVotingRoom({...base,requestId:uuid(401)}),h.api.commandLiveVotingRoom({...base,requestId:uuid(402)})]);
 assert.equal([a,b].filter(r=>r.ok).length,1);assert.equal(h.state().sessions[0].activeApplicationId,apps[1]);
 ok(await h.api.commandLiveVotingRoom({...base,requestId:uuid(401)}));assert.equal(h.state().sessions[0].activeApplicationId,apps[1]);
 assert.equal(h.state().audit.filter(a=>a.action==='voting.room.confirm').length,1);
});
test('stale device votes cannot change applicant, pass, or a newer ballot',async()=>{
 const h=harness();await begin(h);ok(await h.vote('ACCEPT'));
 assert.equal((await h.vote('HOLD',{ballotRevision:null})).code,'STALE_BALLOT');
 assert.equal((await h.vote('HOLD',{applicationId:apps[1]})).code,'VOTING_CLOSED');
 h.state().apps[0].roundId=uuid(99);assert.equal((await h.vote('REJECT')).code,'APPLICANT_CHANGED');
});
test('closure/vote races serialize in both orders; duplicate ballot requests and failed transactions are safe',async()=>{
 for(const closeFirst of [true,false]){
  const h=harness();await begin(h);
  const operations=closeFirst?[()=>h.command('CLOSE_VOTING'),()=>h.vote('HOLD')]:[()=>h.vote('HOLD'),()=>h.command('CLOSE_VOTING')];
  const result=await Promise.all(operations.map(f=>f()));
  if(closeFirst){ok(result[0]);assert.equal(result[1].code,'VOTING_CLOSED');}else{ok(result[0]);assert.equal(result[1].code,'STALE_STATE');ok(await h.command('CLOSE_VOTING'));}
  assert.equal(h.state().sessions[0].passes[0].candidates[0].ballots.length,closeFirst?0:1);
 }
 const h=harness();await begin(h);const input={...h.scope,requestId:uuid(501),applicationId:apps[0],passNumber:1,ballotRevision:null,choice:'HOLD'};
 const results=await Promise.all([h.api.castLiveVotingBallot(input),h.api.castLiveVotingBallot(input)]);results.forEach(ok);assert.equal(h.state().audit.filter(a=>a.action==='voting.room.ballot.cast').length,1);
 await assert.rejects(h.api.castLiveVotingBallot({...input,choice:'ACCEPT'}),/different content/);
 const rollback=harness();await begin(rollback);rollback.tx.auditLog.create=async()=>{throw Error('Injected audit failure')};await assert.rejects(rollback.vote('ACCEPT'),/Injected/);assert.equal(rollback.state().sessions[0].passes[0].candidates[0].ballots.length,0);assert.equal(rollback.state().receipts.length,3);
});
test('confirmed Accept/Reject leave next-pass queue, Hold retains earlier instance; targets never auto-stop',async()=>{
 const h=harness();await begin(h);
 for(const [i,choice]of ['ACCEPT','HOLD','REJECT'].entries()){
  if(i)ok(await h.command('OPEN_VOTING'));
  ok(await h.vote(choice));h.as(voterId);ok(await h.vote(choice));h.as(leaderId);
  assert.equal(h.state().sessions[0].passes[0].candidates[i].confirmedDecision,null,'votes never confirm automatically');
  ok(await h.command('CLOSE_VOTING'));ok(await h.command('CONFIRM',{choice}));ok(await h.command('ADVANCE'));
 }
 const before=JSON.stringify(h.state().sessions[0].passes[0]);ok(await h.command('NEXT_PASS'));
 assert.deepEqual(h.state().sessions[0].passes[1].candidates.map(c=>c.applicationId),[apps[1]]);assert.equal(JSON.stringify(h.state().sessions[0].passes[0]),before);
 assert.equal((await h.read()).accepted,1);assert.equal(h.state().sessions[0].state,'OPEN');assert.deepEqual(h.state().apps.map(a=>a.status),['IN_REVIEW','IN_REVIEW','IN_REVIEW']);
 ok(await h.command('END'));assert.equal((await h.read()).queue[0].outcome,'HOLD','unfinished revisit preserves its confirmed Hold');
});
test('legacy entry points cannot mutate or disclose LIVE rooms or publish applicant notifications',async()=>{
 const h=harness();await begin(h);const legacy=load('actions/voting.ts',h.mocks);
 await assert.rejects(legacy.submitVotingBallot({...h.scope,passNumber:1,applicationId:apps[0],decision:'PASS'}),/Live rooms/);
 await assert.rejects(legacy.commandVotingSession({...h.scope,revision:h.state().sessions[0].revision,action:'COMPLETE_PASS'}),/Live rooms/);
 assert.equal((await legacy.getVotingWorkspace(clubId,sessionId)).session,null);
 assert.equal((await legacy.getVotingJoinInfo(sessionId)).status,'NOT_JOINABLE');
 const publication=load('utils/voting-publication.ts',h.mocks);await assert.rejects(publication.publishReviewedVotingCandidates(h.tx,h.state().sessions[0],apps,[],leaderId),/does not publish/);
});
test('End preserves unresolved applicants and the old seal command cannot bypass recruitment mapping preview',async()=>{
 const h=harness();await begin(h);ok(await h.vote('ACCEPT'));ok(await h.command('END'));let view=await h.read();assert.equal(view.status,'COMPLETED');assert.equal(view.finalizedAt,null);assert.equal(view.queue.length,3);assert.equal(view.history[0].candidates[0].ballotState,'CLOSED');
 assert.equal((await h.command('FINALIZE')).code,'PREVIEW_REQUIRED');assert.equal((await h.read()).finalizedAt,null);assert.ok(h.state().apps.every(a=>a.status==='IN_REVIEW'));
 const code=fs.readFileSync('actions/voting-room.ts','utf8');assert.doesNotMatch(code,/publishRecruitmentDecision|sendEmail|userNotification\.create|application\.update/);
});
test('revoked membership, permission changes and disabled accounts deny reads, writes, retries and presentation authority',async()=>{
 const h=harness();await begin(h);h.as(voterId);ok(await h.vote('HOLD'));h.members[1].status='LEFT';await assert.rejects(h.read(),/Denied/);await assert.rejects(h.vote('ACCEPT'),/Denied/);
 h.members[1].status='ACTIVE';h.members[1].permissions=h.members[1].permissions.filter(p=>p!=='decisions.vote');await assert.rejects(h.read(),/access denied/);
 h.as(leaderId);h.members[0].user.disabledAt=new Date();await assert.rejects(h.command('CLOSE_VOTING'),/Denied/);
 const display=fs.readFileSync('actions/applicant-intelligence.ts','utf8');assert.match(display,/roomAuthority\(s,member/);assert.match(display,/app\.recruitmentCycleId!==s\.cycleId/);assert.match(display,/s\.activeApplicationId!==app\.id/);
});
test('revocation between snapshot construction and response revalidation prevents delivery',async()=>{
 const h=harness();await begin(h);h.as(voterId);const auth=h.mocks['@/utils/auth'],original=auth.requireClubPermission;let calls=0;
 auth.requireClubPermission=async(...args)=>{if(++calls===2)h.members[1].permissions=h.members[1].permissions.filter(p=>p!=='decisions.vote');return original(...args)};
 await assert.rejects(h.read(),/permissions changed/);
});
test('confirmed corrections and overrides require reasons, remain audited, and cannot rewrite earlier passes',async()=>{
 const h=harness();await begin(h);ok(await h.command('CLOSE_VOTING'));assert.equal((await h.command('CONFIRM',{choice:'ACCEPT'})).code,'REASON_REQUIRED');ok(await h.command('CONFIRM',{choice:'HOLD',reason:'Incomplete votes'}));
 assert.equal((await h.command('CORRECT',{applicationId:apps[0],passNumber:1,choice:'REJECT'})).code,'CORRECTION_REQUIRED');ok(await h.command('CORRECT',{applicationId:apps[0],passNumber:1,choice:'HOLD',reason:'Leader correction'}));assert.equal(h.state().audit.at(-1).reason,'Leader correction');
});
test('refresh/reconnect restores projected state; failed polling clears it, late responses cannot cross subscriptions',async()=>{
 const h=harness();await begin(h);ok(await h.vote('HOLD'));const {votingRoomSubscription}=load('lib/voting-room-subscription.ts');let reads=0,resolve,seen=[];
 const sub=votingRoomSubscription(async()=>{reads++;return h.read()},(v,e)=>seen.push([v,e]),100000);await new Promise(r=>setImmediate(r));assert.equal(seen[0][0].history[0].candidates[0].ownBallot.choice,'HOLD');
 h.members[0].status='LEFT';await sub.refresh();assert.equal(seen.at(-1)[0],null);assert.match(seen.at(-1)[1],/unavailable/);sub.close();
 const late=votingRoomSubscription(()=>new Promise(r=>resolve=r),(v)=>seen.push([v]),100000);late.close();const n=seen.length;resolve({private:'late'});await new Promise(r=>setImmediate(r));assert.equal(seen.length,n);assert.equal(reads,2);
});
