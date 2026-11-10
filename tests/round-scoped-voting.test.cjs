// Round-scoped voting across a cycle: Pass meaning per round, and no side effects before explicit finalization.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{randomUUID}=require('node:crypto');
const {harness,load,uuid,clubId,roundId,leaderId,voterId,apps}=require('./helpers/voting-room-harness.cjs');
const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
const interview1={id:uuid(61),clubId,name:'Interview 1',type:'INTERVIEW',order:1,archivedAt:null,anonymousReview:false};
const interview2={id:uuid(62),clubId,name:'Interview 2',type:'INTERVIEW',order:2,archivedAt:null,anonymousReview:false};
/** The session round is `current`; the club's rounds are application review, Interview 1 and Interview 2. */
function threeRounds(current){
 const h=harness();
 const review={id:roundId,clubId,name:'Application review',type:'APPLICATION_REVIEW',order:0,archivedAt:null,anonymousReview:false};
 const all=[review,structuredClone(interview1),structuredClone(interview2)],chosen=all.find(r=>r.name===current);
 Object.assign(h.round,chosen,{id:roundId});h.rounds.splice(0,h.rounds.length,h.round,...all.filter(r=>r!==chosen));
 return h;
}

test('Pass means advance while a later round exists and a final acceptance recommendation in the last round',async()=>{
 const {passMeaning,targetLabel}=load('lib/voting-target-summary.ts');
 for(const [round,kind,target] of [['Application review','advance','Advancement target for Application review'],['Interview 1','advance','Advancement target for Interview 1'],['Interview 2','final','Final class-size target']]){
  const h=threeRounds(round);await h.create();const room=await h.read();
  assert.equal(room.targetSummary.pass.kind,kind,round);assert.equal(room.targetSummary.target.label,target);
  assert.equal(room.targetSummary.pass.label,kind==='final'?'Pass means a final acceptance recommendation.':'Pass means advance to a later round.');
  // Archived later rounds do not count, the same rule as the target label.
  if(round==='Interview 1'){h.rounds.find(r=>r.name==='Interview 2').archivedAt=new Date();assert.equal((await h.read()).targetSummary.pass.kind,'final');}
 }
 assert.equal(passMeaning(null).kind,'advance');assert.equal(targetLabel({name:'X',final:true}),'Final class-size target');
});

test('ballots and confirmed outcomes change no stage, membership or messages until explicit finalization',async()=>{
 const h=threeRounds('Interview 1');await h.create();
 const apps0=structuredClone(h.state().apps),members0=structuredClone(h.members);
 ok(await h.command('START'));ok(await h.command('OPEN_VOTING'));ok(await h.vote('ACCEPT'));h.as(voterId);ok(await h.vote('ACCEPT'));h.as(leaderId);
 ok(await h.command('CLOSE_VOTING'));ok(await h.command('CONFIRM',{choice:'ACCEPT'}));ok(await h.command('ADVANCE'));
 ok(await h.command('OPEN_VOTING'));ok(await h.vote('REJECT'));ok(await h.command('CLOSE_VOTING'));
 assert.deepEqual(h.state().apps,apps0,'no application stage, round or status change from ballots or confirmation');
 assert.deepEqual(h.members,members0,'no membership change');
 assert.deepEqual(h.state().notifications,[],'no messages');assert.deepEqual(h.state().offers,[],'no offers');
 assert.ok(!h.state().audit.some(a=>/round\.move|decision|offer/.test(a.action)),'no recruitment decision is recorded');
 assert.equal((await h.read()).targetSummary.decisions.pass,1,'the outcome is recorded only in the session');
});

