const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {AsyncLocalStorage}=require('node:async_hooks');
const {loader}=require('./helpers/communications-loader.cjs');
const url=process.env.OUTCLASS_AUDIENCE_TEST_DATABASE_URL;
test('recipient audiences on bounded native PostgreSQL',{skip:!url,timeout:120000},async t=>{
 const u=new URL(url);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'58453');assert.equal(u.pathname,'/outclass_audiences_test');assert.equal(u.username,'fixture_superuser');
 const {PrismaClient}=require('@prisma/client'),operator=new PrismaClient({datasourceUrl:url}),db=new PrismaClient({datasourceUrl:url.replace('fixture_superuser@','outclass_production_app@')});t.after(async()=>{await db.$disconnect();await operator.$disconnect();});
 const actor=await db.user.create({data:{email:randomUUID()+'@demo.invalid'}});
 const club=await db.club.create({data:{slug:randomUUID(),name:'Audiences',tagline:'',description:'',color:'#142d45',category:'Other'}}),foreign=await db.club.create({data:{slug:randomUUID(),name:'Foreign',tagline:'',description:'',color:'#142d45',category:'Other'}});
 const owner=await db.clubMember.create({data:{clubId:club.id,userId:actor.id,isOwner:true}});
 let revoke=false,demo=false;
 const mocks={'@/utils/prisma':{prisma:db},'@/utils/auth':{requireClubPermission:async(id,caps)=>{if(demo)throw Error('Live data unavailable in Demo');const membership=await db.clubMember.findUnique({where:{userId_clubId:{clubId:id,userId:actor.id}}});if(!membership||membership.status!=='ACTIVE'||!caps.every(p=>membership.isOwner||membership.permissions.includes(p)))throw Error('Denied');if(revoke){await operator.clubMember.update({where:{id:owner.id},data:{isOwner:false,permissions:[]}});revoke=false;}return{user:actor,membership};}},'@/utils/support-audit':{supportContext:async()=>null,supportTransactionScope:new AsyncLocalStorage()},'@/utils/admin-elevation':{requireAdminElevation:async()=>{throw Error('Unexpected support');}}};const load=loader(mocks);
 const groups=load('actions/recipient-groups.ts'),communications=load('actions/communications.ts'),resolver=load('utils/recipient-audience.ts');
 async function person(year){const user=await db.user.create({data:{email:randomUUID()+'@demo.invalid'}});if(year)await db.studentProfile.create({data:{userId:user.id,firstName:'Synthetic',lastName:'Recipient',computingId:randomUUID(),major:'Undeclared',gradYear:year}});return user;}
 const member=await person(2027),officer=await person(2028),left=await person(),applicant=await person(2027),rejected=await person(2028),anonymous=await person(2027),lead=await person(2027),outsider=await person(2027);
 const membership=await db.clubMember.create({data:{userId:member.id,clubId:club.id,cohort:'Fall 2026',groups:['Finance'],accessRole:'MEMBER'}});
 await db.clubMember.create({data:{userId:officer.id,clubId:club.id,isOwner:true,interviewOffices:['BOARD'],accessRole:'ADMIN'}});await db.clubMember.create({data:{userId:left.id,clubId:club.id,status:'LEFT'}});
 await db.clubMember.create({data:{userId:outsider.id,clubId:foreign.id,isOwner:true}});
 const round=await db.pipelineRound.create({data:{clubId:club.id,name:'Review',order:0}}),anonRound=await db.pipelineRound.create({data:{clubId:club.id,name:'Anonymous',anonymousReview:true,order:1}});
 const a=await db.application.create({data:{clubId:club.id,studentId:applicant.id,roundId:round.id,status:'INTERVIEWING',submittedAt:new Date()}});
 await db.application.create({data:{clubId:club.id,studentId:rejected.id,roundId:round.id,status:'REJECTED',submittedAt:new Date()}});await db.application.create({data:{clubId:club.id,studentId:anonymous.id,roundId:anonRound.id,status:'IN_REVIEW',submittedAt:new Date()}});
 const event=await db.meeting.create({data:{clubId:club.id,title:'Recorded engagement',date:new Date(Date.now()+86400000),location:'Fixture',publication:{create:{status:'PUBLISHED',approvedRevision:0,reviewedBy:actor.id,reviewedAt:new Date(),publishedAt:new Date()}}}}),foreignEvent=await db.meeting.create({data:{clubId:foreign.id,title:'Foreign',date:new Date(),location:'Fixture'}});
 for(const userId of [lead.id,member.id,applicant.id,anonymous.id])await db.eventRsvp.create({data:{eventId:event.id,userId}});
 await db.eventAttendance.create({data:{eventId:event.id,studentId:lead.id}});
 const preview=(include,exclude=[])=>groups.previewRecipientAudience(club.id,{include,exclude});
 const ids=p=>p.recipients.map(r=>r.id).sort();
 let manual,ruleGroup;
 await t.test('bounded ownership, restrictive policies and browser-role denial',async()=>{
  const [role]=await db.$queryRaw`SELECT current_user,rolsuper,rolbypassrls,has_schema_privilege(current_user,'public','CREATE') AS creates FROM pg_roles WHERE rolname=current_user`;
  assert.deepEqual(role,{current_user:'outclass_production_app',rolsuper:false,rolbypassrls:false,creates:false});
  for(const table of ['RecipientGroup','RecipientGroupEntry']){
   const [state]=await operator.$queryRawUnsafe(`SELECT pg_get_userbyid(relowner) owner,relrowsecurity rls FROM pg_class WHERE oid='public."${table}"'::regclass`);assert.deepEqual(state,{owner:'outclass_production_app',rls:true});
   for(const role of ['anon','authenticated']){const [p]=await operator.$queryRawUnsafe(`SELECT has_table_privilege('${role}','public."${table}"','SELECT,INSERT,UPDATE,DELETE') allowed`);assert.equal(p.allowed,false);}
  }
  await operator.$transaction(async tx=>{await tx.$executeRawUnsafe('GRANT SELECT ON "RecipientGroup" TO authenticated');await tx.$executeRawUnsafe('CREATE POLICY accidental_group_read ON "RecipientGroup" FOR SELECT TO authenticated USING(true)');await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');assert.equal((await tx.$queryRawUnsafe('SELECT * FROM "RecipientGroup"')).length,0);});
 });
 await t.test('members, officers, access roles, graduation year, cohort, labels and joined date use records',async()=>{
  assert.deepEqual(ids(await preview([{source:'MEMBERS'}])),[actor.id,member.id,officer.id].sort());
  assert.deepEqual(ids(await preview([{source:'OFFICERS',gradYears:[2028]}])),[officer.id]);
  assert.deepEqual(ids(await preview([{source:'MEMBERS',accessRoles:['MEMBER'],cohorts:['Fall 2026'],labels:['Finance'],gradYears:[2027],joinedAfter:'2020-01-01T00:00:00Z'}])),[member.id]);
  assert.equal((await preview([{source:'MEMBERS',cohorts:['Imagined cohort']}])).count,0);
 });
 await t.test('active applicant and rejected audiences remain distinct and anonymous identities stay hidden',async()=>{
  assert.deepEqual(ids(await preview([{source:'APPLICANTS'}])),[applicant.id]);assert.deepEqual(ids(await preview([{source:'REJECTED'}])),[rejected.id]);
  assert.equal((await preview([{source:'REJECTED',interview:'INTERVIEWING'}])).count,0);
  await db.clubMember.update({where:{id:owner.id},data:{isOwner:false,permissions:['meetings.manage','members.manage']}});
  await assert.rejects(preview([{source:'APPLICANTS'}]),/Identified applicant/);assert.equal((await preview([{source:'MEMBERS'}])).count,3);
  await db.clubMember.update({where:{id:owner.id},data:{isOwner:true}});
 });
 await t.test('booking, completed interview and effective offer expiry filters',async()=>{
  assert.equal((await preview([{source:'APPLICANTS',interview:'UNBOOKED'}])).count,1);
  const slot=await db.interviewSlot.create({data:{clubId:club.id,startTime:new Date(),endTime:new Date(Date.now()+3600000),location:'Fixture'}});
  await db.interviewBooking.create({data:{slotId:slot.id,applicationId:a.id,roundId:round.id}});
  assert.equal((await preview([{source:'APPLICANTS',roundIds:[round.id],interview:'BOOKED'}])).count,1);
  const evaluation=await db.evaluation.create({data:{applicationId:a.id,interviewerId:owner.id,round:'Review',roundId:round.id,score:8,submittedAt:new Date()}});
  await db.interviewRecord.create({data:{evaluationId:evaluation.id,applicationId:a.id,roundId:round.id,interviewerId:owner.id,questions:[],draft:{},anonymousReview:false,completedAt:new Date()}});
  assert.equal((await preview([{source:'APPLICANTS',interview:'COMPLETED'}])).count,1);
  assert.equal((await preview([{source:'APPLICANTS',offerStatuses:['NONE']}])).count,1);
  await db.application.update({where:{id:a.id},data:{status:'ACCEPTED'}});
  await db.clubInvitation.create({data:{clubId:club.id,applicationId:a.id,email:applicant.email,invitedBy:actor.id,purpose:'MEMBERSHIP',createdAt:new Date(Date.now()-60000),expiresAt:new Date(Date.now()-1000)}});
  assert.equal((await preview([{source:'APPLICANTS',offerStatuses:['EXPIRED']}])).count,1);assert.equal((await preview([{source:'APPLICANTS',offerStatuses:['PENDING']}])).count,0);
 });
 await t.test('event leads are recorded engagement, not private saves or anonymous applicants',async()=>{
  assert.deepEqual(ids(await preview([{source:'LEADS',eventIds:[event.id]}])),[lead.id]);
  assert.deepEqual(ids(await preview([{source:'EVENT',eventIds:[event.id],participation:'ATTENDED'}])),[lead.id]);
  await assert.rejects(preview([{source:'EVENT',eventIds:[foreignEvent.id]}]),/Event unavailable/);
  await assert.rejects(preview([{source:'APPLICANTS',roundIds:[randomUUID()]}]),/Round unavailable/);
 });
 await t.test('manual group creation, retry, rule group, include/exclude and deduplication',async()=>{
  const input={clubId:club.id,id:randomUUID(),revision:null,name:'Finance',kind:'MANUAL',userIds:[member.id,lead.id,member.id]};
  const result=await Promise.all([groups.saveRecipientGroup(input),groups.saveRecipientGroup(input)]);manual=result[0];assert.equal(result[1].id,manual.id);assert.equal(manual.revision,0);
  ruleGroup=await groups.saveRecipientGroup({clubId:club.id,id:randomUUID(),revision:null,name:'Consulting',kind:'RULES',rules:{include:[{source:'GROUP',groupId:manual.id},{source:'MEMBERS'}],exclude:[{source:'OFFICERS'}]}});
  assert.deepEqual(ids(await preview([{source:'GROUP',groupId:ruleGroup.id}])),[lead.id,member.id].sort());
  assert.equal((await groups.getRecipientGroups(club.id)).groups.length,2);
 });
 await t.test('populated browser-role CRUD and cross-club composite keys remain denied',async()=>{
  for(const role of ['anon','authenticated']){
   await operator.$executeRawUnsafe(`GRANT ALL ON "RecipientGroup","RecipientGroupEntry" TO ${role}`);
   await operator.$executeRawUnsafe(`CREATE POLICY permissive_${role} ON "RecipientGroup" FOR ALL TO ${role} USING(true) WITH CHECK(true)`);
   await operator.$executeRawUnsafe(`CREATE POLICY permissive_${role} ON "RecipientGroupEntry" FOR ALL TO ${role} USING(true) WITH CHECK(true)`);
   for(const table of ['RecipientGroup','RecipientGroupEntry']){
    await operator.$transaction(async tx=>{await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);assert.equal((await tx.$queryRawUnsafe(`SELECT * FROM "${table}"`)).length,0);assert.equal((await tx.$queryRawUnsafe(`DELETE FROM "${table}" RETURNING *`)).length,0);const column=table==='RecipientGroup'?'name':'userId';assert.equal((await tx.$queryRawUnsafe(`UPDATE "${table}" SET "${column}"="${column}" RETURNING *`)).length,0);});
   }
   await assert.rejects(operator.$transaction(async tx=>{await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);await tx.$executeRawUnsafe(`INSERT INTO "RecipientGroup"(id,"clubId",name,kind,"updatedAt") VALUES('${randomUUID()}','${club.id}','Forbidden','MANUAL',NOW())`);}),/row-level security/);
   await assert.rejects(operator.$transaction(async tx=>{await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);await tx.$executeRawUnsafe(`INSERT INTO "RecipientGroupEntry"("groupId","clubId","userId") VALUES('${manual.id}','${club.id}','${officer.id}')`);}),/row-level security/);
  }
  await assert.rejects(db.recipientGroupEntry.create({data:{groupId:manual.id,clubId:foreign.id,userId:outsider.id}}),/Foreign key/);
 });
 await t.test('fixed versus send-time evaluation, membership changes and disabled recipients',async()=>{
  const snapshot=await db.$transaction(tx=>resolver.captureRecipientAudience(tx,club.id,actor.id,{include:[{source:'MEMBERS'}]}));
  const extra=await person();await db.clubMember.create({data:{clubId:club.id,userId:extra.id}});await db.clubMember.update({where:{id:membership.id},data:{status:'LEFT'}});
  const fixed=await db.$transaction(tx=>resolver.evaluateRecipientSnapshot(tx,club.id,actor.id,snapshot,'FIXED')),dynamic=await db.$transaction(tx=>resolver.evaluateRecipientSnapshot(tx,club.id,actor.id,snapshot,'SEND_TIME'));
  assert.ok(!fixed.includes(extra.id)&&dynamic.includes(extra.id));assert.ok(!fixed.includes(member.id)&&!dynamic.includes(member.id));
  await db.user.update({where:{id:extra.id},data:{disabledAt:new Date()}});assert.ok(!ids(await preview([{source:'MEMBERS'}])).includes(extra.id));
  await db.clubMember.update({where:{id:membership.id},data:{status:'ACTIVE'}});
  await assert.rejects(db.$transaction(tx=>resolver.evaluateRecipientSnapshot(tx,foreign.id,actor.id,snapshot,'FIXED')),/another club/);
 });
 await t.test('manual edits, stale revisions, dependency deletion and cycle rollback',async()=>{
  manual=await groups.saveRecipientGroup({clubId:club.id,id:manual.id,revision:0,name:'Finance',kind:'MANUAL',userIds:[member.id]});assert.equal(manual.revision,1);
  await assert.rejects(groups.saveRecipientGroup({clubId:club.id,id:manual.id,revision:0,name:'Stale',kind:'MANUAL',userIds:[]}),/Group changed/);
  await assert.rejects(groups.deleteRecipientGroup(club.id,manual.id,manual.revision),/other saved rules/);
  await assert.rejects(groups.saveRecipientGroup({clubId:club.id,id:manual.id,revision:1,name:'Cycle',kind:'RULES',rules:{include:[{source:'GROUP',groupId:ruleGroup.id}]}}),/cycle/);
  assert.equal((await db.recipientGroup.findUniqueOrThrow({where:{id:manual.id}})).kind,'MANUAL');
 });
 await t.test('foreign, anonymous and disabled people cannot be assigned; denied operations roll back',async()=>{
  for(const userIds of [[outsider.id],[anonymous.id]])await assert.rejects(groups.saveRecipientGroup({clubId:club.id,id:randomUUID(),revision:null,name:'Invalid',kind:'MANUAL',userIds}),/unavailable/);
  await assert.rejects(groups.previewRecipientAudience(foreign.id,{include:[{source:'MEMBERS'}]}),/Denied/);
  await assert.rejects(preview([{source:'GROUP',groupId:randomUUID()}]),/unavailable/);
  await assert.rejects(groups.saveRecipientGroup({clubId:foreign.id,id:manual.id,revision:manual.revision,name:'Foreign overwrite',kind:'MANUAL',userIds:[]}),/Denied/);
 });
 await t.test('revocation after request authentication, suspension and Demo deny all writes/reads',async()=>{
  revoke=true;await assert.rejects(groups.saveRecipientGroup({clubId:club.id,id:randomUUID(),revision:null,name:'Revoked',kind:'MANUAL',userIds:[]}),/access denied/);await db.clubMember.update({where:{id:owner.id},data:{isOwner:true}});
  await db.club.update({where:{id:club.id},data:{suspendedAt:new Date()}});await assert.rejects(preview([{source:'MEMBERS'}]),/suspended/);await db.club.update({where:{id:club.id},data:{suspendedAt:null}});
  demo=true;await assert.rejects(groups.getRecipientGroups(club.id),/Demo/);await assert.rejects(groups.saveRecipientGroup({clubId:club.id,id:randomUUID(),revision:null,name:'Demo',kind:'MANUAL',userIds:[]}),/Demo/);demo=false;
 });
 await t.test('canonical publication snapshots and retries deduplicate notification/outbox independently of preferences',async()=>{
  await db.userNotificationPreference.create({data:{userId:member.id,emailAnnouncements:false,emailFrequency:'OFF'}});
  const spec={include:[{source:'GROUP',groupId:manual.id},{source:'MEMBERS'}],exclude:[{source:'OFFICERS'}]};
  const data={clubId:club.id,title:'Synthetic audience',body:'No external delivery',audience:'CUSTOM',audienceSpec:spec,requestKey:randomUUID()};
  const [x,y]=await Promise.all([communications.publishClubAnnouncement(data),communications.publishClubAnnouncement(data)]);assert.equal(x.id,y.id);assert.equal(x.recipientCount,1);
  assert.equal(await db.userNotification.count({where:{announcementId:x.id}}),1);assert.equal(await db.notificationEmailOutbox.count({where:{notification:{announcementId:x.id}}}),1);
  await assert.rejects(communications.publishClubAnnouncement({...data,audienceSpec:{include:[{source:'REJECTED'}]}}),/already used/);
  await db.clubMember.update({where:{id:membership.id},data:{status:'LEFT'}});assert.equal((await communications.publishClubAnnouncement(data)).recipientCount,1);await db.clubMember.update({where:{id:membership.id},data:{status:'ACTIVE'}});
 });
 await t.test('failed atomic group audit rolls back edits and recipient assignment',async()=>{
  const failing=db.$extends({query:{auditLog:{create:async()=>{throw Error('Injected group audit failure');}}}});
  const broken=loader({...mocks,'@/utils/prisma':{prisma:failing}})('actions/recipient-groups.ts');
  await assert.rejects(broken.saveRecipientGroup({clubId:club.id,id:manual.id,revision:manual.revision,name:'Must roll back',kind:'MANUAL',userIds:[lead.id]}),/Injected group audit/);
  const row=await db.recipientGroup.findUniqueOrThrow({where:{id:manual.id}});assert.equal(row.name,'Finance');assert.equal(row.revision,manual.revision);
  assert.deepEqual((await db.recipientGroupEntry.findMany({where:{groupId:manual.id}})).map(e=>e.userId),[member.id]);
 });
 await t.test('saved manual applicant groups do not expose identities after review becomes anonymous',async()=>{
  const privateGroup=await groups.saveRecipientGroup({clubId:club.id,id:randomUUID(),revision:null,name:'Applicant selection',kind:'MANUAL',userIds:[applicant.id]});
  await db.pipelineRound.update({where:{id:round.id},data:{anonymousReview:true}});
  try{assert.equal((await preview([{source:'GROUP',groupId:privateGroup.id}])).count,0);const metadata=await groups.getRecipientGroups(club.id);assert.ok(!JSON.stringify(metadata.groups).includes(applicant.id));}
  finally{await db.pipelineRound.update({where:{id:round.id},data:{anonymousReview:false}});}
  await groups.deleteRecipientGroup(club.id,privateGroup.id,privateGroup.revision);
 });
 await t.test('delete groups preserves student accounts and immutable publication recipients',async()=>{
  const before=await db.user.count(),notices=await db.userNotification.count();
  await groups.deleteRecipientGroup(club.id,ruleGroup.id,ruleGroup.revision);await groups.deleteRecipientGroup(club.id,manual.id,manual.revision);
  assert.equal(await db.recipientGroupEntry.count(),0);assert.equal(await db.user.count(),before);assert.equal(await db.userNotification.count(),notices);
 });
});
