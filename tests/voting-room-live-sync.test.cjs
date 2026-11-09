const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,uuid,leaderId,voterId,apps,load}=require('./helpers/voting-room-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
async function begin(h){await h.create();ok(await h.command('START'));ok(await h.command('OPEN_VOTING'));}
const session=h=>h.state().sessions[0];

test('a close confirmed from a view older only by new ballots succeeds; any other change still refuses',async()=>{
 const h=harness();await begin(h);const stale=session(h).revision;
 h.as(voterId);ok(await h.vote('ACCEPT'));h.as(leaderId);ok(await h.vote('HOLD'));
 assert.equal(session(h).revision,stale+2);
 // Without naming the ballot instance the optimistic revision check is unchanged.
 assert.equal((await h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(700),revision:stale,action:'CLOSE_VOTING',confirmed:true})).code,'STALE_STATE');
 // Naming another applicant never closes the current one.
 assert.equal((await h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(701),revision:stale,action:'CLOSE_VOTING',confirmed:true,applicationId:apps[1],passNumber:1})).code,'STALE_STATE');
 ok(await h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(702),revision:stale,action:'CLOSE_VOTING',confirmed:true,applicationId:apps[0],passNumber:1}));
 assert.equal(session(h).passes[0].candidates[0].ballotState,'CLOSED');
 assert.equal(h.state().audit.at(-1).details.missingBallots,0);
});

test('a stale close is refused when a leader command happened after that view',async()=>{
 const h=harness();await h.create();ok(await h.command('START'));const stale=session(h).revision;ok(await h.command('OPEN_VOTING'));
 h.as(voterId);ok(await h.vote('ACCEPT'));h.as(leaderId);
 assert.equal((await h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(710),revision:stale,action:'CLOSE_VOTING',confirmed:true,applicationId:apps[0],passNumber:1})).code,'STALE_STATE');
 assert.equal(session(h).passes[0].candidates[0].ballotState,'OPEN');
 // Other leader commands keep the strict revision check even when only ballots changed.
 assert.equal((await h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(711),revision:session(h).revision-1,action:'END',confirmed:true})).code,'STALE_STATE');
});

test('a view taken mid-ballot can still close once more ballots arrive',async()=>{
 const h=harness();await begin(h);h.as(voterId);ok(await h.vote('ACCEPT'));const view=session(h).revision;
 ok(await h.vote('REJECT'));h.as(leaderId);ok(await h.vote('HOLD'));
 ok(await h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(720),revision:view,action:'CLOSE_VOTING',confirmed:true,applicationId:apps[0],passNumber:1}));
});

test('one Open voting click opens the ballot even when a voter joined after Start',async()=>{
 const h=harness();await h.create();ok(await h.command('START'));const view=session(h).revision;
 const setup=load('actions/voting-room-setup.ts',h.mocks);h.as(voterId);await setup.joinLiveVotingRoom(h.scope);h.as(leaderId);
 assert.equal(session(h).revision,view+1,'joining still bumps the room revision so every view refreshes');
 assert.equal((await h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(730),revision:view,action:'OPEN_VOTING'})).code,'STALE_STATE');
 ok(await h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(731),revision:view,action:'OPEN_VOTING',applicationId:apps[0],passNumber:1}));
 assert.equal(session(h).passes[0].candidates[0].ballotState,'OPEN');
 // A replay of an already-applied open is still refused rather than reopening anything.
 assert.equal((await h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(732),revision:view,action:'OPEN_VOTING',applicationId:apps[0],passNumber:1})).code,'STALE_STATE');
 assert.match(fs.readFileSync('components/live-voting/room-meeting.tsx','utf8'),/send\("OPEN_VOTING",\{applicationId:room\.currentApplicantId!,passNumber:room\.passNumber\}\)/);
});

test('a voter losing eligibility mid-ballot shows the leader a notice at once, pauses voting, and the recount counts missing ballots against the new electorate',async()=>{
 const third=uuid(7),rules={mode:'THRESHOLD',threshold:{numerator:2,denominator:3},denominator:'BALLOTS_CAST',minimumParticipation:{numerator:2,denominator:3},belowThreshold:'HOLD',reviewed:true};
 const h=harness();await h.create({participantIds:[leaderId,voterId,third],presentationOptions:{fields:['name'],highlights:{},rules}});ok(await h.command('START'));ok(await h.command('OPEN_VOTING'));
 h.as(voterId);ok(await h.vote('ACCEPT'));h.as(leaderId);
 let view=await h.read();assert.equal(view.votingPaused,false);assert.equal(view.electorateChange,null);
 h.members[2].permissions=h.members[2].permissions.filter(p=>p!=='decisions.vote');
 view=await h.read();assert.equal(view.votingPaused,true);assert.deepEqual(view.electorateChange,{removed:1});assert.deepEqual(view.participation,{voted:1,eligible:2});
 // Voters see only that voting is paused: no count, no identity.
 h.as(voterId);const member=await h.read();assert.equal(member.votingPaused,true);assert.equal(member.electorateChange,null);
 assert.equal((await h.vote('REJECT')).code,'VOTING_PAUSED');h.as(leaderId);assert.equal((await h.vote('HOLD')).code,'VOTING_PAUSED');
 const paused=await h.command('CLOSE_VOTING');assert.equal(paused.code,'ELECTORATE_CHANGED');assert.match(paused.message,/^1 voter can no longer vote, so voting is paused\./);
 ok(await h.command('CLOSE_VOTING',{resolveElectorate:true,reason:'Member left the board'}));
 const audit=h.state().audit.findLast(a=>a.action==='voting.room.close_voting');assert.equal(audit.details.missingBallots,1,'electorate 2 with 1 ballot is 1 missing');
 // Restoring access instead resumes voting without a recount.
 const r=harness();await r.create({participantIds:[leaderId,voterId,third],presentationOptions:{fields:['name'],highlights:{},rules}});ok(await r.command('START'));ok(await r.command('OPEN_VOTING'));
 const kept=r.members[2].permissions;r.members[2].permissions=kept.filter(p=>p!=='decisions.vote');assert.equal((await r.read()).votingPaused,true);
 r.members[2].permissions=kept;assert.equal((await r.read()).votingPaused,false);r.as(voterId);ok(await r.vote('ACCEPT'));
});