test('discussion-band colours write only the round configuration and an audit row',async()=>{
 const calls=[],cycle=randomUUID(),round=randomUUID(),club=randomUUID();
 const member={status:'ACTIVE',permissions:['recruitment.manage','applicants.identify','applications.review']};
 const config={instructions:'Kit'};
 const handlers={clubMember:{findUnique:async()=>member},user:{findUnique:async()=>({disabledAt:null})},club:{findUniqueOrThrow:async()=>({pipelineVersion:0})},
  pipelineRound:{findFirst:async()=>({id:round,configuration:config}),update:async()=>({})},recruitmentCycle:{findFirst:async()=>({id:cycle})},auditLog:{create:async()=>({})}};
 const tx=new Proxy({$queryRaw:async()=>[]},{get:(t,model)=>model in t?t[model]:new Proxy({},{get:(_,method)=>async args=>{calls.push(`${String(model)}.${String(method)}`);const fn=handlers[model]?.[method];if(!fn)throw Error(`unexpected ${String(model)}.${String(method)}`);return fn(args);}})});
 const mocks={'@/utils/prisma':{prisma:{$transaction:fn=>fn(tx)}},'@/utils/auth':{requireClubPermission:async()=>({user:{id:'leader'},membership:member})},'next/cache':{revalidatePath(){}}};
 const mod={exports:{}},req=n=>n in mocks?mocks[n]:n.startsWith('@/lib/')?loadTs(n.slice(2)+'.ts'):require(n);
 function loadTs(file){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,m,m.exports);return m.exports;}
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync('actions/ranked-review.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,mod,mod.exports);
 await mod.exports.saveRankedReviewBands({clubId:club,roundId:round,cycleKey:cycle,expectedRevision:0,bands:{green:{start:1,end:2},yellow:{start:3,end:4},red:{start:5}}});
 const writes=calls.filter(c=>/\.(update|create|upsert|delete|createMany|updateMany|deleteMany)$/.test(c));
 assert.deepEqual(writes,['pipelineRound.update','auditLog.create']);
 assert.ok(!calls.some(c=>/^(application|clubMember\.(update|create)|userNotification|clubInvitation|votingSession)/.test(c)),calls.join());
});

