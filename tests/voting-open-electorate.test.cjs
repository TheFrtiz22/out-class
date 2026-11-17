// Open electorate: no saved voter list. Any current member who holds the club's voting permissions joins with the
// join QR or link and votes from the applicant on screen onward; "all eligible voters" is who joined, snapshotted as
// each ballot closes. Sessions saved with a voter list (legacy) keep it. In-memory transactions, real action code.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness,load,uuid,clubId,sessionId,leaderId,voterId,apps}=require('./helpers/voting-room-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r)),third=uuid(7),scope={clubId,sessionId};
const allEligible={mode:'THRESHOLD',threshold:{numerator:2,denominator:3},denominator:'ELIGIBLE_VOTERS',minimumParticipation:{numerator:1,denominator:3},belowThreshold:'HOLD',reviewed:true};
const options=rules=>({presentationOptions:{fields:['name'],highlights:{},...(rules?{rules}:{})}});
function room(extra={}){const h=harness(),setup=load('actions/voting-room-setup.ts',h.mocks);return {h,setup,join:who=>{h.as(who);return setup.joinLiveVotingRoom(scope);},info:who=>{h.as(who);return setup.getLiveVotingJoinInfo(scope);},...extra};}

test('setup offers no voter list: it counts the members who can join, and a sent voter list is ignored',async()=>{
 const {h,setup}=room();h.as(leaderId);
 const data=await setup.getLiveVotingSetup({clubId,cycleId:h.cycle.id,roundId:h.round.id});
 assert.equal(data.joinableVoterCount,3);assert.equal('voters'in data,false);assert.doesNotMatch(JSON.stringify(data),new RegExp(`${voterId}|${third}`));
 h.members[2].alumniSince=new Date();h.members[1].user.disabledAt=new Date();
 assert.equal((await setup.getLiveVotingSetup({clubId,cycleId:h.cycle.id,roundId:h.round.id})).joinableVoterCount,1,'alumni and disabled accounts cannot join');
 h.members[2].alumniSince=null;h.members[1].user.disabledAt=null;
 await h.create({joined:[],participantIds:[voterId]});const s=h.state().sessions[0];
 assert.deepEqual(s.participants,[]);assert.equal(s.presentationOptions.electorate,'OPEN');
 const audit=h.state().audit.find(a=>a.action==='voting.room.created');assert.equal(audit.details.electorate,'OPEN');assert.equal('voterCount'in audit.details,false);
});

test('join eligibility: current voting members join; alumni, members without voting rights, disabled accounts and other clubs are refused',async()=>{
 const r=room();await r.h.create({joined:[]});
 assert.equal((await r.info(third)).status,'READY');assert.deepEqual(await r.join(third),{joined:true});assert.deepEqual(await r.join(third),{joined:true});
 assert.equal(r.h.state().audit.filter(a=>a.action==='voting.room.joined').length,1,'joining twice is one join');
 assert.ok(r.h.state().sessions[0].participants.find(p=>p.memberId===third).joinedAt);
 // Alumni (graduated profile) are refused even while their membership still carries permissions.
 r.h.tx.studentProfile.findUnique=async({where})=>({graduatedAt:where.userId===voterId?new Date(Date.now()-86400000):null});
 assert.equal((await r.info(voterId)).status,'DENIED');await assert.rejects(r.join(voterId),/unavailable/);
 r.h.tx.studentProfile.findUnique=async()=>({graduatedAt:null});
 // Alumni memberships hold no capabilities; nor does a member without the voting permission.
 r.h.members[1].alumniSince=new Date();assert.equal((await r.info(voterId)).status,'DENIED');await assert.rejects(r.join(voterId));r.h.members[1].alumniSince=null;
 const kept=r.h.members[1].permissions;r.h.members[1].permissions=kept.filter(p=>p!=='decisions.vote');await assert.rejects(r.join(voterId));r.h.members[1].permissions=kept;
 r.h.members[1].user.disabledAt=new Date();await assert.rejects(r.join(voterId),/Denied/);r.h.members[1].user.disabledAt=null;
 // Someone from another club (and so another school's or club's roster) is refused without learning anything.
 await assert.rejects(r.join(uuid(99)),/Denied/);r.h.as(uuid(99));assert.deepEqual(await r.setup.getLiveVotingJoinInfo(scope),{status:'DENIED'});
 // Identified rounds also need permission to identify applicants.
 const ident=r.h.members[1].permissions;r.h.members[1].permissions=ident.filter(p=>p!=='applicants.identify');await assert.rejects(r.join(voterId));r.h.members[1].permissions=ident;
 assert.deepEqual(r.h.state().sessions[0].participants.map(p=>p.memberId),[third]);
});

