const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,load,clubId,roundId,cycleId}=require('./helpers/voting-room-harness.cjs');
test('hosted voting reads retain authorization when projection latency exceeds Prisma default',async()=>{
 const h=harness();await h.create({presentationOptions:{fields:['name'],highlights:{}}});await h.command('START');await h.command('END');
 const prisma=h.mocks['@/utils/prisma'].prisma,transaction=prisma.$transaction;
 let reads=0;
 prisma.$transaction=(work,options)=>{
  // Model a six-second hosted projection without slowing the regression itself.
  if((options?.timeout??5000)<6000)throw Error('P2028: expired interactive transaction');
  assert.ok(options.timeout<=30000);assert.equal(options.maxWait,5000);reads++;
  return transaction(work);
 };
 h.tx.interviewResumeAnnotation={findMany:async()=>[]};
 const setup=load('actions/voting-room-setup.ts',h.mocks),meeting=load('actions/voting-room-finalization.ts',h.mocks);
 h.mocks['@/actions/applicant-intelligence']={getApplicantDisplay:async()=>({anonymous:false})};
 const room=load('actions/voting-room.ts',h.mocks);
 await room.listLiveVotingRooms({clubId});await room.getLiveVotingRoom(h.scope);
 await room.getLiveVotingPresentation({...h.scope,applicationId:h.state().apps[0].id});
 await setup.getLiveVotingSetup({clubId,roundId,cycleId});
 await setup.getVotingHighlightOptions({clubId,roundId,cycleId,applicationId:h.state().apps[0].id});
 await setup.getLiveVotingJoinInfo(h.scope);await meeting.getLiveVotingSummary(h.scope);
 await meeting.previewLiveVotingFinalization({...h.scope,mapping:{kind:'ADMISSION'}});
 assert.equal(reads,8);
 h.members[0].permissions=[];await assert.rejects(room.getLiveVotingRoom(h.scope),/Denied/);
});
test('canonical voting display keeps repeatable-read isolation and bounds only session reads',async()=>{
 const seen=[],prisma={$transaction:async(_work,options)=>{seen.push(options);if(options.timeout!==undefined&&(options.timeout<6000||options.timeout>30000))throw Error('Invalid hosted read budget');return {};}};
 const api=load('actions/applicant-intelligence.ts',{'@/utils/prisma':{prisma},'@/utils/auth':{requireClubPermission:async()=>({user:{id:'synthetic'},membership:{id:'member'}})}});
 const {sessionId,apps}=require('./helpers/voting-room-harness.cjs');
 await api.getApplicantDisplay({clubId,applicationId:apps[0]});
 await api.getApplicantDisplay({clubId,applicationId:apps[0],sessionId});
 assert.deepEqual(seen[0],{isolationLevel:'RepeatableRead'});
 assert.deepEqual(seen[1],{isolationLevel:'RepeatableRead',maxWait:5000,timeout:30000});
});
