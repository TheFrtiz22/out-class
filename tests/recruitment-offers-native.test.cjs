// Production commands against an explicitly named disposable localhost PostgreSQL database.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),{randomUUID}=require('node:crypto');
const databaseUrl=process.env.OUTCLASS_RECRUITMENT_TEST_DATABASE_URL;
function api(prisma,actor,onAuthorized=()=>{}){
 const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file].exports;const m={exports:{}};cache[file]=m;
 const auth={requireAuth:async()=>{const user=await prisma.user.findUniqueOrThrow({where:{id:actor}});if(user.disabledAt)throw Error('Denied');onAuthorized();return{user}},requireClubPermission:async(clubId,caps)=>{const membership=await prisma.clubMember.findUnique({where:{userId_clubId:{userId:actor,clubId}}});if(!membership||membership.status!=='ACTIVE'||!caps.every(p=>membership.isOwner||membership.permissions.includes(p)))throw Error('Denied');const user=await prisma.user.findUniqueOrThrow({where:{id:actor}});if(user.disabledAt)throw Error('Denied');onAuthorized();return{user,membership}}};
 const mocks={'@/utils/prisma':{prisma},'@/utils/auth':auth,'next/cache':{revalidatePath(){},revalidateTag(){}},'next/server':{after(){}},'@/utils/platform-admin':{requirePlatformAdmin:async()=>({id:actor})},'@/utils/email':{invitationEmailConfig(){}}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n),m,m.exports);return m.exports;}
 return{crm:load('actions/crm.ts'),offers:load('actions/recruitment-offers.ts'),voting:load('actions/voting.ts'),settings:load('actions/club-settings.ts'),members:load('actions/organization-members.ts'),access:load('actions/club-access.ts'),platform:load('actions/platform-admin.ts')};
}
test('native offers: publication, student authority, membership, retries and races',{skip:!databaseUrl,timeout:120000},async t=>{
 const url=new URL(databaseUrl);assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/outclass_recruitment_test');
 const {PrismaClient}=require('@prisma/client'),db=new PrismaClient({datasourceUrl:databaseUrl});
 const users=await Promise.all(Array.from({length:12},()=>db.user.create({data:{email:`offers-${randomUUID()}@demo.invalid`}}))),leader=users[0];
 const club=await db.club.create({data:{name:'Synthetic offer club',slug:randomUUID(),tagline:'',description:'',category:'Other',color:'#142d45'}});
 const round=await db.pipelineRound.create({data:{clubId:club.id,name:'Review',order:0,type:'APPLICATION_REVIEW'}}),interview=await db.pipelineRound.create({data:{clubId:club.id,name:'Interview',order:1,type:'INTERVIEW'}});
 const member=await db.clubMember.create({data:{clubId:club.id,userId:leader.id,isOwner:true}}),l=api(db,leader.id);
 const apps=await Promise.all(users.slice(1).map(u=>db.application.create({data:{clubId:club.id,studentId:u.id,roundId:round.id,status:'IN_REVIEW'}})));
 const decide=(a,status='ACCEPTED',expectedStatus)=>l.crm.setApplicationStatus({clubId:club.id,applicationId:a.id,status,...(expectedStatus?{expectedStatus}:{})});
 const offer=a=>db.clubInvitation.findUniqueOrThrow({where:{applicationId:a.id}}),membership=a=>db.clubMember.findUnique({where:{userId_clubId:{userId:a.studentId,clubId:club.id}}});
 try{
 await t.test('parallel direct retries create one member-only offer and one event',async()=>{await Promise.all([decide(apps[0],'ACCEPTED','IN_REVIEW'),decide(apps[0],'ACCEPTED','IN_REVIEW')]);assert.equal(await db.clubInvitation.count({where:{applicationId:apps[0].id}}),1);await assert.rejects(decide(apps[0],'REJECTED','IN_REVIEW'),/changed/i);const o=await offer(apps[0]);assert.equal(o.requestedRole,'MEMBER');assert.deepEqual(o.permissions,[]);assert.equal(await db.auditLog.count({where:{targetId:o.id,action:'offer.created'}}),1);assert.equal(await db.auditLog.count({where:{targetId:apps[0].id,action:'club.decision.update'}}),1)});
 await t.test('foreign student denied; simultaneous accept creates one safe membership',async()=>{await assert.rejects(api(db,apps[1].studentId).offers.respondToOffer(apps[0].id,'ACCEPT'),/unavailable/);const a=api(db,apps[0].studentId);await Promise.all([a.offers.respondToOffer(apps[0].id,'ACCEPT'),a.offers.respondToOffer(apps[0].id,'ACCEPT')]);const m=await membership(apps[0]);assert.equal(m.accessRole,'MEMBER');assert.equal(m.role,'GENERAL_MEMBER');assert.equal(m.isOwner,false);assert.deepEqual(m.permissions,[]);assert.equal(await db.auditLog.count({where:{targetId:(await offer(apps[0])).id,action:'offer.accepted'}}),1)});
 await t.test('reversal preserves accepted membership, final progression/reopen denied',async()=>{const m=await membership(apps[0]);await decide(apps[0],'REJECTED');assert.deepEqual(await membership(apps[0]),m);assert.equal((await offer(apps[0])).status,'ACCEPTED');await assert.rejects(l.crm.moveApplicantRound({clubId:club.id,applicationId:apps[0].id,newRoundId:interview.id}),/Final decisions/);await assert.rejects(decide(apps[0],'IN_REVIEW'),/cannot be reopened/)});
 await t.test('repeated decline keeps historical acceptance and creates no membership',async()=>{await decide(apps[1]);const a=api(db,apps[1].studentId);await Promise.all([a.offers.respondToOffer(apps[1].id,'DECLINE'),a.offers.respondToOffer(apps[1].id,'DECLINE')]);assert.equal((await offer(apps[1])).status,'DECLINED');assert.equal((await db.application.findUnique({where:{id:apps[1].id}})).status,'ACCEPTED');assert.equal(await membership(apps[1]),null);await assert.rejects(a.offers.respondToOffer(apps[1].id,'ACCEPT'),/unavailable/)});
 await t.test('decision reversal revokes pending offer and cannot resurrect it on retry',async()=>{await decide(apps[2]);await decide(apps[2],'WAITLISTED');assert.equal((await offer(apps[2])).status,'REVOKED');await decide(apps[2]);assert.equal((await offer(apps[2])).status,'REVOKED');await assert.rejects(api(db,apps[2].studentId).offers.respondToOffer(apps[2].id,'ACCEPT'),/unavailable/)});
 await t.test('accept versus revoke serializes to a coherent winner',async()=>{await decide(apps[3]);const results=await Promise.allSettled([api(db,apps[3].studentId).offers.respondToOffer(apps[3].id,'ACCEPT'),l.offers.revokeRecruitmentOffer(club.id,apps[3].id)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const o=await offer(apps[3]);assert.equal(!!await membership(apps[3]),o.status==='ACCEPTED');assert.ok(['ACCEPTED','REVOKED'].includes(o.status))});
 await t.test('already-member preserves owner permissions and all fields',async()=>{const m=await db.clubMember.create({data:{userId:apps[4].studentId,clubId:club.id,isOwner:true,accessRole:'OWNER',permissions:['members.manage'],role:'PRESIDENT'}});await decide(apps[4]);await api(db,apps[4].studentId).offers.respondToOffer(apps[4].id,'ACCEPT');assert.deepEqual(await membership(apps[4]),m)});
 await t.test('suspension, expired offers, inactive memberships and foreign clubs denied',async()=>{await decide(apps[5]);await db.club.update({where:{id:club.id},data:{suspendedAt:new Date()}});await assert.rejects(decide(apps[6]),/suspended/);await assert.rejects(api(db,apps[5].studentId).offers.respondToOffer(apps[5].id,'ACCEPT'),/suspended/);await db.club.update({where:{id:club.id},data:{suspendedAt:null}});await db.clubInvitation.update({where:{applicationId:apps[5].id},data:{expiresAt:new Date(0)}});await assert.rejects(api(db,apps[5].studentId).offers.respondToOffer(apps[5].id,'ACCEPT'),/expired/);await decide(apps[6]);await db.clubMember.create({data:{clubId:club.id,userId:apps[6].studentId,status:'SUSPENDED'}});assert.equal((await api(db,apps[6].studentId).offers.respondToOffer(apps[6].id,'ACCEPT')).status,'INACTIVE_MEMBERSHIP');await assert.rejects(l.crm.setApplicationStatus({clubId:randomUUID(),applicationId:apps[7].id,status:'ACCEPTED'}),/Denied/)});
 await t.test('interview status requires compatible round and leaving returns to review',async()=>{await assert.rejects(decide(apps[7],'INTERVIEWING'),/interview round/);await l.crm.moveApplicantRound({clubId:club.id,applicationId:apps[7].id,newRoundId:interview.id});await decide(apps[7],'INTERVIEWING');await l.crm.moveApplicantRound({clubId:club.id,applicationId:apps[7].id,newRoundId:round.id});assert.equal((await db.application.findUnique({where:{id:apps[7].id}})).status,'IN_REVIEW');await decide(apps[7],'WAITLISTED');assert.equal(await db.clubInvitation.count({where:{applicationId:apps[7].id}}),0);await decide(apps[7],'REJECTED');assert.equal(await db.clubInvitation.count({where:{applicationId:apps[7].id}}),0)});
 await t.test('newer offers never reactivate LEFT/SUSPENDED members or overwrite leadership fields',async()=>{
 for(const status of ['LEFT','SUSPENDED']){
 const u=await db.user.create({data:{email:`inactive-${randomUUID()}@demo.invalid`}}),a=await db.application.create({data:{clubId:club.id,studentId:u.id,roundId:round.id,status:'IN_REVIEW'}});
 const before=await db.clubMember.create({data:{clubId:club.id,userId:u.id,status,permissions:[],role:'RECRUITMENT_LEAD',updatedAt:new Date(0)}});await db.$queryRaw`SELECT 1 FROM pg_sleep(0.01)`;await decide(a);assert.ok((await offer(a)).createdAt>before.updatedAt,'offer must actually postdate inactive membership');
 for(let i=0;i<2;i++)assert.equal((await api(db,u.id).offers.respondToOffer(a.id,'ACCEPT')).status,'INACTIVE_MEMBERSHIP');
 assert.deepEqual(await membership(a),before);assert.equal((await offer(a)).status,'PENDING');assert.equal(await db.auditLog.count({where:{targetId:(await offer(a)).id,action:'offer.accepted'}}),0);
 }
 const activeUser=await db.user.create({data:{email:`active-leader-${randomUUID()}@demo.invalid`}}),activeApp=await db.application.create({data:{clubId:club.id,studentId:activeUser.id,roundId:round.id,status:'IN_REVIEW'}});const activeBefore=await db.clubMember.create({data:{clubId:club.id,userId:activeUser.id,accessRole:'ADMIN',role:'RECRUITMENT_LEAD',permissions:['applications.review']}});await decide(activeApp);await api(db,activeUser.id).offers.respondToOffer(activeApp.id,'ACCEPT');assert.deepEqual(await membership(activeApp),activeBefore);
 const m=await membership(apps[0]);for(const status of ['LEFT','SUSPENDED']){await db.clubMember.update({where:{id:m.id},data:{status}});assert.equal((await api(db,apps[0].studentId).offers.respondToOffer(apps[0].id,'ACCEPT')).status,'INACTIVE_MEMBERSHIP');assert.equal((await membership(apps[0])).status,status)}
 });
 await t.test('database constraints reject duplicate offers and elevated recruiting grants',async()=>{
 const o=await offer(apps[0]);const data={applicationId:o.applicationId,clubId:club.id,schoolId:o.schoolId,email:o.email,invitedBy:leader.id,purpose:'MEMBERSHIP',requestedRole:'MEMBER',permissions:[],expiresAt:new Date(Date.now()+86400000)};
 await assert.rejects(db.clubInvitation.create({data}),e=>e.code==='P2002');await assert.rejects(db.clubInvitation.update({where:{id:o.id},data:{permissions:['members.manage']}}));assert.deepEqual((await offer(apps[0])).permissions,[]);
 });
 await t.test('concurrent voting publication retries share the canonical offer path',async()=>{const selected=apps.slice(8,11);const id=await l.voting.createVotingSession({clubId:club.id,roundId:round.id,applicationIds:selected.map(a=>a.id),participantIds:[member.id],targetSize:1});let s=()=>db.votingSession.findUniqueOrThrow({where:{id}});const command=async(action,extra={})=>l.voting.commandVotingSession({clubId:club.id,sessionId:id,revision:(await s()).revision,action,...extra});await command('START_PASS');for(const [i,a]of selected.entries())await l.voting.submitVotingBallot({clubId:club.id,sessionId:id,passNumber:1,applicationId:a.id,decision:['PASS','HOLD','NOT_PASS'][i]});await command('COMPLETE_PASS');await command('FINISH');const input={clubId:club.id,sessionId:id,revision:(await s()).revision,action:'PUBLISH',applicationIds:selected.map(a=>a.id)};await Promise.all([l.voting.commandVotingSession(input),l.voting.commandVotingSession(input)]);await assert.rejects(l.voting.commandVotingSession({...input,applicationIds:[selected[0].id]}),/changed|sealed/i);assert.equal((await offer(selected[0])).status,'PENDING');assert.equal(await db.clubInvitation.count({where:{applicationId:{in:selected.slice(1).map(a=>a.id)}}}),0);assert.equal(await db.auditLog.count({where:{action:'offer.created',targetId:(await offer(selected[0])).id}}),1)});
 async function fresh() {
  const u=await db.user.create({data:{email:`hardening-${randomUUID()}@demo.invalid`}});
  return db.application.create({data:{clubId:club.id,studentId:u.id,roundId:round.id,status:'IN_REVIEW'}});
 }
 async function blocked(){const deadline=Date.now()+10000;while(Date.now()<deadline){const rows=await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%SELECT id FROM "Club"%'`;if(rows.length)return;await new Promise(r=>setTimeout(r,15))}throw Error('Expected actual club lock wait')}
 async function waitingRace(operation,mutation){
  let release,ready;const hold=new Promise(r=>release=r),locked=new Promise(r=>ready=r);
  const blocker=db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${club.id} FOR UPDATE`;ready();await hold;await mutation(tx)},{timeout:20000});await locked;
  const pending=operation();const settled=pending.then(value=>({value}),error=>({error}));
  try{await blocked()}finally{release()}await blocker;return settled;
 }
 await t.test('final accepted/rejected/waitlisted rounds archive with immutable evaluation history; active round remains protected',async()=>{
  for(const status of ['ACCEPTED','REJECTED','WAITLISTED']){
   const historical=await db.pipelineRound.create({data:{clubId:club.id,name:`Historical ${status}`,type:'CUSTOM',order:10}}),a=await fresh();
   await db.application.update({where:{id:a.id},data:{roundId:historical.id}});await decide(a,status);
   const evidence=await db.evaluation.create({data:{applicationId:a.id,interviewerId:member.id,roundId:historical.id,round:historical.name,score:8,submittedAt:new Date()}});
   const version=(await db.club.findUnique({where:{id:club.id}})).pipelineVersion;
   await l.settings.savePipelineSettings({clubId:club.id,version,rounds:[{id:round.id,name:round.name,type:round.type,configuration:{}},{id:interview.id,name:interview.name,type:interview.type,configuration:{}}]});
   assert.ok((await db.pipelineRound.findUnique({where:{id:historical.id}})).archivedAt);assert.deepEqual(await db.evaluation.findUnique({where:{id:evidence.id}}),evidence);
   const saved=await db.application.findUnique({where:{id:a.id}});assert.equal(saved.status,status);assert.equal(saved.roundId,historical.id);
  }
  await fresh(); // Ensure this retirement attempt has a genuinely active applicant.
  const version=(await db.club.findUnique({where:{id:club.id}})).pipelineVersion;
  await assert.rejects(l.settings.savePipelineSettings({clubId:club.id,version,rounds:[{id:interview.id,name:'First review',type:'APPLICATION_REVIEW',configuration:{}}]}),/Move active/);
  assert.equal((await db.club.findUnique({where:{id:club.id}})).pipelineVersion,version);
 });
 await t.test('voting publication rechecks disabled account, revoked capability and membership after actual lock wait',async()=>{
  for(const denial of ['disabled','capability','membership']){
   const a=await fresh(),sessionId=await l.voting.createVotingSession({clubId:club.id,roundId:round.id,applicationIds:[a.id],participantIds:[member.id],targetSize:1});
   const command=async(action)=>l.voting.commandVotingSession({clubId:club.id,sessionId,revision:(await db.votingSession.findUnique({where:{id:sessionId}})).revision,action,...(action==='PUBLISH'?{applicationIds:[a.id]}:{})});
   await command('START_PASS');await l.voting.submitVotingBallot({clubId:club.id,sessionId,passNumber:1,applicationId:a.id,decision:'PASS'});await command('COMPLETE_PASS');await command('FINISH');
   let authorized=false;const publisher=api(db,leader.id,()=>authorized=true),revision=(await db.votingSession.findUnique({where:{id:sessionId}})).revision;
   const result=await waitingRace(()=>publisher.voting.commandVotingSession({clubId:club.id,sessionId,revision,action:'PUBLISH',applicationIds:[a.id]}),async tx=>{
    assert.ok(authorized,'pre-transaction authorization completed');
    if(denial==='disabled')await tx.user.update({where:{id:leader.id},data:{disabledAt:new Date()}});
    else await tx.clubMember.update({where:{id:member.id},data:{isOwner:false,status:denial==='membership'?'LEFT':'ACTIVE',permissions:[]}});
   });
   assert.match(result.error?.message??'',/denied/i);assert.equal((await db.application.findUnique({where:{id:a.id}})).status,'IN_REVIEW');
   assert.equal(await db.clubInvitation.count({where:{applicationId:a.id}}),0);assert.equal((await db.votingSession.findUnique({where:{id:sessionId}})).publishedAt,null);
   assert.equal(await db.auditLog.count({where:{targetId:a.id,action:{in:['recruitment.decision.published','voting.decision.published','offer.created']}}}),0);
   await db.user.update({where:{id:leader.id},data:{disabledAt:null}});await db.clubMember.update({where:{id:member.id},data:{status:'ACTIVE',isOwner:true}});
  }
 });
 await t.test('accept racing decision reversal has coherent database state in either ordering',async()=>{
  for(const reversalFirst of [true,false]){
   const a=await fresh();await decide(a);const student=api(db,a.studentId);
   if(reversalFirst){const result=await waitingRace(()=>student.offers.respondToOffer(a.id,'ACCEPT'),tx=>requireDecision(tx,a,'REJECTED'));assert.ok(result.error);assert.equal(await membership(a),null);assert.equal((await offer(a)).status,'REVOKED')}
   else{const result=await waitingRace(()=>decide(a,'REJECTED'),tx=>apiHelper().respondToRecruitmentOffer(tx,a.id,a.studentId,'ACCEPT'));assert.ok(!result.error);assert.equal((await membership(a)).status,'ACTIVE');assert.equal((await offer(a)).status,'ACCEPTED')}
   assert.equal((await db.application.findUnique({where:{id:a.id}})).status,'REJECTED');
  }
 });
 // Use the production decision helper within the blocker transaction (no nested transaction).
 async function requireDecision(tx,a,status){const h=apiHelper();await h.publishRecruitmentDecision(tx,{clubId:club.id,applicationId:a.id,status},leader.id)}
 function apiHelper(){const cache={};function load(file){if(cache[file])return cache[file].exports;const m={exports:{}};cache[file]=m;new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n.startsWith('@/')?load(n.slice(2)+'.ts'):require(n),m,m.exports);return m.exports}return load('utils/recruitment-offers.ts')}
 await t.test('actual member removal and suspension winning the lock cannot be undone by acceptance',async()=>{
  for(const state of ['LEFT','SUSPENDED']){
   const a=await fresh();const m=await db.clubMember.create({data:{clubId:club.id,userId:a.studentId}});await decide(a);
   // Hold the same operational lock while the real removal action queues before acceptance.
   if(state==='LEFT'){
    let release,ready;const hold=new Promise(r=>release=r),locked=new Promise(r=>ready=r);
    const blocker=db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${club.id} FOR UPDATE`;ready();await hold},{timeout:20000});await locked;
    const remove=l.members.removeOrganizationMember({clubId:club.id,memberId:m.id});const removal=remove.then(()=>true);await blocked();
    const accept=api(db,a.studentId).offers.respondToOffer(a.id,'ACCEPT');const response=accept.then(v=>v,e=>({error:e}));release();await blocker;await removal;await response;
    assert.equal((await offer(a)).status,'REVOKED');
   }else{
    const result=await waitingRace(()=>api(db,a.studentId).offers.respondToOffer(a.id,'ACCEPT'),tx=>tx.clubMember.update({where:{id:m.id},data:{status:'SUSPENDED'}}));assert.equal(result.value.status,'INACTIVE_MEMBERSHIP');assert.equal((await offer(a)).status,'PENDING');
   }
   assert.equal((await membership(a)).status,state);assert.equal(await db.clubMember.count({where:{clubId:club.id,userId:a.studentId}}),1);
  }
  // Acceptance winning first still cannot undo a later real removal on retry.
  const a=await fresh();const active=await db.clubMember.create({data:{clubId:club.id,userId:a.studentId}});await decide(a);const result=await waitingRace(()=>l.members.removeOrganizationMember({clubId:club.id,memberId:active.id}),tx=>apiHelper().respondToRecruitmentOffer(tx,a.id,a.studentId,'ACCEPT'));assert.ok(!result.error);
  assert.equal((await api(db,a.studentId).offers.respondToOffer(a.id,'ACCEPT')).status,'INACTIVE_MEMBERSHIP');assert.equal((await membership(a)).status,'LEFT');
  const suspended=await fresh();const sm=await db.clubMember.create({data:{clubId:club.id,userId:suspended.studentId}});await decide(suspended);await waitingRace(()=>db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${club.id} FOR UPDATE`;await tx.clubMember.update({where:{id:sm.id},data:{status:'SUSPENDED'}})}),tx=>apiHelper().respondToRecruitmentOffer(tx,suspended.id,suspended.studentId,'ACCEPT'));assert.equal((await membership(suspended)).status,'SUSPENDED');assert.equal((await offer(suspended)).status,'ACCEPTED');assert.equal((await api(db,suspended.studentId).offers.respondToOffer(suspended.id,'ACCEPT')).status,'INACTIVE_MEMBERSHIP');
 });
 await t.test('all recruitment-capable legacy revocation entry points emit one correctly associated canonical audit',async()=>{
  const cases={
   'legacy invitation':(a,o,m)=>l.access.revokeClubInvitation(club.id,o.id),
   'legacy access':(a,o,m)=>l.access.updateClubAccess({clubId:club.id,memberId:m.id,permissions:[],isOwner:false}),
   'legacy removal':(a,o,m)=>l.access.removeClubMember(club.id,m.id),
   'organization invitation':(a,o,m)=>l.members.manageOrganizationInvitation({clubId:club.id,invitationId:o.id,action:'REVOKE'}),
   'bulk invitations':(a,o,m)=>l.members.bulkOrganizationInvitations({clubId:club.id,invitationIds:[o.id],action:'REVOKE'}),
   'organization role':(a,o,m)=>l.members.changeOrganizationMemberRole({clubId:club.id,memberId:m.id,role:'MEMBER'}),
   'organization removal':(a,o,m)=>l.members.removeOrganizationMember({clubId:club.id,memberId:m.id}),
   'ownership transfer':(a,o,m)=>l.members.transferOrganizationOwnership({clubId:club.id,memberId:m.id,confirm:true}),
   'bulk member role':(a,o,m)=>l.members.bulkOrganizationMembers({clubId:club.id,targets:[{id:m.id,updatedAt:m.updatedAt}],action:'ROLE',role:'MEMBER'}),
   'bulk member permissions':(a,o,m)=>l.members.bulkOrganizationMembers({clubId:club.id,targets:[{id:m.id,updatedAt:m.updatedAt}],action:'PERMISSIONS',permissions:[]}),
   'bulk members':(a,o,m)=>l.members.bulkOrganizationMembers({clubId:club.id,targets:[{id:m.id,updatedAt:m.updatedAt}],action:'REMOVE'}),
   'platform membership':(a,o,m)=>l.platform.changePlatformResource({kind:'membership',clubId:club.id,userId:a.studentId,isOwner:false,permissions:[]},'Synthetic hardening verification'),
   'recruitment rescind':(a,o,m)=>l.offers.revokeRecruitmentOffer(club.id,a.id),
   'decision reversal':(a,o,m)=>decide(a,'REJECTED'),
  };
  for(const [label,mutate]of Object.entries(cases)){
   const a=await fresh(),m=await db.clubMember.create({data:{clubId:club.id,userId:a.studentId}});await decide(a);const o=await offer(a);await mutate(a,o,m);
   const events=await db.auditLog.findMany({where:{targetId:o.id,action:'offer.revoked'}});assert.equal(events.length,1,label);assert.equal(events[0].actorId,leader.id);assert.equal(events[0].clubId,club.id);assert.equal(events[0].details.applicationId,a.id);assert.equal(events[0].details.studentId,a.studentId);assert.ok(events[0].reason);assert.equal((await offer(a)).status,'REVOKED');
   // Repeated legacy mutation may reject; it cannot produce another canonical event.
   await mutate(a,o,await db.clubMember.findUnique({where:{id:m.id}})).catch(()=>{});assert.equal(await db.auditLog.count({where:{targetId:o.id,action:'offer.revoked'}}),1,label);
   await db.clubMember.update({where:{id:member.id},data:{isOwner:true,accessRole:'OWNER'}});
  }
 });

  }finally{await db.$disconnect()}
 // Fixtures intentionally remain in this disposable database for inspection.
});