test('late joiners vote on the applicant on screen and every later one; decisions already made stay',async()=>{
 const r=room();await r.h.create({joined:[leaderId,voterId],...options()});r.h.as(leaderId);
 ok(await r.h.command('START'));ok(await r.h.command('OPEN_VOTING'));r.h.as(voterId);ok(await r.h.vote('ACCEPT'));
 r.h.as(third);assert.equal((await r.h.vote('ACCEPT')).code,'JOIN_REQUIRED','no ballot before joining');
 await r.join(third);assert.equal(r.h.state().audit.findLast(a=>a.action==='voting.room.joined').details.late,true);
 r.h.as(third);ok(await r.h.vote('REJECT'));r.h.as(leaderId);
 let view=await r.h.read();assert.deepEqual(view.participation,{voted:2,eligible:3});
 ok(await r.h.command('CLOSE_VOTING'));ok(await r.h.command('DECIDE_AND_ADVANCE',{applicationId:apps[0],passNumber:1,choice:'ACCEPT',reason:'Tie'}));
 const first=r.h.state().sessions[0].passes[0].candidates[0];assert.equal(first.confirmedDecision,'PASS');
 ok(await r.h.command('OPEN_VOTING'));r.h.as(third);ok(await r.h.vote('HOLD'));
 assert.equal(r.h.state().sessions[0].passes[0].candidates[0].confirmedDecision,'PASS','earlier decision unchanged');
});

test('no one votes on their own application, and the applicant never counts as one of their own voters',async()=>{
 const r=room();r.h.state().apps[0].studentId=voterId;await r.h.create(options(allEligible));r.h.as(leaderId);
 ok(await r.h.command('START'));ok(await r.h.command('OPEN_VOTING'));
 assert.deepEqual(r.h.state().ballotRules[0].electorate,[leaderId],'the applicant is left out of their own electorate');
 r.h.as(voterId);const own=await r.h.vote('ACCEPT');assert.equal(own.code,'OWN_APPLICATION');assert.equal(r.h.state().sessions[0].passes[0].candidates[0].ballots.length,0);
 r.h.as(leaderId);assert.deepEqual((await r.h.read()).participation,{voted:0,eligible:1});ok(await r.h.vote('ACCEPT'));
 ok(await r.h.command('CLOSE_VOTING'));assert.deepEqual(r.h.state().ballotRules.at(-1).electorate,[leaderId]);
 const view=await r.h.read();assert.equal(view.ruleResult.eligible,1);assert.equal(view.ruleResult.outcome,'ACCEPT');
});

test('"all eligible voters" is who joined, snapshotted as the ballot closes; later joins never change a closed result',async()=>{
 const r=room();await r.h.create({joined:[leaderId,voterId],...options(allEligible)});r.h.as(leaderId);
 ok(await r.h.command('START'));ok(await r.h.command('OPEN_VOTING'));
 assert.deepEqual(r.h.state().ballotRules[0].electorate,[leaderId,voterId].sort(),'opening captures the room so far');
 await r.join(third);r.h.as(leaderId);ok(await r.h.vote('ACCEPT'));r.h.as(third);ok(await r.h.vote('ACCEPT'));r.h.as(leaderId);
 ok(await r.h.command('CLOSE_VOTING'));
 const close=r.h.state().ballotRules.at(-1);assert.equal(close.version,2);assert.deepEqual(close.electorate,[leaderId,voterId,third].sort());assert.equal(close.reason,'Members in the room when voting closed');
 let view=await r.h.read();assert.equal(view.ruleResult.eligible,3);assert.equal(view.ruleResult.passVotes,2);assert.equal(view.ruleResult.outcome,'ACCEPT','2 of 3 who joined');
 const audit=r.h.state().audit.findLast(a=>a.action==='voting.room.close_voting');assert.equal(audit.details.rule.eligible,3);assert.equal(audit.details.missingBallots,1);
 // A fourth member arrives after the close: the closed result and its snapshot do not move.
 const fourth=uuid(8);r.h.members.push({...structuredClone(r.h.members[1]),id:fourth,userId:fourth});
 const rules=r.h.state().ballotRules.length;await r.join(fourth);r.h.as(leaderId);view=await r.h.read();
 assert.equal(r.h.state().ballotRules.length,rules);assert.equal(view.ruleResult.eligible,3);assert.equal(view.ruleResult.outcome,'ACCEPT');
 r.h.as(fourth);assert.equal((await r.h.vote('REJECT')).code,'VOTING_CLOSED');
 // Losing voting rights after the close changes nothing either.
 r.h.members[2].permissions=r.h.members[2].permissions.filter(p=>p!=='decisions.vote');r.h.as(leaderId);assert.equal((await r.h.read()).ruleResult.eligible,3);
});

