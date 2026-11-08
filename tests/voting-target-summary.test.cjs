const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,load,uuid,clubId,cycleId,roundId,sessionId,leaderId,voterId,apps}=require('./helpers/voting-room-harness.cjs');
const T=load('lib/voting-target-summary.ts');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
const counts=s=>[s.decisions.pass,s.decisions.hold,s.decisions.notPass,s.decisions.unreviewed,s.decisions.total];

test('unset, zero and invalid targets read as "No target set" and never divide by zero',()=>{
 for(const [size,unset] of [[null,false],[undefined,false],[0,false],[-3,false],[2.5,false],[Number.NaN,false],[30,true]])assert.equal(T.normalizeTarget(size,unset),null,`${size}/${unset}`);
 assert.equal(T.normalizeTarget(30,false),30);
 const none=T.targetProgress(4,null);assert.equal(none.text,'4 passed · No target set');assert.equal(none.percent,null);assert.equal(none.reached,false);
 const zero=T.sessionTargetSummary({revision:1,targetSize:0,outcomes:[{applicationId:'a',outcome:'ACCEPT'}],round:{name:'R1',final:true}});
 assert.equal(zero.target.value,null);assert.equal(zero.progress.text,'1 passed · No target set');assert.doesNotMatch(JSON.stringify(zero),/Infinity|NaN|Target 0/);
});

test('reaching and exceeding the target: real numbers in text, bar capped, nothing blocked',()=>{
 const reached=T.targetProgress(30,30);assert.equal(reached.text,'30 passed · Target 30');assert.equal(reached.detail,'Target reached');assert.equal(reached.percent,100);assert.equal(reached.reached,true);
 const over=T.targetProgress(32,30);assert.equal(over.text,'32 passed · Target 30');assert.equal(over.detail,'2 over target');assert.equal(over.over,2);assert.equal(over.percent,100,'visual caps at 100%');
 const under=T.targetProgress(12,30);assert.equal(under.detail,'18 to target');assert.equal(under.percent,40);
});

test('labels: final class-size target vs an intermediate round advancement target',()=>{
 assert.equal(T.targetLabel({name:'Final Decision',final:true}),'Final class-size target');
 assert.equal(T.targetLabel({name:'Round 1',final:false}),'Advancement target for Round 1');
 assert.equal(T.targetLabel(null),'Advancement target');
});

test('decision counts take each applicant once from canonical outcomes; bands keep hidden apart from Not scored',()=>{
 const c=T.decisionCounts([{applicationId:'a',outcome:'ACCEPT'},{applicationId:'a',outcome:'REJECT'},{applicationId:'b',outcome:'HOLD'},{applicationId:'c',outcome:null},{applicationId:'d',outcome:'REJECT'}]);
 assert.deepEqual(c,{pass:1,hold:1,notPass:1,unreviewed:1,total:4});
 const b=T.bandCounts({banded:[{band:'green'},{band:'green'},{band:'yellow'},{band:'red'}],notScored:2,hidden:3,bandsSet:true});
 assert.deepEqual(b,{bandsSet:true,green:2,yellow:1,red:1,scored:4,notScored:2,hidden:3});
 const unbanded=T.bandCounts({banded:[{band:null},{band:null}],notScored:0,hidden:1,bandsSet:false});assert.equal(unbanded.scored,2);assert.equal(unbanded.notScored,0);assert.equal(unbanded.hidden,1);
});

test('round scope: newest recorded outcome per applicant across sessions, never summed; differing targets are not merged',()=>{
 const older={id:'s1',createdAt:'2026-11-01T00:00:00Z',revision:5,targetSize:3,outcomes:[{applicationId:'a',outcome:'HOLD'},{applicationId:'b',outcome:'ACCEPT'}]};
 const newer={id:'s2',createdAt:'2026-11-02T00:00:00Z',revision:2,targetSize:4,outcomes:[{applicationId:'a',outcome:'ACCEPT'},{applicationId:'b',outcome:'UNREVIEWED'},{applicationId:'c',outcome:'UNREVIEWED'}]};
 const round=T.roundTargetSummary({sessions:[newer,older],round:{name:'Interview',final:false}});
 assert.deepEqual(counts(round),[2,0,0,1,3],'a=Pass (newer session), b keeps its recorded Pass, c Unreviewed');
 assert.equal(round.scope,'round');assert.equal(round.target.value,null);assert.match(round.target.note,/different targets/);assert.equal(round.revision,7);
 assert.equal(T.roundTargetSummary({sessions:[{...older,targetSize:4},newer],round:null}).target.value,4,'agreeing session targets are shown');
});