test('Demo Mode: application review, Interview 1 and Interview 2 run the same round-scoped sequence with zero server-action calls',async()=>{
 const h=require('./helpers/demo-harness.cjs').harness(),{demoStore}=h.load('lib/demo/store.ts'),api=h.load('lib/voting-room-api.ts');demoStore.start();
 try{
  demoStore.mutate(s=>s.perspective={role:'leader',clubId:s.clubs[0].id});
  const s0=demoStore.get(),club=s0.clubs[0],leader=s0.memberships.find(m=>m.clubId===club.id&&m.isOwner);
  const ordered=[...club.rounds].filter(r=>!r.archivedAt).sort((a,b)=>a.order-b.order);
  const [reviewRound,r1,r2]=ordered;assert.ok(ordered.length>=4,'Demo club has a later decision round');
  const others=s0.memberships.filter(m=>m.clubId===club.id&&m.id!==leader.id).slice(0,2);
  demoStore.mutate(s=>{
   const rounds=s.clubs[0].rounds;Object.assign(rounds.find(r=>r.id===reviewRound.id),{type:'APPLICATION_REVIEW',name:'Application review',anonymousReview:false});
   Object.assign(rounds.find(r=>r.id===r1.id),{type:'INTERVIEW',name:'Interview 1',anonymousReview:false});Object.assign(rounds.find(r=>r.id===r2.id),{type:'INTERVIEW',name:'Interview 2',anonymousReview:false});
   s.memberships.find(m=>m.id===leader.id).interviewOffices=['PRESIDENT'];
   for(const m of others){const t=s.memberships.find(v=>v.id===m.id);t.status='ACTIVE';t.permissions=[...new Set([...(t.permissions||[]),'applications.review','applicants.identify'])];}
  });
  const setupFor=async round=>api.getLiveVotingSetup({clubId:club.id,roundId:round.id,cycleId:club.id});
  const pick=s=>s.applications.find(a=>a.clubId===club.id&&a.studentId!==leader.userId&&['SUBMITTED','IN_REVIEW','INTERVIEWING','WAITLISTED'].includes(a.status));
  const app=pick(demoStore.get());
  demoStore.mutate(s=>{const a=s.applications.find(v=>v.id===app.id);a.roundId=reviewRound.id;a.evaluations=[];s.interviews=s.interviews.filter(r=>r.applicationId!==app.id);});
  const room=async round=>{const sessionId=crypto.randomUUID(),setup=await setupFor(round);assert.ok(setup.applicants.some(a=>a.id===app.id),round.name);
   await api.createLiveVotingRoom({clubId:club.id,sessionId,cycleId:club.id,roundId:round.id,leaderMemberIds:[leader.id],participantIds:[leader.id],applicationIds:[app.id],presentationOptions:{fields:['name','interviewScore','finalInterviewThoughts'],highlights:{}}});
   return {clubId:club.id,sessionId,applicationId:app.id};};
  // Application review: voting works, no interview scores, no zeros.
  let scope=await room(reviewRound),p=JSON.parse(JSON.stringify(await api.getLiveVotingPresentation(scope)));
  assert.equal(p.interviewScore.current.status,'none');assert.equal(p.interviewScore.average,null);assert.deepEqual(p.earlierInterviewRounds,[]);assert.doesNotMatch(JSON.stringify(p),/"average":0/);
  let snap=await api.getLiveVotingRoom(scope);assert.equal(snap.targetSummary.pass.kind,'advance');
  const status0=demoStore.get().applications.find(a=>a.id===app.id).status;
  await api.commandLiveVotingRoom({...scope,requestId:crypto.randomUUID(),revision:snap.revision,action:'START'});snap=await api.getLiveVotingRoom(scope);
  await api.commandLiveVotingRoom({...scope,requestId:crypto.randomUUID(),revision:snap.revision,action:'OPEN_VOTING'});snap=await api.getLiveVotingRoom(scope);
  const vote=await api.castLiveVotingBallot({...scope,requestId:crypto.randomUUID(),passNumber:snap.passNumber,applicationId:app.id,ballotRevision:null,choice:'ACCEPT'});assert.equal(vote.ok,true,JSON.stringify(vote));
  const after=demoStore.get().applications.find(a=>a.id===app.id);assert.equal(after.status,status0);assert.equal(after.roundId,reviewRound.id,'a ballot never moves the applicant');
  // Interview 2 with Interview 1 history: current-round average only; Interview 1 is a labelled earlier group.
  demoStore.mutate(s=>{const a=s.applications.find(v=>v.id===app.id);a.roundId=r2.id;a.status='INTERVIEWING';
   for(const [m,round,score,text] of [[others[0],r1,8,'Demo R1 summary.'],[others[0],r2,9,'Demo R2 summary.'],[others[1],r2,7,'Demo R2 peer.']]){
    const at=new Date().toISOString();s.interviewFoundation.assignments.push({applicationId:a.id,roundId:round.id,memberId:m.id,revokedAt:null});
    a.evaluations.push({id:crypto.randomUUID(),roundId:round.id,interviewerId:m.id,applicationId:a.id,score,submittedAt:at,round:round.name,notes:'PRIVATE'});
    s.interviews.push({id:crypto.randomUUID(),clubId:club.id,applicationId:a.id,roundId:round.id,interviewerId:m.id,completedAt:at,revision:1,questions:[],anonymousReview:false,draft:{questionNotes:[],additionalQuestions:[],finalInterviewThoughts:text}});
   }});
  scope=await room(r2);p=JSON.parse(JSON.stringify(await api.getLiveVotingPresentation(scope)));
  assert.equal(p.interviewScore.average,8);assert.equal(p.interviewScore.current.roundName,'Interview 2');
  assert.deepEqual(p.earlierInterviewRounds.map(g=>[g.roundName,g.average,g.entries.map(e=>[e.score,e.summary,e.source])]),[['Interview 1',8,[[8,'Demo R1 summary.','kit']]]]);
  assert.doesNotMatch(JSON.stringify(p),/PRIVATE/);
  assert.equal((await api.getLiveVotingRoom(scope)).targetSummary.pass.kind,'advance','a later decision round exists');
  // Without leadership review access and without Interview 1: no earlier evidence at all.
  demoStore.mutate(s=>{s.memberships.find(m=>m.id===leader.id).interviewOffices=[];});
  p=JSON.parse(JSON.stringify(await api.getLiveVotingPresentation(scope)));assert.deepEqual(p.earlierInterviewRounds,[]);assert.doesNotMatch(JSON.stringify(p),/Demo R1/);
  // Anonymous Interview 1: never listed, even for leadership.
  demoStore.mutate(s=>{s.memberships.find(m=>m.id===leader.id).interviewOffices=['PRESIDENT'];s.clubs[0].rounds.find(r=>r.id===r1.id).anonymousReview=true;});
  p=JSON.parse(JSON.stringify(await api.getLiveVotingPresentation(scope)));assert.deepEqual(p.earlierInterviewRounds,[]);assert.equal(p.interviewScore.average,8);
  assert.equal(h.calls(),0,'Demo never invokes a live server action');
 }finally{demoStore.stop()}
});