test('a join racing the close lands wholly before the snapshot or after it; ending or deciding mid-ballot also snapshots',async()=>{
 for(let i=0;i<4;i++){
  const r=room();await r.h.create({joined:[leaderId,voterId],...options(allEligible)});r.h.as(leaderId);ok(await r.h.command('START'));ok(await r.h.command('OPEN_VOTING'));
  const close=r.h.command('CLOSE_VOTING'),join=(async()=>{if(i%2)await null;return r.join(third);})();r.h.as(leaderId);
  const [closed]=await Promise.all([close,join]);ok(closed);
  const snapshot=r.h.state().ballotRules.at(-1).electorate,joinedFirst=r.h.state().audit.findIndex(a=>a.action==='voting.room.joined')<r.h.state().audit.findIndex(a=>a.action==='voting.room.close_voting');
  assert.equal(snapshot.includes(third),joinedFirst,'the snapshot matches the order the two transactions committed in');
 }
 const e=room();await e.h.create({joined:[leaderId,voterId],...options(allEligible)});e.h.as(leaderId);ok(await e.h.command('START'));ok(await e.h.command('OPEN_VOTING'));await e.join(third);e.h.as(leaderId);
 ok(await e.h.command('END'));assert.deepEqual(e.h.state().ballotRules.at(-1).electorate,[leaderId,voterId,third].sort());
 const d=room();await d.h.create({joined:[leaderId,voterId],...options(allEligible)});d.h.as(leaderId);ok(await d.h.command('START'));ok(await d.h.command('OPEN_VOTING'));
 ok(await d.h.command('DECIDE_WITHOUT_VOTE_AND_ADVANCE',{applicationId:apps[0],passNumber:1,choice:'ACCEPT',confirmed:true,reason:'Leader decision'}));assert.equal(d.h.state().ballotRules.at(-1).version,2);
});

test('sessions saved with a voter list keep it: only listed members join or vote, without a closing snapshot',async()=>{
 const r=room();await r.h.create({legacyVoters:[leaderId,voterId],...options(allEligible)});
 assert.equal((await r.info(third)).status,'DENIED');await assert.rejects(r.join(third),/unavailable|denied/);
 r.h.as(leaderId);ok(await r.h.command('START'));ok(await r.h.command('OPEN_VOTING'));r.h.as(voterId);ok(await r.h.vote('ACCEPT'));
 r.h.as(third);await assert.rejects(r.h.vote('ACCEPT'),/Only voters|denied/);r.h.as(leaderId);ok(await r.h.vote('ACCEPT'));
 ok(await r.h.command('CLOSE_VOTING'));assert.deepEqual(r.h.state().ballotRules.map(x=>x.version),[1]);assert.equal((await r.h.read()).ruleResult.eligible,2);
});

test('the setup page shows the open-electorate text instead of a voter picker',()=>{
 const src=fs.readFileSync('components/live-voting/room-setup.tsx','utf8');
 assert.doesNotMatch(src,/Search voters|Select all voters|Clear voters|E-board|setVoters|voterSearch|participantIds/);
 assert.match(src,/Any current member who scans the join QR can vote, including people who arrive late\. <strong>\{pluralize\(data\.joinableVoterCount,"member"\)\}<\/strong> can join\./);
 assert.match(src,/Alumni and applicants can’t vote\. Late arrivals vote from the applicant on screen onward\./);
 assert.match(src,/\{pluralize\(applicants\.length,"applicant"\)\} · any member who joins votes · \{target\?`target \$\{target\}`:'no target'\}/);
 assert.match(fs.readFileSync('components/live-voting/room-view.tsx','utf8'),/\{room\.participation\.voted\} of \{room\.participation\.eligible\} in the room voted/);
});
