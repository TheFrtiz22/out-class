// Actual independent Prisma/PostgreSQL connections; Auth identity is synthetic.
// Never inherits application DATABASE_URL or touches a hosted project.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),{load}=require('./helpers/voting-harness.cjs');
const url=process.env.OUTCLASS_SECURITY_TEST_DATABASE_URL;
test('native LIVE voting: locked races, changed ballots, scope/revocation, held passes and silent retry-safe finalization',{skip:!url,timeout:120000},async t=>{
 const u=new URL(url);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/outclass_security_test');
 const {PrismaClient}=require('@prisma/client'),owner=new PrismaClient({datasourceUrl:url,log:[]});
 const runtime=new URL(url);runtime.username='outclass_production_app';const db=new PrismaClient({datasourceUrl:runtime.toString(),log:[]});
 try{
  const id=await db.$queryRaw`SELECT current_user AS role,inet_server_addr()='127.0.0.1'::inet AS loopback`;assert.equal(id[0].role,'outclass_production_app');assert.equal(id[0].loopback,true);
  const users=await Promise.all(Array.from({length:6},()=>db.user.create({data:{email:`voting-${randomUUID()}@demo.invalid`}})));
  const club=await db.club.create({data:{name:'Synthetic native voting',slug:randomUUID(),tagline:'',description:'',color:'#142d45',category:'Other',profileFieldVisibility:{gpa:true}}});
  const cycle=await db.recruitmentCycle.create({data:{clubId:club.id,name:'Synthetic cycle'}}),round=await db.pipelineRound.create({data:{clubId:club.id,name:'Interview',type:'INTERVIEW',order:0}}),next=await db.pipelineRound.create({data:{clubId:club.id,name:'Next interview',type:'INTERVIEW',order:1}});
  const caps=['applications.review','applicants.identify','decisions.vote','decisions.start','decisions.manage','decisions.finish','decisions.publish','recruitment.manage'];
  const members=await Promise.all(users.slice(0,3).map((user,i)=>db.clubMember.create({data:{clubId:club.id,userId:user.id,permissions:i===0?caps:i===1?['applications.review','applicants.identify','decisions.vote']:['applications.review','applicants.identify']}})));
  const apps=await Promise.all(users.slice(3,6).map(user=>db.application.create({data:{clubId:club.id,studentId:user.id,roundId:round.id,recruitmentCycleId:cycle.id,status:'IN_REVIEW',submittedAt:new Date()}})));
  function api(user){const mocks={'@/utils/prisma':{prisma:db},'@/utils/auth':{requireAuth:async()=>({user:{id:user.id}}),requireClubPermission:async(clubId,permissions)=>{const m=await db.clubMember.findUnique({where:{userId_clubId:{userId:user.id,clubId}}});assert.ok(m&&m.status==='ACTIVE'&&permissions.every(p=>m.permissions.includes(p)),'Denied');return {user:{id:user.id},membership:m}}},'@/utils/club-write-transaction':{votingWriteLimits:{},clubWriteTransaction:fn=>db.$transaction(fn,{timeout:30000})},'next/cache':{revalidatePath(){}}};return {...load('actions/voting-room.ts',mocks),...load('actions/voting-room-setup.ts',mocks),...load('actions/voting-room-finalization.ts',mocks),...load('actions/voting-session-setup.ts',mocks)}}
  const leader=api(users[0]),voter=api(users[1]),ineligible=api(users[2]),applicant=api(users[3]),outsider=api({id:randomUUID()}),scope={clubId:club.id,sessionId:randomUUID()};
  await leader.createLiveVotingRoom({...scope,cycleId:cycle.id,roundId:round.id,applicationIds:apps.map(a=>a.id),participantIds:members.slice(0,2).map(m=>m.id),leaderMemberIds:[members[0].id],targetSize:1,presentationOptions:{fields:['name','gpa'],highlights:{}}});
  const read=()=>leader.getLiveVotingRoom(scope),command=async(action,extra={})=>leader.commandLiveVotingRoom({...scope,action,requestId:randomUUID(),revision:(await read()).revision,confirmed:true,...extra});
  const vote=async(api,choice,extra={})=>{const s=await api.getLiveVotingRoom(scope),e=s.history.find(p=>p.number===s.passNumber).candidates.find(c=>c.applicationId===s.currentApplicantId);return api.castLiveVotingBallot({...scope,applicationId:s.currentApplicantId,passNumber:s.passNumber,ballotRevision:e.ownBallot?.revision??null,choice,requestId:randomUUID(),...extra})};
  const ok=r=>assert.equal(r.ok,true,JSON.stringify(r));
  await t.test('scheduled setup uses actual SQL guards, explicit roster replacement, CAS, notification receipts and early-start confirmation',async()=>{
   const scheduled={clubId:club.id,sessionId:randomUUID()},create={...scheduled,cycleId:cycle.id,roundId:round.id,applicationIds:apps.map(a=>a.id),participantIds:[members[1].id],leaderMemberIds:[members[0].id],notifyVoters:true,presentationOptions:{fields:['name'],highlights:{},meeting:{version:1,name:'Synthetic native scheduled meeting',timing:'LATER',localTime:new Date(Date.now()+2*86400000).toISOString().slice(0,16),timeZone:'America/New_York',status:'SCHEDULED'}}};
   await Promise.all([leader.createLiveVotingRoom(create),leader.createLiveVotingRoom(create)]);assert.equal(await db.votingSession.count({where:{id:scheduled.sessionId}}),1);assert.equal(await db.userNotification.count({where:{eventKey:{startsWith:'voting.session:'+scheduled.sessionId+':'}}}),1);assert.equal((await leader.getLiveVotingRoom(scheduled)).status,'DRAFT');
   await assert.rejects(db.votingParticipant.deleteMany({where:{sessionId:scheduled.sessionId}}),/frozen/);
   const edit={...create,participantIds:[members[0].id],applicationIds:[apps[2].id],revision:0,requestId:randomUUID()};const updates=await Promise.allSettled([leader.updateVotingSessionSetup(edit),leader.updateVotingSessionSetup({...edit,requestId:randomUUID()})]);assert.equal(updates.filter(v=>v.status==='fulfilled').length,1);assert.equal(await db.votingParticipant.count({where:{sessionId:scheduled.sessionId}}),1);assert.equal(await db.votingCandidate.count({where:{sessionId:scheduled.sessionId}}),1);
   const start={...scheduled,revision:1,requestId:randomUUID(),action:'START'};assert.equal((await leader.commandLiveVotingRoom(start)).code,'EARLY_CONFIRMATION_REQUIRED');const before=await db.userNotification.count({where:{clubId:club.id}});await Promise.all([leader.cancelVotingSession({...scheduled,revision:1,requestId:scheduled.sessionId,notify:true}),leader.cancelVotingSession({...scheduled,revision:1,requestId:scheduled.sessionId,notify:true})]).then(()=>assert.fail('Creation request ID cannot be reused')).catch(e=>assert.match(e.message,/Request ID/));
   const cancel={...scheduled,revision:1,requestId:randomUUID(),notify:true};await Promise.all([leader.cancelVotingSession(cancel),leader.cancelVotingSession(cancel)]);assert.equal((await leader.getLiveVotingRoom(scheduled)).meeting.status,'CANCELLED');assert.equal(await db.userNotification.count({where:{clubId:club.id}}),before+2);assert.equal(await db.votingPass.count({where:{sessionId:scheduled.sessionId}}),0);assert.equal(await db.application.count({where:{id:{in:apps.map(a=>a.id)},status:'IN_REVIEW'}}),3);
  });
  await t.test('current role and QR eligibility, late check-in and no private tallies',async()=>{await assert.rejects(ineligible.getLiveVotingRoom(scope));await assert.rejects(applicant.getLiveVotingRoom(scope));await assert.rejects(outsider.getLiveVotingRoom(scope));assert.equal((await outsider.getLiveVotingJoinInfo(scope)).status,'DENIED');ok(await command('START'));await voter.joinLiveVotingRoom(scope);await voter.joinLiveVotingRoom(scope);assert.equal(await db.auditLog.count({where:{targetId:scope.sessionId,action:'voting.room.joined'}}),1);ok(await command('OPEN_VOTING'));ok(await vote(voter,'HOLD'));ok(await vote(voter,'ACCEPT'));const s=await read();assert.equal(s.history[0].candidates[0].ownBallot,null);assert.ok(!('totals'in s.history[0].candidates[0]));});
  await t.test('independent connection vote/close races and replay never attach to a later applicant',async()=>{const s=await read(),body={...scope,applicationId:apps[0].id,passNumber:1,ballotRevision:1,choice:'REJECT',requestId:randomUUID()};const [v,c]=await Promise.all([voter.castLiveVotingBallot(body),leader.commandLiveVotingRoom({...scope,action:'CLOSE_VOTING',revision:s.revision,requestId:randomUUID(),confirmed:true})]);assert.ok(v.ok||c.ok);if(!c.ok)ok(await command('CLOSE_VOTING'));const late=await vote(voter,'HOLD');assert.equal(late.code,'VOTING_CLOSED');if(v.ok)ok(await voter.castLiveVotingBallot(body));ok(await command('CONFIRM',{choice:'HOLD',reason:'Synthetic discussion'}));const rev=(await read()).revision,a={...scope,action:'ADVANCE',revision:rev};const results=await Promise.all([leader.commandLiveVotingRoom({...a,requestId:randomUUID()}),leader.commandLiveVotingRoom({...a,requestId:randomUUID()})]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal((await read()).currentApplicantId,apps[1].id);});
  await t.test('no-vote acceptance, early end, Hold-only revisit and native atomic finalization without notifications',async()=>{ok(await command('ACCEPT_WITHOUT_VOTE',{reason:'Synthetic shoo-in'}));ok(await command('ADVANCE'));ok(await command('END'));assert.equal((await read()).outcomes[2].outcome,'UNREVIEWED');ok(await command('NEXT_PASS'));assert.equal((await read()).history[1].candidates.length,1);ok(await command('ACCEPT_WITHOUT_VOTE',{reason:'Discussion resolved'}));ok(await command('END'));assert.equal((await read()).accepted,2);const mapping={kind:'ADVANCE',roundId:next.id},plan=await leader.previewLiveVotingFinalization({...scope,mapping}),body={...scope,mapping,guard:plan.guard,revision:plan.revision,requestId:randomUUID(),confirmed:true};const before=await db.userNotification.count({where:{clubId:club.id}}),beforeOutbox=await db.notificationEmailOutbox.count({where:{notification:{clubId:club.id}}});const trigger='voting_failure_'+randomUUID().replaceAll('-','');
   await owner.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='voting.room.finalized' AND NEW."targetId"='${scope.sessionId}' THEN RAISE EXCEPTION 'Injected native voting failure'; END IF; RETURN NEW; END $$`);
   await owner.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
   try{await assert.rejects(leader.finalizeLiveVotingRoom(body),/Injected native voting failure/);assert.equal((await read()).finalizedAt,null);assert.equal(await db.application.count({where:{clubId:club.id,roundId:next.id}}),0);assert.equal(await db.votingRoomCommand.count({where:{sessionId:scope.sessionId,requestId:body.requestId}}),0);}finally{await owner.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "AuditLog"`);await owner.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`);}
   const result=await Promise.all([leader.finalizeLiveVotingRoom(body),leader.finalizeLiveVotingRoom(body)]);result.forEach(ok);assert.equal(await db.auditLog.count({where:{targetId:scope.sessionId,action:'voting.room.finalized'}}),1);assert.equal(await db.application.count({where:{clubId:club.id,roundId:next.id}}),2);assert.equal((await db.application.findUnique({where:{id:apps[2].id}})).roundId,round.id);assert.equal(await db.userNotification.count({where:{clubId:club.id}}),before);assert.equal(await db.notificationEmailOutbox.count({where:{notification:{clubId:club.id}}}),beforeOutbox);assert.equal((await command('CORRECT',{applicationId:apps[1].id,passNumber:1,choice:'HOLD',reason:'Too late'})).code,'FINALIZED');});
  await t.test('atomic decision and audited Undo execute through actual SQL guards without fabricated ballots',async()=>{
   const other={clubId:club.id,sessionId:randomUUID()};await leader.createLiveVotingRoom({...other,cycleId:cycle.id,roundId:round.id,applicationIds:[apps[2].id],participantIds:members.slice(0,2).map(m=>m.id),leaderMemberIds:[members[0].id]});
   const cmd=async(action,extra={})=>leader.commandLiveVotingRoom({...other,action,requestId:randomUUID(),revision:(await leader.getLiveVotingRoom(other)).revision,confirmed:true,reason:'Synthetic transition',...extra});
   ok(await cmd('START'));const passed=await cmd('PASS_WITHOUT_VOTE_AND_ADVANCE',{applicationId:apps[2].id,passNumber:1});ok(passed);assert.equal((await leader.getLiveVotingRoom(other)).status,'PAUSED');ok(await cmd('UNDO_DECISION',{applicationId:apps[2].id,passNumber:1,undoRequestId:passed.result.decision.requestId}));assert.equal((await leader.getLiveVotingRoom(other)).currentApplicantId,apps[2].id);
   ok(await cmd('OPEN_VOTING'));ok(await cmd('CLOSE_VOTING'));const rev=(await leader.getLiveVotingRoom(other)).revision,body={...other,action:'DECIDE_AND_ADVANCE',applicationId:apps[2].id,passNumber:1,choice:'HOLD',reason:'Another pass',revision:rev};const rs=await Promise.all([leader.commandLiveVotingRoom({...body,requestId:randomUUID()}),leader.commandLiveVotingRoom({...body,requestId:randomUUID()})]);assert.equal(rs.filter(r=>r.ok).length,1);const saved=rs.find(r=>r.ok);
   ok(await cmd('UNDO_DECISION',{applicationId:apps[2].id,passNumber:1,undoRequestId:saved.result.decision.requestId}));assert.equal((await leader.getLiveVotingRoom(other)).history[0].candidates[0].ballotState,'CLOSED');const hold=await cmd('DECIDE_AND_ADVANCE',{applicationId:apps[2].id,passNumber:1,choice:'HOLD'});ok(hold);ok(await cmd('NEXT_PASS'));ok(await cmd('OPEN_VOTING'));assert.equal((await cmd('UNDO_DECISION',{applicationId:apps[2].id,passNumber:1,undoRequestId:hold.result.decision.requestId})).code,'UNDO_UNSAFE');assert.equal(await db.votingBallot.count({where:{sessionId:other.sessionId}}),0);
  });
  await t.test('revocation denies even receipt retries and historical reads',async()=>{await db.clubMember.update({where:{id:members[1].id},data:{status:'LEFT',permissions:[],interviewOffices:[]}});await assert.rejects(voter.getLiveVotingRoom(scope));assert.equal((await voter.getLiveVotingJoinInfo(scope)).status,'DENIED');assert.equal(await db.votingBallot.count({where:{sessionId:scope.sessionId,passNumber:2}}),0);});
 }finally{await db.$disconnect();await owner.$disconnect()}
});

// Lock-wait and duplicate-delivery coverage for LIVE finalization; the board publication tests that
// used to exercise these paths were retired with the board (FE-27).
test('native LIVE finalization: revocation during the club lock wait, and a concurrent double finalize deliver at most once',{skip:!url,timeout:180000},async t=>{
 const u=new URL(url);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/outclass_security_test');
 const {PrismaClient}=require('@prisma/client'),owner=new PrismaClient({datasourceUrl:url,log:[]});
 const runtime=new URL(url);runtime.username='outclass_production_app';const db=new PrismaClient({datasourceUrl:runtime.toString(),log:[]});
 try{
  const club=await db.club.create({data:{name:'Synthetic native finalization',slug:randomUUID(),tagline:'',description:'',color:'#142d45',category:'Other'}});
  const cycle=await db.recruitmentCycle.create({data:{clubId:club.id,name:'Synthetic cycle'}}),round=await db.pipelineRound.create({data:{clubId:club.id,name:'Final interview',type:'INTERVIEW',order:0}});
  const caps=['applications.review','applicants.identify','decisions.vote','decisions.start','decisions.manage','decisions.finish','decisions.publish','recruitment.manage'];
  const staff=await Promise.all(Array.from({length:2},()=>db.user.create({data:{email:`finalize-${randomUUID()}@demo.invalid`}})));
  const [leaderMember,voterMember]=await Promise.all(staff.map((user,i)=>db.clubMember.create({data:{clubId:club.id,userId:user.id,permissions:i===0?caps:['applications.review','applicants.identify','decisions.vote']}})));
  function api(user){const mocks={'@/utils/prisma':{prisma:db},'@/utils/auth':{requireAuth:async()=>({user:{id:user.id}}),requireClubPermission:async(clubId,permissions)=>{const m=await db.clubMember.findUnique({where:{userId_clubId:{userId:user.id,clubId}}});assert.ok(m&&m.status==='ACTIVE'&&permissions.every(p=>m.permissions.includes(p)),'Denied');return {user:{id:user.id},membership:m}}},'@/utils/club-write-transaction':{votingWriteLimits:{},clubWriteTransaction:fn=>db.$transaction(fn,{timeout:30000})},'next/cache':{revalidatePath(){}}};return {...load('actions/voting-room.ts',mocks),...load('actions/voting-room-setup.ts',mocks),...load('actions/voting-room-finalization.ts',mocks)}}
  const leader=api(staff[0]),voter=api(staff[1]);
  // A closed room with one accepted and one rejected applicant, ready to finalize with the ADMISSION mapping.
  async function closedRoom(){
   const students=await Promise.all(Array.from({length:2},()=>db.user.create({data:{email:`finalize-student-${randomUUID()}@demo.invalid`}})));
   const apps=await Promise.all(students.map(user=>db.application.create({data:{clubId:club.id,studentId:user.id,roundId:round.id,recruitmentCycleId:cycle.id,status:'IN_REVIEW',submittedAt:new Date()}})));
   const scope={clubId:club.id,sessionId:randomUUID()};
   await leader.createLiveVotingRoom({...scope,cycleId:cycle.id,roundId:round.id,applicationIds:apps.map(a=>a.id),participantIds:[leaderMember.id,voterMember.id],leaderMemberIds:[leaderMember.id],targetSize:1,presentationOptions:{fields:['name'],highlights:{}}});
   const read=()=>leader.getLiveVotingRoom(scope),command=async(action,extra={})=>{const r=await leader.commandLiveVotingRoom({...scope,action,requestId:randomUUID(),revision:(await read()).revision,confirmed:true,...extra});assert.equal(r.ok,true,`${action}: ${JSON.stringify(r)}`);return r};
   const vote=async(as,choice)=>{const s=await as.getLiveVotingRoom(scope),e=s.history.find(p=>p.number===s.passNumber).candidates.find(c=>c.applicationId===s.currentApplicantId);const r=await as.castLiveVotingBallot({...scope,applicationId:s.currentApplicantId,passNumber:s.passNumber,ballotRevision:e.ownBallot?.revision??null,choice,requestId:randomUUID()});assert.equal(r.ok,true,JSON.stringify(r))};
   await command('START');await command('ACCEPT_WITHOUT_VOTE',{reason:'Synthetic decision'});await command('ADVANCE');
   await command('OPEN_VOTING');await vote(leader,'REJECT');await vote(voter,'REJECT');await command('CLOSE_VOTING');await command('CONFIRM',{choice:'REJECT',reason:'Synthetic decision'});await command('END');
   const mapping={kind:'ADMISSION'},plan=await leader.previewLiveVotingFinalization({...scope,mapping});
   return {scope,apps,read,body:{...scope,mapping,guard:plan.guard,revision:plan.revision,requestId:randomUUID(),confirmed:true}};
  }
  async function blocked(){const deadline=Date.now()+10000;while(Date.now()<deadline){const rows=await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%SELECT id FROM "Club"%'`;if(rows.length)return;await new Promise(r=>setTimeout(r,15))}throw Error('Expected actual club lock wait')}
  async function waitingRace(operation,mutation){
   let release,ready;const hold=new Promise(r=>release=r),locked=new Promise(r=>ready=r);
   const blocker=db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${club.id} FOR UPDATE`;ready();await hold;await mutation(tx)},{timeout:20000});await locked;
   const pending=operation();const settled=pending.then(value=>({value}),error=>({error}));
   try{await blocked()}finally{release()}await blocker;return settled;
  }
  await t.test('a leader whose access is revoked while waiting on the club lock changes no status and writes no offer or audit',async()=>{
   for(const denial of ['capability','membership']){
    const room=await closedRoom();
    const result=await waitingRace(()=>leader.finalizeLiveVotingRoom(room.body),tx=>tx.clubMember.update({where:{id:leaderMember.id},data:denial==='membership'?{status:'LEFT',permissions:[]}:{permissions:[]}}));
    assert.ok(result.error||result.value?.ok===false,`${denial}: finalization is refused`);
    assert.equal((await room.read().catch(()=>null))?.finalizedAt??null,null);
    assert.deepEqual((await db.application.findMany({where:{id:{in:room.apps.map(a=>a.id)}},select:{status:true}})).map(a=>a.status),['IN_REVIEW','IN_REVIEW'],`${denial}: statuses unchanged`);
    assert.equal(await db.clubInvitation.count({where:{applicationId:{in:room.apps.map(a=>a.id)}}}),0,`${denial}: no offer`);
    assert.equal(await db.auditLog.count({where:{targetId:room.scope.sessionId,action:'voting.room.finalized'}}),0,`${denial}: no finalization audit`);
    assert.equal(await db.auditLog.count({where:{targetId:{in:room.apps.map(a=>a.id)},action:{in:['recruitment.decision.published','club.round.move']}}}),0,`${denial}: no decision audit`);
    assert.equal(await db.votingRoomCommand.count({where:{sessionId:room.scope.sessionId,requestId:room.body.requestId}}),0,`${denial}: no receipt`);
    await db.clubMember.update({where:{id:leaderMember.id},data:{status:'ACTIVE',permissions:caps}});
   }
  });
  await t.test('a concurrent double finalize and double send produce one letter, one notification and one outbox row per applicant',async()=>{
   const room=await closedRoom();
   (await Promise.all([leader.finalizeLiveVotingRoom(room.body),leader.finalizeLiveVotingRoom(room.body)])).forEach(r=>assert.equal(r.ok,true,JSON.stringify(r)));
   assert.equal(await db.auditLog.count({where:{targetId:room.scope.sessionId,action:'voting.room.finalized'}}),1);
   assert.deepEqual((await db.application.findMany({where:{id:{in:room.apps.map(a=>a.id)}},orderBy:{id:'asc'},select:{id:true,status:true}})).map(a=>a.status).sort(),['ACCEPTED','REJECTED']);
   const send=requestId=>leader.sendLiveVotingNotifications({...room.scope,requestId,confirmed:true});
   const results=await Promise.allSettled([send(randomUUID()),send(randomUUID())]);
   assert.ok(results.some(r=>r.status==='fulfilled'),JSON.stringify(results.map(r=>r.reason?.message)));
   for(const a of room.apps){
    const eventKey=`decision:${a.id}:1`;
    assert.equal(await db.decisionLetter.count({where:{applicationId:a.id}}),1,`one letter for ${eventKey}`);
    assert.equal(await db.userNotification.count({where:{userId:a.studentId,eventKey}}),1,`one notification ${eventKey}`);
    assert.equal(await db.notificationEmailOutbox.count({where:{notification:{userId:a.studentId,eventKey}}}),1,`one outbox row ${eventKey}`);
   }
   assert.equal(await db.clubInvitation.count({where:{applicationId:{in:room.apps.map(a=>a.id)}}}),1,'one offer, for the accepted applicant');
  });
 }finally{await db.$disconnect();await owner.$disconnect()}
});
