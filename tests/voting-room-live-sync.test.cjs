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
