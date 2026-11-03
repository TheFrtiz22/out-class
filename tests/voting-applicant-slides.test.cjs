const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/voting-harness.cjs');

test('canonical score evidence excludes incompatible rounds, missing/invalid scores and duplicate reviewers, preserves historical precision',()=>{
 const {votingScoreEvidence}=load('lib/voting-interview-evidence.ts'),rounds=[{id:'r1',name:'First interview'},{id:'r2',name:'Second interview'}];
 const row=(roundId,interviewerId,score,submittedAt='2026-11-03')=>({roundId,interviewerId,score,submittedAt});
 const score=votingScoreEvidence(rounds,[row('r1','a',8.25),row('r1','a',1),row('r2','a',9.5),row('generic','b',100),row('r1','b',0),row('r2','c',null),row('r2','d',7,null)]);
 assert.equal(score.average,8.875);assert.equal(score.submitted,2);assert.equal(score.scale,'1–10');assert.deepEqual(score.byRound,[{roundId:'r1',roundName:'First interview',average:8.25,submitted:1},{roundId:'r2',roundName:'Second interview',average:9.5,submitted:1}]);
 assert.equal(votingScoreEvidence(rounds,[]).average,null);assert.equal(votingScoreEvidence(rounds,[]).submitted,0);
});

test('selected evidence reauthorizes every round, projects only submitted final thoughts and never legacy questions or private notes',async()=>{
 let allow=true,readThoughts=0,query;const helper=load('utils/voting-room-presentation.ts',{'@/utils/interview-access':{authorizeInterview:async(_tx,scope)=>{if(!allow||scope.roundId==='denied')throw Error('Current panel assignment or explicit leadership permission required');return{anonymous:false,member:{id:'reviewer'},caps:{readClosing:true},app:{roundId:'later'}}}}});
 const tx={pipelineRound:{findMany:async args=>{assert.deepEqual(args.where.type.in,['INTERVIEW','GROUP_INTERVIEW']);assert.equal(args.where.anonymousReview,false);return[{id:'r1',name:'Interview one'},{id:'denied',name:'Private round'}]}},evaluation:{findUnique:async()=>null,findMany:async()=>[]},interviewPanelAssignment:{findUnique:async()=>null},interviewRecord:{findMany:async args=>{readThoughts++;query=args;return[{id:'final',applicationId:'app',roundId:'r1',interviewerId:'author',draft:{finalInterviewThoughts:'Submitted final assessment.',applicantQuestions:'LEGACY QUESTIONS',additionalNotes:'PRIVATE MISC',questionNotes:['PRIVATE NOTES']},evaluation:{applicationId:'app',roundId:'r1',interviewerId:'author',submittedAt:new Date()},interviewer:{clubId:'club',user:{studentProfile:{firstName:'QA',lastName:'Reviewer'}}}},{id:'legacy',applicationId:'app',roundId:'r1',interviewerId:'author',draft:{applicantQuestions:'NEVER SUBSTITUTE'},evaluation:{applicationId:'app',roundId:'r1',interviewerId:'author',submittedAt:new Date()},interviewer:{clubId:'club',user:{studentProfile:null}}}];}}};
 let result=await helper.votingSelectedEvidence(tx,'club','app','user',['interviewScore'],false);assert.equal(readThoughts,0);assert.equal('finalInterviewThoughts'in result,false);assert.equal(result.interviewScore.average,null);
 result=await helper.votingSelectedEvidence(tx,'club','app','user',['finalInterviewThoughts'],false);assert.equal('interviewScore'in result,false);assert.deepEqual(result.finalInterviewThoughts,[{id:'final',roundId:'r1',roundName:'Interview one',interviewer:'QA Reviewer',text:'Submitted final assessment.'}]);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|LEGACY|NEVER|draft|questionNotes/);
 assert.deepEqual(query.where.roundId.in,['r1']);assert.deepEqual(query.where.completedAt,{not:null});assert.equal(query.where.anonymousReview,false);assert.deepEqual(query.where.evaluation.submittedAt,{not:null});
 assert.deepEqual(await helper.votingSelectedEvidence(tx,'club','app','user',['interviewScore','finalInterviewThoughts'],true),{});assert.equal(readThoughts,1);
 allow=false;assert.deepEqual(await helper.votingSelectedEvidence(tx,'club','app','user',['interviewScore','finalInterviewThoughts'],false),{});assert.equal(readThoughts,1);
});

test('ordinary interviewer must submit their own review before peer evidence; transport failures are not empty scores',async()=>{
 let own=null,offline=false;const helper=load('utils/voting-room-presentation.ts',{'@/utils/interview-access':{authorizeInterview:async()=>{if(offline)throw Error('Database offline');return{anonymous:false,member:{id:'self'},caps:{readClosing:false},app:{roundId:'r'}}}}});
 const tx={pipelineRound:{findMany:async()=>[{id:'r',name:'Round'}]},evaluation:{findUnique:async()=>own,findMany:async()=>[]},interviewPanelAssignment:{findUnique:async()=>({revokedAt:null})},interviewRecord:{findMany:async()=>[]}};
 assert.deepEqual(await helper.votingSelectedEvidence(tx,'club','app','self',['interviewScore','finalInterviewThoughts'],false),{});
 own={submittedAt:new Date()};const result=await helper.votingSelectedEvidence(tx,'club','app','self',['interviewScore','finalInterviewThoughts'],false);assert.equal(result.interviewScore.average,null);assert.deepEqual(result.finalInterviewThoughts,[]);
 offline=true;await assert.rejects(helper.votingSelectedEvidence(tx,'club','app','self',['interviewScore'],false),/Database offline/);
});

