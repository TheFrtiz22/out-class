const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,load,clubId,roundId,cycleId,sessionId,leaderId,voterId,apps,uuid}=require('./helpers/voting-room-harness.cjs');
const scope={clubId,sessionId},selection={clubId,cycleId,roundId};
test('QR destination is a safe internal Auth return route without applicant identity or credentials',()=>{
 const {liveRoomPath}=load('lib/voting-room.ts'),{safeReturnPath}=load('lib/auth.ts');const path=liveRoomPath(clubId,sessionId);
 assert.equal(safeReturnPath(path),path);assert.equal(path,`/voting/rooms/${sessionId}?clubId=${clubId}&view=member`);assert.ok(!path.includes(apps[0]));
});
test('setup discovers exact cycle/round applicants, never identities in anonymous round, denies nonleaders',async()=>{
 const h=harness();for(const [i,a]of h.state().apps.entries())a.student={studentProfile:{firstName:'Synthetic',lastName:String(i)}};
 const api=load('actions/voting-room-setup.ts',h.mocks);
 assert.equal((await api.getLiveVotingSetup(selection)).applicants.length,3);
 assert.equal((await api.getLiveVotingSetup({...selection,cycleId:uuid(99)})).applicants.length,0);
 h.round.anonymousReview=true;const anonymous=await api.getLiveVotingSetup(selection);
 assert.doesNotMatch(JSON.stringify(anonymous.applicants),/Synthetic/);assert.ok(!anonymous.allowedFields.includes('photo'));assert.ok(!anonymous.allowedFields.includes('interviewScore'));
 h.as(voterId);await assert.rejects(api.getLiveVotingSetup(selection),/Denied/);
});
test('target is optional; exact presentation fields derive canonical config; anonymous identifiers cannot be requested',async()=>{
 const h=harness();await h.create({targetSize:null,presentationOptions:{fields:['name','gpa'],highlights:{}}});
 assert.equal((await h.read()).targetSize,null);assert.equal(h.state().sessions[0].targetSize,1);
 assert.deepEqual(h.state().sessions[0].displayConfig.fields,['name','gpa']);await assert.rejects(harness().create({targetSize:0}));
 const a=harness();a.round.anonymousReview=true;await assert.rejects(a.create({presentationOptions:{fields:['name'],highlights:{}}}),/anonymous/);
 await assert.rejects(harness().create({presentationOptions:{fields:['resumeHighlight'],highlights:{[uuid(99)]:uuid(90)}}}),/scope/);
});
test('QR eligibility is generic, check-in after start is idempotent, current revocation removes access',async()=>{
 const h=harness(),api=load('actions/voting-room-setup.ts',h.mocks);await h.create();h.as(voterId);
 assert.equal((await api.getLiveVotingJoinInfo(scope)).status,'READY');h.as(leaderId);await h.command('START');h.as(voterId);
 await api.joinLiveVotingRoom(scope);await api.joinLiveVotingRoom(scope);
 assert.equal(h.state().audit.filter(a=>a.action==='voting.room.joined').length,1);
 assert.equal((await api.getLiveVotingJoinInfo(scope)).status,'JOINED');assert.deepEqual((await h.read()).joinedParticipants,[]);
 h.as(leaderId);assert.equal((await h.read()).joinedParticipants.filter(p=>p.joined).length,1);
 h.as(voterId);h.members[1].permissions=[];assert.equal((await api.getLiveVotingJoinInfo(scope)).status,'DENIED');await assert.rejects(api.joinLiveVotingRoom(scope));
 h.as(leaderId);assert.equal((await api.getLiveVotingJoinInfo({...scope,sessionId:uuid(99)})).status,'EXPIRED');await h.command('END');assert.equal((await api.getLiveVotingJoinInfo(scope)).status,'ENDED');
});
test('join transport failures are errors rather than denied or empty states',async()=>{
 const h=harness(),api=load('actions/voting-room-setup.ts',h.mocks);h.tx.user.findUnique=async()=>{throw Error('Database unavailable')};
 await assert.rejects(api.getLiveVotingJoinInfo(scope),/Database unavailable/);
});
test('open participation is count only, excludes revoked members, never broadcasts their choices',async()=>{
 const h=harness();await h.create();await h.command('START');await h.command('OPEN_VOTING');await h.vote('ACCEPT');
 h.as(voterId);let s=await h.read();assert.deepEqual(s.participation,{voted:1,eligible:2});assert.ok(!('totals'in s.history[0].candidates[0]));assert.deepEqual(s.joinedParticipants,[]);
 assert.equal(s.history[0].candidates[0].ownBallot,null);h.members[0].permissions=[];s=await h.read();assert.deepEqual(s.participation,{voted:0,eligible:1});
});
test('selected saved excerpt is exact document/quote only, denied rounds withheld, database failures propagate',async()=>{
 let fail=false;const helper=load('utils/voting-room-presentation.ts',{'@/utils/interview-access':{authorizeInterview:async(_tx,s)=>{if(fail)throw Error('DB offline');if(s.roundId==='denied')throw Error('Current panel assignment or explicit leadership permission required');}}});
 const tx={interviewResumeAnnotation:{findMany:async()=>[{id:'selected',anchor:{page:2,quote:'Actual preserved quote'},document:{id:'version-1',roundId:'allowed'}},{id:'private',anchor:{page:1,quote:'Hidden'},document:{id:'version-2',roundId:'denied'}}]}};
 assert.deepEqual(await helper.votingHighlightChoices(tx,clubId,apps[0],leaderId),[{id:'selected',documentId:'version-1',page:2,quote:'Actual preserved quote'}]);fail=true;await assert.rejects(helper.votingHighlightChoices(tx,clubId,apps[0],leaderId),/DB offline/);
});
test('cumulative score uses canonical submitted reviews, weighted across authorized rounds and missing is null',async()=>{
 const helper=load('utils/voting-room-presentation.ts',{'@/utils/interview-access':{authorizeInterview:async()=>({anonymous:false,member:{id:leaderId},caps:{readClosing:true},app:{roundId:'later'}})}});
 let rows=[{interviewerId:voterId,roundId:'r1',score:7,submittedAt:new Date()},{interviewerId:voterId,roundId:'r2',score:8.5,submittedAt:new Date()}];
 const tx={pipelineRound:{findMany:async()=>[{id:'r1'},{id:'r2'}]},evaluation:{findUnique:async()=>null,findMany:async()=>rows},interviewPanelAssignment:{findUnique:async()=>null}};
 let score=await helper.votingInterviewSummary(tx,clubId,apps[0],leaderId);assert.equal(score.average,7.75);assert.equal(score.submitted,2);assert.equal(score.rounds,2);
 rows=[];score=await helper.votingInterviewSummary(tx,clubId,apps[0],leaderId);assert.equal(score.average,null);
});