test('early-close wording is singular for one missing ballot',async()=>{
 const h=harness();await begin(h);h.as(voterId);ok(await h.vote('ACCEPT'));h.as(leaderId);
 const r=await h.command('CLOSE_VOTING',{confirmed:false});assert.equal(r.code,'EARLY_CLOSE_CONFIRMATION');assert.match(r.message,/^1 ballot is missing\./);
 const meeting=fs.readFileSync('components/live-voting/room-meeting.tsx','utf8');assert.match(meeting,/missing===1\?"ballot is":"ballots are"/);assert.doesNotMatch(meeting,/\$\{missing\} ballots are missing/);
});

test('a hung poll is abandoned so the room keeps refreshing; its late result is discarded',async()=>{
 const {votingRoomSubscription}=load('lib/voting-room-subscription.ts');
 let calls=0,release;const seen=[];
 const sub=votingRoomSubscription(()=>{calls++;return calls===1?new Promise(r=>release=r):Promise.resolve({revision:calls});},(v,e)=>seen.push([v,e]),100000,30);
 await new Promise(r=>setTimeout(r,10));
 await sub.refresh();assert.equal(calls,1,'a fresh in-flight read is not duplicated');
 await new Promise(r=>setTimeout(r,60));
 await sub.refresh();await new Promise(r=>setImmediate(r));
 assert.ok(calls>=2);assert.deepEqual(seen.at(-1),[{revision:calls},null]);
 const n=seen.length;release({revision:0,stale:true});await new Promise(r=>setImmediate(r));
 assert.equal(seen.length,n,'the abandoned read never overwrites a newer snapshot');sub.close();
});

test('the leader catches up when its tab becomes visible and per-ballot extra reads are gone',()=>{
 const hook=fs.readFileSync('hooks/use-live-voting-room.ts','utf8'),meeting=fs.readFileSync('components/live-voting/room-meeting.tsx','utf8');
 assert.match(hook,/visibilitychange/);
 assert.doesNotMatch(meeting,/room\.revision,reload\]|room\.cycleId,room\.revision\]/);
 assert.match(meeting,/send\("CLOSE_VOTING",\{confirmed:true,applicationId:room\.currentApplicantId!,passNumber:room\.passNumber\}\)/);
});

test('a member asking for an applicant the room already left gets a typed stale result, not a 500',async()=>{
 const h=harness();await h.create({presentationOptions:{fields:['name'],highlights:{}}});ok(await h.command('START'));
 h.tx.interviewResumeAnnotation={findMany:async()=>[]};
 const shared=load('lib/voting-room.ts'),display=id=>({applicationId:id,roundId:h.round.id,anonymous:false,configured:['name'],visible:['name'],withheld:[],sections:[{field:'name',label:'Name',items:['Synthetic applicant']}],photo:null,links:[],observations:[]});
 let thrown=null;
 const room=load('actions/voting-room.ts',{...h.mocks,'@/lib/voting-room':shared,'@/actions/applicant-intelligence':{getApplicantDisplay:async({applicationId})=>{if(thrown)throw thrown;return display(applicationId)}}});
 h.as(voterId);
 // Current applicant: the presentation is returned as before.
 assert.equal((await room.getLiveVotingPresentation({...h.scope,applicationId:apps[0]})).stale,undefined);
 // The leader advanced: the old applicant's request returns {stale:true} with no applicant data.
 assert.deepEqual(await room.getLiveVotingPresentation({...h.scope,applicationId:apps[1]}),{stale:true});
 // The canonical display check raising the same race is converted too; other failures still throw.
 thrown=new shared.VotingPresentationChanged();assert.deepEqual(await room.getLiveVotingPresentation({...h.scope,applicationId:apps[0]}),{stale:true});
 thrown=Error('Review access required.');await assert.rejects(room.getLiveVotingPresentation({...h.scope,applicationId:apps[0]}),/Review access required/);
 // The member view refetches the room instead of showing "Applicant information unavailable".
 assert.match(fs.readFileSync('components/live-voting/room-presentation.tsx','utf8'),/isStalePresentation\(data\)/);
 assert.match(fs.readFileSync('components/live-voting/room-view.tsx','utf8'),/onStale=\{refresh\}/);
});