test('current selected-field projection removes stale fields from the response and has a fixed pipeline field order',()=>{
 const {selectedVotingDisplay}=load('lib/voting-slide-fields.ts');const display={applicationId:'app',roundId:'round',anonymous:false,configured:['gpa','name','major','photo'],visible:['gpa','name','major','photo'],withheld:[],sections:[{field:'gpa',items:['3.8']},{field:'name',items:['PRIVATE NAME']},{field:'major',items:['PRIVATE MAJOR']}],photo:'PRIVATE PHOTO',links:[{field:'resume',href:'PRIVATE DOCUMENT'}],observations:[{body:'PRIVATE NOTES'}]};
 const slim=selectedVotingDisplay(display,['gpa']);assert.deepEqual(slim.visible,['gpa']);assert.doesNotMatch(JSON.stringify(slim),/PRIVATE/);assert.equal(slim.photo,null);
 assert.deepEqual(selectedVotingDisplay(display,['gpa','major','name']).sections.map(s=>s.field),['name','major','gpa']);
});

test('Demo uses only completed canonical thoughts, omits drafts/deselections and revokes peer evidence without live calls',async()=>{
 const h=require('./helpers/demo-harness.cjs').harness(),{demoStore}=h.load('lib/demo/store.ts'),api=h.load('lib/voting-room-api.ts');demoStore.start();
 try{
  demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});const s=demoStore.get(),club=s.clubs[0],round=club.rounds.find(r=>r.name==='Interview'),leader=s.memberships.find(m=>m.clubId===club.id&&m.isOwner);
  const setup=await api.getLiveVotingSetup({clubId:club.id,roundId:round.id,cycleId:club.id}),app=s.applications.find(a=>setup.applicants.some(row=>row.id===a.id)&&a.studentId!==leader.userId),sessionId=crypto.randomUUID(),scope={clubId:club.id,sessionId,applicationId:app.id};
  demoStore.mutate(s=>{s.memberships.find(m=>m.id===leader.id).interviewOffices=['PRESIDENT'];s.interviews=s.interviews.filter(r=>r.applicationId!==app.id);const target=s.applications.find(a=>a.id===app.id);target.evaluations=[];for(const [i,completedAt]of [new Date().toISOString(),null].entries()){const member=s.memberships.filter(m=>m.clubId===club.id)[i];target.evaluations.push({id:crypto.randomUUID(),roundId:round.id,interviewerId:member.id,applicationId:app.id,score:8.5,submittedAt:completedAt,round:round.name,notes:'PRIVATE MISC'});s.interviews.push({id:crypto.randomUUID(),clubId:club.id,applicationId:app.id,roundId:round.id,interviewerId:member.id,completedAt,revision:1,questions:[],draft:{questionNotes:[],additionalQuestions:[],overallReview:'PRIVATE',score:8.5,applicantQuestions:'LEGACY',finalInterviewThoughts:completedAt?'Final published thoughts.':'PRIVATE DRAFT'}})}});
  await api.createLiveVotingRoom({clubId:club.id,sessionId,cycleId:club.id,roundId:round.id,leaderMemberIds:[leader.id],participantIds:[leader.id],applicationIds:[app.id],presentationOptions:{fields:['name','finalInterviewThoughts','interviewScore'],highlights:{}}});
  let result=await api.getLiveVotingPresentation(scope);assert.equal(result.finalInterviewThoughts.length,1);assert.equal(result.finalInterviewThoughts[0].text,'Final published thoughts.');assert.equal(result.interviewScore.submitted,1);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|LEGACY|draft/);
  demoStore.mutate(s=>s.votingSessions.find(r=>r.id===sessionId).presentationOptions.fields=['name']);result=await api.getLiveVotingPresentation(scope);assert.equal('finalInterviewThoughts'in result,false);assert.equal('interviewScore'in result,false);
  demoStore.mutate(s=>{s.votingSessions.find(r=>r.id===sessionId).presentationOptions.fields=['finalInterviewThoughts','interviewScore'];s.memberships.find(m=>m.id===leader.id).interviewOffices=[];s.interviewFoundation.assignments=s.interviewFoundation.assignments.filter(a=>a.memberId!==leader.id)});result=await api.getLiveVotingPresentation(scope);assert.equal('finalInterviewThoughts'in result,false);assert.equal('interviewScore'in result,false);
  demoStore.mutate(s=>{s.clubs[0].rounds.find(r=>r.id===round.id).anonymousReview=true;s.votingSessions.find(r=>r.id===sessionId).presentationOptions.fields=['name','photo','gpa','finalInterviewThoughts','interviewScore']});result=await api.getLiveVotingPresentation(scope);assert.equal(result.anonymous,true);assert.equal(result.photo,null);assert.ok(result.sections.every(s=>s.field!=='name'));assert.equal('finalInterviewThoughts'in result,false);assert.equal('interviewScore'in result,false);assert.doesNotMatch(JSON.stringify(result),/Final published thoughts|PRIVATE DRAFT/);assert.equal(h.calls(),0);
 }finally{demoStore.stop()}
});