test('out-of-order snapshots never regress counts (room revision ordering)',()=>{
 const r5={revision:5,targetSummary:{decisions:{pass:3}}},r4={revision:4,targetSummary:{decisions:{pass:2}}},r6={revision:6,targetSummary:{decisions:{pass:3}}};
 assert.equal(T.newerByRevision(r5,r4),r5);assert.equal(T.newerByRevision(r5,r6),r6);assert.equal(T.newerByRevision(null,r4),r4);
 let shown=null;for(const next of [r4,r6,r5,r4])shown=T.newerByRevision(shown,next);assert.equal(shown,r6);
});

test('live room: session summary follows confirmed outcomes through target overage, Hold re-vote and correction, without ballot data',async()=>{
 const h=harness();await h.create({targetSize:1});
 let view=await h.read();assert.equal(view.targetSummary.scope,'session');assert.equal(view.targetSummary.target.label,'Final class-size target','only round in the pipeline');assert.deepEqual(counts(view.targetSummary),[0,0,0,3,3]);
 ok(await h.command('START'));ok(await h.command('OPEN_VOTING'));ok(await h.vote('ACCEPT'));h.as(voterId);ok(await h.vote('ACCEPT'));
 // Ballots are not decisions: an open pass with two Pass ballots changes no count, for voter or leader.
 const member=await h.read();assert.deepEqual(counts(member.targetSummary),[0,0,0,3,3]);h.as(leaderId);assert.deepEqual(counts((await h.read()).targetSummary),[0,0,0,3,3]);
 ok(await h.command('CLOSE_VOTING'));ok(await h.command('CONFIRM',{choice:'HOLD',reason:'Discuss again'}));ok(await h.command('ADVANCE'));
 assert.deepEqual(counts((await h.read()).targetSummary),[0,1,0,2,3]);
 ok(await h.command('ACCEPT_WITHOUT_VOTE',{reason:'Clear',confirmed:true}));ok(await h.command('ADVANCE'));
 view=await h.read();assert.equal(view.targetSummary.progress.detail,'Target reached');
 // Pass is still accepted after the target is reached; nobody is rejected automatically.
 ok(await h.command('ACCEPT_WITHOUT_VOTE',{reason:'Also clear',confirmed:true}));ok(await h.command('ADVANCE'));
 view=await h.read();assert.equal(view.targetSummary.progress.text,'2 passed · Target 1');assert.equal(view.targetSummary.progress.detail,'1 over target');assert.deepEqual(counts(view.targetSummary),[2,1,0,0,3]);
 // Hold re-vote: the applicant moves from Hold to Pass, counted once.
 ok(await h.command('NEXT_PASS'));view=await h.read();assert.deepEqual(counts(view.targetSummary),[2,1,0,0,3],'an unfinished revisit keeps the recorded Hold');
 ok(await h.command('ACCEPT_WITHOUT_VOTE',{reason:'Resolved',confirmed:true}));ok(await h.command('ADVANCE'));
 view=await h.read();assert.deepEqual(counts(view.targetSummary),[3,0,0,0,3]);assert.equal(view.targetSummary.progress.detail,'2 over target');
 // Authorized correction: counts follow the canonical outcome.
 ok(await h.command('END'));ok(await h.command('CORRECT',{applicationId:apps[1],passNumber:1,choice:'HOLD',reason:'Reconsider'}));
 view=await h.read();assert.deepEqual(counts(view.targetSummary),[2,1,0,0,3]);assert.equal(view.targetSummary.revision,view.revision);
 const dto=JSON.stringify(view.targetSummary);for(const secret of [leaderId,voterId,...apps,'ballot','memberId','totals'])assert.ok(!dto.includes(secret),`summary DTO leaks ${secret}`);
});

test('unset target and an intermediate round in the live room',async()=>{
 const h=harness();h.rounds.push({id:uuid(30),clubId,name:'Final',type:'FINAL_DECISION',order:1,archivedAt:null,anonymousReview:false});
 await h.create({targetSize:null});const view=await h.read();
 assert.equal(view.targetSize,null);assert.equal(view.targetSummary.target.value,null);assert.equal(view.targetSummary.target.label,'Advancement target for Interview');assert.equal(view.targetSummary.progress.text,'0 passed · No target set');
});

