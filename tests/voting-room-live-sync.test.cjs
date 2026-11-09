const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,uuid,leaderId,voterId,apps,load}=require('./helpers/voting-room-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
async function begin(h){await h.create();ok(await h.command('START'));ok(await h.command('OPEN_VOTING'));}
const session=h=>h.state().sessions[0];

const tick=()=>new Promise(r=>setTimeout(r,5));
/** The leader's room snapshot as the client holds it: revision plus the database time it was read. */
async function view(h){h.as(leaderId);const v=await h.read();await tick();return {revision:v.revision,viewedAt:v.viewedAt};}
const close=(h,v,requestId,extra={})=>h.api.commandLiveVotingRoom({...h.scope,requestId,revision:v.revision,viewedAt:v.viewedAt,action:'CLOSE_VOTING',confirmed:true,applicationId:apps[0],passNumber:1,...extra});

test('a close confirmed from a view older only by new ballots succeeds; any other change still refuses',async()=>{
 const h=harness();await begin(h);const v=await view(h);
 h.as(voterId);ok(await h.vote('ACCEPT'));h.as(leaderId);ok(await h.vote('HOLD'));
 assert.equal(session(h).revision,v.revision+2);
 // Without naming the ballot instance, or without the view time, the optimistic revision check is unchanged.
 assert.equal((await h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(700),revision:v.revision,viewedAt:v.viewedAt,action:'CLOSE_VOTING',confirmed:true})).code,'STALE_STATE');
 assert.equal((await close(h,{revision:v.revision},uuid(703))).code,'STALE_STATE');
 // Naming another applicant never closes the current one.
 assert.equal((await close(h,v,uuid(701),{applicationId:apps[1]})).code,'STALE_STATE');
 ok(await close(h,v,uuid(702)));
 assert.equal(session(h).passes[0].candidates[0].ballotState,'CLOSED');
 assert.equal(h.state().audit.at(-1).details.missingBallots,0);
});

test('a stale close is refused when a leader command happened after that view',async()=>{
 const h=harness();await h.create();ok(await h.command('START'));const v=await view(h);ok(await h.command('OPEN_VOTING'));
 h.as(voterId);ok(await h.vote('ACCEPT'));h.as(leaderId);
 assert.equal((await close(h,v,uuid(710))).code,'STALE_STATE');
 assert.equal(session(h).passes[0].candidates[0].ballotState,'OPEN');
 // Other leader commands keep the strict revision check even when only ballots changed.
 assert.equal((await h.api.commandLiveVotingRoom({...h.scope,requestId:uuid(711),revision:session(h).revision-1,action:'END',confirmed:true})).code,'STALE_STATE');
});

test('slide-preparation receipts never hide room commands behind a stale close (review finding)',async()=>{
 const slideReceipt=(h,revision,createdAt=new Date())=>h.state().receipts.push({sessionId:h.scope.sessionId,requestId:uuid(800+h.state().receipts.length),actorId:leaderId,fingerprint:'slides',result:{revision},createdAt});
 // START, OPEN, record the view, Pass without vote, Undo, Open voting, then a slide save (same receipt shape as saveVotingSlidePreparation).
 const h=harness();await h.create();ok(await h.command('START'));const v=await view(h);
 const decided=uuid(790);ok(await h.command('PASS_WITHOUT_VOTE_AND_ADVANCE',{requestId:decided,applicationId:apps[0],passNumber:1,confirmed:true,reason:'Clear yes'}));
 ok(await h.command('UNDO_DECISION',{applicationId:apps[0],passNumber:1,undoRequestId:decided}));
 ok(await h.command('OPEN_VOTING'));slideReceipt(h,1);
 assert.equal(session(h).activeApplicationId,apps[0]);
 assert.equal((await close(h,v,uuid(791))).code,'STALE_STATE','commands after the view refuse even with a newer low-revision slide receipt');
 // Receipt order does not matter.
 h.state().receipts.reverse();assert.equal((await close(h,v,uuid(792))).code,'STALE_STATE');
 // A slide save after an otherwise ballot-only view refuses too: unidentified receipts are never treated as ballots.
 const w=await view(h);h.as(voterId);ok(await h.vote('ACCEPT'));slideReceipt(h,2);h.as(leaderId);
 assert.equal((await close(h,w,uuid(793))).code,'STALE_STATE');
 // A slide save from before the view is harmless; a ballot-only drift then closes.
 const x=await view(h);h.as(voterId);ok(await h.vote('REJECT'));h.as(leaderId);
 slideReceipt(h,3,new Date(Date.parse(x.viewedAt)-1000));
 ok(await close(h,x,uuid(794)));
});

test('a view taken mid-ballot can still close once more ballots arrive',async()=>{
 const h=harness();await begin(h);h.as(voterId);ok(await h.vote('ACCEPT'));const v=await view(h);
 h.as(voterId);ok(await h.vote('REJECT'));h.as(leaderId);ok(await h.vote('HOLD'));
 ok(await close(h,v,uuid(720)));
});

