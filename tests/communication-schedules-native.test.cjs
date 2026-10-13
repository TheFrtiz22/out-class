const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{AsyncLocalStorage}=require('node:async_hooks');
const {loader}=require('./helpers/communications-loader.cjs');
const url=process.env.OUTCLASS_AUDIENCE_TEST_DATABASE_URL;
test('scheduled publication on bounded native PostgreSQL',{skip:!url,timeout:120000},async t=>{
 const parsed=new URL(url);assert.equal(parsed.hostname,'127.0.0.1');assert.equal(parsed.port,'58453');assert.equal(parsed.pathname,'/outclass_audiences_test');
 const {PrismaClient}=require('@prisma/client'),op=new PrismaClient({datasourceUrl:url}),db=new PrismaClient({datasourceUrl:url.replace('fixture_superuser@','outclass_production_app@')});t.after(async()=>{await db.$disconnect();await op.$disconnect();});
 const sender=await db.user.create({data:{email:randomUUID()+'@demo.invalid'}}),recipient=await db.user.create({data:{email:randomUUID()+'@demo.invalid'}});
 const club=await db.club.create({data:{slug:randomUUID(),name:'Scheduled fixture',tagline:'',description:'',category:'Other',color:'#142d45'}});
 const membership=await db.clubMember.create({data:{clubId:club.id,userId:sender.id,isOwner:true}});await db.clubMember.create({data:{clubId:club.id,userId:recipient.id,isOwner:true}});
 let support=null,failAudit=false,crashAudit=false,actingUser=sender;
 const source={prisma:db};const load=loader({'@/utils/prisma':source,'@/utils/auth':{requireClubPermission:async id=>{assert.equal(id,club.id);return{user:actingUser};}},'@/utils/support-audit':{supportContext:async()=>support,supportTransactionScope:new AsyncLocalStorage()},'@/utils/admin-elevation':{requireAdminElevation:async()=>{throw Error('Unexpected elevation');}}});
 const actions=load('actions/communication-schedules.ts'),worker=load('utils/scheduled-communications.ts');
 // Inject a real transaction failure after notification writes, without replacing PostgreSQL.
 const actualTransaction=db.$transaction.bind(db);source.prisma=new Proxy(db,{get(target,key){if(key==='$transaction')return (fn,opts)=>actualTransaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='auditLog'&&(failAudit||crashAudit))return{create:async()=>{if(crashAudit){crashAudit=false;const[{pid}]=await t.$queryRaw`SELECT pg_backend_pid() pid`;await op.$queryRaw`SELECT pg_terminate_backend(${pid})`;}throw Error('Injected audit failure');}};return Reflect.get(t,k);}})),opts);return Reflect.get(target,key);}});
 const input=(extra={})=>({id:randomUUID(),clubId:club.id,revision:null,title:'Scheduled '+randomUUID(),body:'Immutable inbox intent',audience:{include:[{source:'MEMBERS'}]},recipientMode:'SEND_TIME',localTime:new Date(Date.now()+3600000).toISOString().slice(0,16),timeZone:'UTC',occurrence:'EARLIER',...extra});
 const due=async id=>op.scheduledCommunication.update({where:{id},data:{scheduledAt:new Date(Date.now()-1000)}});
 await t.test('bounded owner and restrictive browser denial including accidental grants',async()=>{
  const [state]=await op.$queryRaw`SELECT pg_get_userbyid(relowner) owner,relrowsecurity rls,relforcerowsecurity force FROM pg_class WHERE oid='public."ScheduledCommunication"'::regclass`;
  assert.deepEqual(state,{owner:'outclass_production_app',rls:true,force:false});
  for(const role of ['anon','authenticated']){const [p]=await op.$queryRawUnsafe(`SELECT has_table_privilege('${role}','public."ScheduledCommunication"','SELECT,INSERT,UPDATE,DELETE') allowed`);assert.equal(p.allowed,false);}
 });
 let first;
 await t.test('save retry freezes server snapshot and creates no early inbox/outbox',async()=>{
  first=input();const [a,b]=await Promise.all([actions.saveCommunicationSchedule(first),actions.saveCommunicationSchedule(first)]);assert.equal(a.id,b.id);assert.equal(a.revision,0);assert.ok(!('snapshot'in a));
  assert.equal(await db.clubAnnouncement.count({where:{clubId:club.id}}),0);assert.equal(await db.userNotification.count({where:{clubId:club.id}}),0);
  const rows=await actions.getCommunicationSchedules(club.id);assert.equal(rows.length,1);assert.ok(!('snapshot'in rows[0]));
 });
 await t.test('concurrent workers publish once with global email disabled and canonical outbox',async()=>{
  process.env.COMMUNICATIONS_EMAIL_ENABLED='false';await due(first.id);const outcomes=await Promise.all([worker.processScheduledCommunications(3),worker.processScheduledCommunications(3),worker.processScheduledCommunications(3)]);
  assert.equal(outcomes.reduce((n,o)=>n+o.published,0),1);const row=await db.scheduledCommunication.findUniqueOrThrow({where:{id:first.id}});assert.equal(row.status,'PUBLISHED');assert.equal(row.recipientCount,2);
  assert.equal(await db.clubAnnouncement.count({where:{clubId:club.id}}),1);assert.equal(await db.userNotification.count({where:{announcementId:row.publicationId}}),2);assert.equal(await db.notificationEmailOutbox.count({where:{notification:{announcementId:row.publicationId}}}),2);
  assert.equal((await worker.processScheduledCommunications()).published,0);assert.deepEqual((await actions.getCommunicationSchedules(club.id)).find(r=>r.id===first.id).email,{queued:2,sent:0,suppressed:0,attention:0});
 });
 await t.test('edit revisions, cancellation idempotency and stale commands',async()=>{
  const data=input();await actions.saveCommunicationSchedule(data);await actions.saveCommunicationSchedule({...data,revision:0,body:'Edited'});await assert.rejects(actions.saveCommunicationSchedule({...data,revision:0,body:'Stale'}),/changed/);
  await assert.rejects(actions.cancelCommunicationSchedule(club.id,data.id,0),/changed/);await actions.cancelCommunicationSchedule(club.id,data.id,1);await actions.cancelCommunicationSchedule(club.id,data.id,1);await due(data.id);assert.equal((await worker.processScheduledCommunications()).published,0);
  await assert.rejects(actions.cancelCommunicationSchedule(club.id,first.id,0),/published/);
 });
 await t.test('fixed and dynamic groups recheck disabled users and new membership',async()=>{
  const fixed=input({recipientMode:'FIXED'}),dynamic=input();await actions.saveCommunicationSchedule(fixed);await actions.saveCommunicationSchedule(dynamic);
  const extra=await db.user.create({data:{email:randomUUID()+'@demo.invalid'}});await db.clubMember.create({data:{clubId:club.id,userId:extra.id}});await db.user.update({where:{id:recipient.id},data:{disabledAt:new Date()}});
  await due(fixed.id);await due(dynamic.id);assert.equal((await worker.processScheduledCommunications()).published,2);
  assert.equal((await db.scheduledCommunication.findUniqueOrThrow({where:{id:fixed.id}})).recipientCount,1);assert.equal((await db.scheduledCommunication.findUniqueOrThrow({where:{id:dynamic.id}})).recipientCount,2);
  await db.user.update({where:{id:recipient.id},data:{disabledAt:null}});
 });
 await t.test('fixed custom group freezes selection while dynamic group uses current entries',async()=>{
  const group=await db.recipientGroup.create({data:{clubId:club.id,name:'Freeze selection',kind:'MANUAL',entries:{create:{userId:recipient.id}}}});
  const audience={include:[{source:'GROUP',groupId:group.id}]};const fixed=input({audience,recipientMode:'FIXED'}),dynamic=input({audience});await actions.saveCommunicationSchedule(fixed);await actions.saveCommunicationSchedule(dynamic);
  await db.recipientGroupEntry.deleteMany({where:{groupId:group.id}});await db.recipientGroupEntry.create({data:{groupId:group.id,clubId:club.id,userId:sender.id}});
  await due(fixed.id);await due(dynamic.id);assert.equal((await worker.processScheduledCommunications()).published,2);
  for(const [intent,expected]of[[fixed,recipient.id],[dynamic,sender.id]]){const row=await db.scheduledCommunication.findUniqueOrThrow({where:{id:intent.id}});const recipients=await db.userNotification.findMany({where:{announcementId:row.publicationId},select:{userId:true}});assert.deepEqual(recipients,[{userId:expected}]);}
 });
 await t.test('revoked sender fails closed without partial publication; explicit repair retry',async()=>{
  const data=input();await actions.saveCommunicationSchedule(data);await db.clubMember.update({where:{id:membership.id},data:{isOwner:false,permissions:[]}});await due(data.id);
  assert.equal((await worker.processScheduledCommunications()).failed,1);let row=await db.scheduledCommunication.findUniqueOrThrow({where:{id:data.id}});assert.equal(row.status,'FAILED');assert.equal(row.publicationId,null);assert.equal(row.failureCode,'PUBLICATION_UNAVAILABLE');
  await assert.rejects(actions.saveCommunicationSchedule({...data,revision:0}),/denied/);await db.clubMember.update({where:{id:membership.id},data:{isOwner:true}});await actions.saveCommunicationSchedule({...data,revision:row.revision});await due(data.id);assert.equal((await worker.processScheduledCommunications()).published,1);
 });
 await t.test('complete rollback after inbox/outbox writes and failure recovery',async()=>{
  const data=input();await actions.saveCommunicationSchedule(data);await due(data.id);const before=await db.userNotification.count({where:{clubId:club.id}});failAudit=true;
  assert.equal((await worker.processScheduledCommunications()).failed,1);failAudit=false;
  assert.equal(await db.clubAnnouncement.count({where:{clubId:club.id,requestKey:data.id}}),0);assert.equal(await db.userNotification.count({where:{clubId:club.id}}),before);assert.equal(await db.notificationEmailOutbox.count({where:{notification:{clubId:club.id}}}),before);
  await actions.saveCommunicationSchedule({...data,revision:(await db.scheduledCommunication.findUniqueOrThrow({where:{id:data.id}})).revision});await due(data.id);assert.equal((await worker.processScheduledCommunications()).published,1);
 });
 await t.test('terminated PostgreSQL transaction leaves no orphaned processing or partial inbox',async()=>{
  const data=input();await actions.saveCommunicationSchedule(data);await due(data.id);crashAudit=true;
  assert.equal((await worker.processScheduledCommunications()).failed,1);
  const row=await db.scheduledCommunication.findUniqueOrThrow({where:{id:data.id}});assert.equal(row.status,'FAILED');assert.equal(row.publicationId,null);assert.equal(await db.clubAnnouncement.count({where:{clubId:club.id,requestKey:data.id}}),0);
  await actions.saveCommunicationSchedule({...data,revision:row.revision});await due(data.id);assert.equal((await worker.processScheduledCommunications()).published,1);
 });
 await t.test('processing claim is observable, rejects edit/cancel, and expired crash lease is reclaimed once',async()=>{
  const data=input();await actions.saveCommunicationSchedule(data);await due(data.id);
  await db.scheduledCommunication.update({where:{id:data.id},data:{status:'PROCESSING',revision:{increment:1}}});
  assert.equal((await actions.getCommunicationSchedules(club.id)).find(r=>r.id===data.id).status,'PROCESSING');
  await assert.rejects(actions.cancelCommunicationSchedule(club.id,data.id,1),/published/);await assert.rejects(actions.saveCommunicationSchedule({...data,revision:1}),/published/);
  assert.equal((await worker.processScheduledCommunications()).published,0);
  await op.scheduledCommunication.update({where:{id:data.id},data:{updatedAt:new Date(Date.now()-180000)}});
  const outcomes=await Promise.all([worker.processScheduledCommunications(),worker.processScheduledCommunications()]);assert.equal(outcomes.reduce((n,r)=>n+r.published,0),1);
  assert.equal(await db.clubAnnouncement.count({where:{clubId:club.id,requestKey:data.id}}),1);
 });
 await t.test('simultaneous cancellation/publication has exactly one atomic winner',async()=>{
  const data=input();await actions.saveCommunicationSchedule(data);await due(data.id);
  await Promise.allSettled([worker.processScheduledCommunications(),actions.cancelCommunicationSchedule(club.id,data.id,0)]);
  const row=await db.scheduledCommunication.findUniqueOrThrow({where:{id:data.id}});assert.ok(['PUBLISHED','CANCELLED'].includes(row.status));assert.equal(await db.clubAnnouncement.count({where:{clubId:club.id,requestKey:data.id}}),row.status==='PUBLISHED'?1:0);
 });
 await t.test('disabled sender cannot execute a persisted schedule',async()=>{
  const data=input({recipientMode:'FIXED'});await actions.saveCommunicationSchedule(data);await db.user.update({where:{id:sender.id},data:{disabledAt:new Date()}});await due(data.id);assert.equal((await worker.processScheduledCommunications()).failed,1);await db.user.update({where:{id:sender.id},data:{disabledAt:null}});
 });
 await t.test('cancel winning race never publishes; due lock held by edit skips safely',async()=>{
  const data=input();await actions.saveCommunicationSchedule(data);await due(data.id);
  let release,entered;const gate=new Promise(r=>release=r),ready=new Promise(r=>entered=r);
  const blocking=db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${club.id} FOR UPDATE`;entered();await gate;},{timeout:10000});await ready;assert.equal((await worker.processScheduledCommunications()).skipped,1);release();await blocking;
  await actions.cancelCommunicationSchedule(club.id,data.id,0);assert.equal((await worker.processScheduledCommunications()).published,0);
 });
 await t.test('private group changes, preference separation and suspended club denial',async()=>{
  const group=await db.recipientGroup.create({data:{clubId:club.id,name:'Scheduled group',kind:'MANUAL',entries:{create:{userId:recipient.id}}}});
  const data=input({audience:{include:[{source:'GROUP',groupId:group.id}]}});await actions.saveCommunicationSchedule(data);
  await db.userNotificationPreference.upsert({where:{userId:recipient.id},create:{userId:recipient.id,emailAnnouncements:false,emailFrequency:'OFF'},update:{emailAnnouncements:false,emailFrequency:'OFF'}});
  await due(data.id);assert.equal((await worker.processScheduledCommunications()).published,1);const row=await db.scheduledCommunication.findUniqueOrThrow({where:{id:data.id}});assert.equal(row.recipientCount,1);assert.equal(await db.userNotification.count({where:{announcementId:row.publicationId}}),1);
  const blocked=input();await actions.saveCommunicationSchedule(blocked);await db.club.update({where:{id:club.id},data:{suspendedAt:new Date()}});await due(blocked.id);assert.equal((await worker.processScheduledCommunications()).failed,1);await db.club.update({where:{id:club.id},data:{suspendedAt:null}});
 });
 await t.test('cross-club references, untrusted snapshots and support authority are rejected',async()=>{
  await assert.rejects(actions.saveCommunicationSchedule(input({snapshot:{userIds:[recipient.id]}})));await assert.rejects(actions.saveCommunicationSchedule(input({audience:{include:[{source:'PEOPLE',userIds:[recipient.id]}]}})),/saved group/);
  await assert.rejects(actions.saveCommunicationSchedule(input({audience:{include:[{source:'GROUP',groupId:randomUUID()}]}})));
  const foreign=await db.club.create({data:{slug:randomUUID(),name:'Foreign scheduling',tagline:'',description:'',category:'Other',color:'#142d45'}});const foreignGroup=await db.recipientGroup.create({data:{clubId:foreign.id,name:'Private foreign group',kind:'MANUAL'}});
  await assert.rejects(actions.saveCommunicationSchedule(input({audience:{include:[{source:'GROUP',groupId:foreignGroup.id}]}})));
  support={id:randomUUID()};await assert.rejects(actions.saveCommunicationSchedule(input()),/Exit support/);support=null;
 });
 await t.test('another authorized manager may cancel but cannot rewrite the original sender intent',async()=>{
  const data=input();await actions.saveCommunicationSchedule(data);actingUser=recipient;
  try{await assert.rejects(actions.saveCommunicationSchedule({...data,revision:0,body:'Different author'}),/Only the sender/);await actions.cancelCommunicationSchedule(club.id,data.id,0);assert.equal((await db.scheduledCommunication.findUniqueOrThrow({where:{id:data.id}})).status,'CANCELLED');assert.equal((await db.auditLog.findFirstOrThrow({where:{targetId:data.id,action:'communication.schedule.cancel'}})).actorId,recipient.id);}finally{actingUser=sender;}
 });
 await t.test('populated browser CRUD denied even with permissive policies',async()=>{
  for(const role of ['anon','authenticated']){
   await op.$executeRawUnsafe(`GRANT ALL ON "ScheduledCommunication" TO ${role}`);await op.$executeRawUnsafe(`CREATE POLICY accidental_schedule_${role} ON "ScheduledCommunication" FOR ALL TO ${role} USING(true) WITH CHECK(true)`);
   await op.$transaction(async tx=>{await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);assert.equal((await tx.$queryRawUnsafe('SELECT * FROM "ScheduledCommunication"')).length,0);assert.equal((await tx.$queryRawUnsafe('UPDATE "ScheduledCommunication" SET title=title RETURNING id')).length,0);assert.equal((await tx.$queryRawUnsafe('DELETE FROM "ScheduledCommunication" RETURNING id')).length,0);});
   const original=await op.scheduledCommunication.findFirstOrThrow();
   await assert.rejects(op.$transaction(async tx=>{await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);await tx.$executeRaw`INSERT INTO "ScheduledCommunication"(id,"clubId","senderId","actorId",title,body,audience,snapshot,"recipientMode","scheduledAt","timeZone","localTime",occurrence,"requestKey","updatedAt") VALUES(${randomUUID()},${club.id},${sender.id},${sender.id},'Denied','Denied',${JSON.stringify(original.audience)}::jsonb,${JSON.stringify(original.snapshot)}::jsonb,'FIXED',NOW(),'UTC','2026-10-20T12:00','EARLIER',${randomUUID()},NOW())`;}),/row-level security/);
  }
 });
});