test('Demo Mode: session and round summaries use the same projection with zero live actions',async()=>{
 const demo=require('./helpers/demo-harness.cjs').harness(),{demoStore}=demo.load('lib/demo/store.ts');demoStore.start();demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});
 const s=demoStore.get(),club=s.clubs[0],clubId=club.id,round=club.rounds.find(r=>r.name==='Interview'),final=club.rounds.find(r=>r.name==='Final Decision'),leader=s.memberships.find(m=>m.clubId===clubId&&m.isOwner);
 const api=demo.load('lib/voting-room-api.ts'),setup=await api.getLiveVotingSetup({clubId,roundId:round.id,cycleId:clubId}),ids=setup.applicants.slice(0,2).map(a=>a.id),scope={clubId,sessionId:crypto.randomUUID()};
 await api.createLiveVotingRoom({...scope,cycleId:clubId,roundId:round.id,targetSize:null,applicationIds:ids,leaderMemberIds:[leader.id],participantIds:[leader.id]});
 const command=async(action,extra={})=>api.commandLiveVotingRoom({...scope,action,confirmed:true,revision:(await api.getLiveVotingRoom(scope)).revision,requestId:crypto.randomUUID(),...extra});
 let room=await api.getLiveVotingRoom(scope);assert.equal(room.targetSummary.target.label,'Advancement target for Interview');assert.equal(room.targetSummary.target.value,null);assert.deepEqual(counts(room.targetSummary),[0,0,0,2,2]);
 await command('START');await command('ACCEPT_WITHOUT_VOTE',{reason:'Demo'});room=await api.getLiveVotingRoom(scope);assert.deepEqual(counts(room.targetSummary),[1,0,0,1,2]);assert.equal(room.targetSummary.progress.text,'1 passed · No target set');
 const roundView=await api.getRoundTargetSummary({clubId,roundId:round.id,cycleId:clubId});assert.equal(roundView.scope,'round');assert.ok(roundView.sessions>=1);assert.equal(roundView.decisions.pass>=1,true);
 assert.doesNotMatch(JSON.stringify(roundView),new RegExp(ids.join('|')));
 if(final&&!club.rounds.some(r=>!r.archivedAt&&r.order>final.order))assert.equal((await api.getRoundTargetSummary({clubId,roundId:final.id})).target.label,'Final class-size target');
 assert.equal(demo.calls(),0,'no live server action was invoked');demoStore.stop();
});

test('entire-round scope is a separate, server-authorized read: canonical once per applicant, partial when rooms are not visible',async()=>{
 const h=harness();await h.create({targetSize:2});const api=load('actions/voting-target-summary.ts',h.mocks);
 ok(await h.command('START'));ok(await h.command('ACCEPT_WITHOUT_VOTE',{reason:'Clear',confirmed:true}));ok(await h.command('ADVANCE'));
 // A second room in the same round re-decides apps[0] and adds apps[1] for a member who is not a voter there.
 const second={clubId,sessionId:uuid(40)};await h.api.createLiveVotingRoom({...second,cycleId,roundId,leaderMemberIds:[leaderId],participantIds:[leaderId],applicationIds:[apps[0],apps[1]],targetSize:3});
 const cmd=(action,extra={})=>h.api.commandLiveVotingRoom({...second,requestId:crypto.randomUUID(),revision:h.state().sessions.find(s=>s.id===second.sessionId).revision,action,...extra});
 h.state().sessions.find(s=>s.id===second.sessionId).createdAt=new Date(Date.now()+60000);
 ok(await cmd('START'));ok(await cmd('DECIDE_WITHOUT_VOTE_AND_ADVANCE',{applicationId:apps[0],passNumber:1,choice:'REJECT',reason:'New information',confirmed:true}));
 const round=await api.getRoundTargetSummary({clubId,roundId,cycleId});
 assert.equal(round.scope,'round');assert.equal(round.sessions,2);assert.equal(round.partial,false);
 assert.deepEqual(counts(round),[0,0,1,2,3],'apps[0] counted once from the newer room; apps[1] and apps[2] Unreviewed');
 assert.equal(round.target.value,null);assert.match(round.target.note,/different targets/);
 assert.deepEqual(counts((await h.read()).targetSummary),[1,0,0,2,3],'session scope is unchanged by another room');
 assert.doesNotMatch(JSON.stringify(round),new RegExp([...apps,leaderId,voterId,'ballot'].join('|')));
 // The voter can open only the first room: the second is not counted and the result says so.
 h.as(voterId);const voterView=await api.getRoundTargetSummary({clubId,roundId});assert.equal(voterView.sessions,1);assert.equal(voterView.partial,true);assert.deepEqual(counts(voterView),[1,0,0,2,3]);
 h.members[1].permissions=h.members[1].permissions.filter(p=>p!=='applicants.identify');await assert.rejects(api.getRoundTargetSummary({clubId,roundId}),/denied/i);
 h.members[1].permissions=[];await assert.rejects(api.getRoundTargetSummary({clubId,roundId}),/Denied/);
});