test('one Open voting click opens the ballot even when a voter joined after Start',async()=>{
 const h=harness();await h.create();ok(await h.command('START'));const v=await view(h);
 const setup=load('actions/voting-room-setup.ts',h.mocks);h.as(voterId);await setup.joinLiveVotingRoom(h.scope);h.as(leaderId);
 assert.equal(session(h).revision,v.revision+1,'joining still bumps the room revision so every view refreshes');
 const open=(requestId,extra)=>h.api.commandLiveVotingRoom({...h.scope,requestId,revision:v.revision,viewedAt:v.viewedAt,action:'OPEN_VOTING',...extra});
 assert.equal((await open(uuid(730),{})).code,'STALE_STATE');
 ok(await open(uuid(731),{applicationId:apps[0],passNumber:1}));
 assert.equal(session(h).passes[0].candidates[0].ballotState,'OPEN');
 // A replay of an already-applied open is still refused rather than reopening anything.
 assert.equal((await open(uuid(732),{applicationId:apps[0],passNumber:1})).code,'STALE_STATE');
 assert.match(fs.readFileSync('components/live-voting/room-meeting.tsx','utf8'),/send\("OPEN_VOTING",\{applicationId:room\.currentApplicantId!,passNumber:room\.passNumber,viewedAt:room\.viewedAt\}\)/);
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

test('deciding without a vote is reported as without a vote for Pass and Do not pass, with no fabricated ballots',async()=>{
 const h=harness();await h.create();ok(await h.command('START'));
 ok(await h.command('DECIDE_WITHOUT_VOTE_AND_ADVANCE',{applicationId:apps[0],passNumber:1,choice:'ACCEPT',reason:'Clear yes',confirmed:true}));
 ok(await h.command('OPEN_VOTING',{applicationId:apps[1],passNumber:1}));
 ok(await h.command('DECIDE_WITHOUT_VOTE_AND_ADVANCE',{applicationId:apps[1],passNumber:1,choice:'REJECT',reason:'Clear no',confirmed:true}));
 const view=await h.read(),rows=view.history[0].candidates;
 assert.deepEqual(rows.slice(0,2).map(c=>[c.outcome,c.withoutVote]),[['ACCEPT',true],['REJECT',true]]);
 assert.equal(session(h).passes[0].candidates.slice(0,2).reduce((n,c)=>n+c.ballots.length,0),0,'no ballots are created');
 assert.match(fs.readFileSync('components/live-voting/room-meeting.tsx','utf8'),/"Not passed":"Passed"\} without a vote/);
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
 assert.ok(seen.some(([v,e])=>v===null&&/unavailable/.test(e)),'the abandoned read is reported as unavailable, not silently stale');
});

test('focus and visibilitychange firing together cause one refresh (review finding 6)',t=>{
 t.mock.timers.enable({apis:['Date'],now:10000});
 const {coalescedRefresh}=load('lib/voting-room-subscription.ts');let n=0;const nudge=coalescedRefresh(()=>n++,1000);
 nudge();nudge();assert.equal(n,1,'focus + visibilitychange together refresh once');
 t.mock.timers.tick(999);nudge();assert.equal(n,1);t.mock.timers.tick(1);nudge();assert.equal(n,2,'a later event refreshes again');
 const hook=fs.readFileSync('hooks/use-live-voting-room.ts','utf8');assert.match(hook,/const refresh=coalescedRefresh\(/);assert.match(hook,/addEventListener\("focus",refresh\)/);assert.match(hook,/visibilityState==="visible"\)refresh\(\)/);
});

test('reads that never settle report unavailable each time and back off 5→10→20→30 s, resetting on success (fake timers)',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:0});
 const {votingRoomSubscription}=load('lib/voting-room-subscription.ts');
 const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
 let calls=0,settle=false;const seen=[];
 const sub=votingRoomSubscription(()=>{calls++;return settle?Promise.resolve({revision:calls}):new Promise(()=>{});},(v,e)=>seen.push([v,e]),5000,15000);
 const errors=()=>seen.filter(([v,e])=>v===null&&e).length,advance=async ms=>{t.mock.timers.tick(ms);await flush();};
 assert.equal(calls,1);
 await advance(14999);assert.equal(errors(),0);
 await advance(1);assert.equal(errors(),1,'abandoning a hung read delivers the unavailable state');
 await advance(9999);assert.equal(calls,1);await advance(1);assert.equal(calls,2,'first retry after 10 s');
 await advance(15000);assert.equal(errors(),2);
 await advance(19999);assert.equal(calls,2);await advance(1);assert.equal(calls,3,'then 20 s');
 await advance(15000);assert.equal(errors(),3);
 await advance(29999);assert.equal(calls,3);await advance(1);assert.equal(calls,4,'capped at 30 s');
 await advance(15000);assert.equal(errors(),4);
 await advance(30000);assert.equal(calls,5,'stays capped');
 settle=true;await advance(15000);await advance(30000);assert.equal(calls,6);assert.deepEqual(seen.at(-1),[{revision:6},null]);
 await advance(4999);assert.equal(calls,6);await advance(1);assert.equal(calls,7,'success resets to the 5 s interval');
 sub.close();
});

test('the leader catches up when its tab becomes visible and per-ballot extra reads are gone',()=>{
 const hook=fs.readFileSync('hooks/use-live-voting-room.ts','utf8'),meeting=fs.readFileSync('components/live-voting/room-meeting.tsx','utf8');
 assert.match(hook,/visibilitychange/);
 assert.doesNotMatch(meeting,/room\.revision,reload\]|room\.cycleId,room\.revision\]/);
 // Round totals still re-read when the viewer's access changes (review finding 3).
 assert.match(meeting,/\[room\.clubId,room\.roundId,room\.cycleId,room\.accessVersion,outcomeKey\]/);
 assert.match(meeting,/send\("CLOSE_VOTING",\{confirmed:true,applicationId:room\.currentApplicantId!,passNumber:room\.passNumber,viewedAt:room\.viewedAt\}\)/);
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
