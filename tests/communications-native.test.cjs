const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{api}=require('./helpers/communications-native.cjs');
const runtimeUrl=process.env.OUTCLASS_DECISION_RUNTIME_TEST_DATABASE_URL;
const databaseUrl=runtimeUrl??process.env.OUTCLASS_RECRUITMENT_TEST_DATABASE_URL;
test('native decision communications: atomic snapshots, ownership, history, retries and outbox',{skip:!databaseUrl,timeout:120000},async t=>{
 const url=new URL(databaseUrl);assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname===(runtimeUrl?'/outclass_reconcile_test':'/outclass_recruitment_test'));
 const {PrismaClient}=require('@prisma/client'),db=new PrismaClient({datasourceUrl:databaseUrl});t.after(()=>db.$disconnect());
 if(runtimeUrl){assert.equal(url.port,'56322');const [role]=await db.$queryRaw`SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;assert.deepEqual(role,{current_user:'outclass_production_app',rolsuper:false,rolbypassrls:false});}
 const leader=await db.user.create({data:{email:`communications-leader-${randomUUID()}@demo.invalid`}}),student=await db.user.create({data:{email:`communications-student-${randomUUID()}@demo.invalid`}}),foreign=await db.user.create({data:{email:`communications-foreign-${randomUUID()}@demo.invalid`}});
 const club=await db.club.create({data:{name:'Synthetic Communications Club',slug:randomUUID(),tagline:'',description:'',category:'Other',color:'#142d45'}}),round=await db.pipelineRound.create({data:{clubId:club.id,name:'Anonymous review',anonymousReview:true,order:0,type:'APPLICATION_REVIEW'}});
 const membership=await db.clubMember.create({data:{clubId:club.id,userId:leader.id,permissions:['decisions.manage','applicants.identify','recruitment.manage']}});
 const l=api(db,leader.id),s=api(db,student.id),f=api(db,foreign.id);const fresh=async(recipientId)=>{const id=recipientId??(await db.user.create({data:{email:`communications-extra-${randomUUID()}@demo.invalid`}})).id;return db.application.create({data:{clubId:club.id,studentId:id,roundId:round.id,status:'IN_REVIEW'}})};
 const a=await fresh(student.id);
 await t.test('simultaneous publication/retry produces one immutable snapshot, notification and queue entry',async()=>{
  const input={clubId:club.id,applicationId:a.id,status:'ACCEPTED'};await Promise.all([l.crm.setApplicationStatus(input),l.crm.setApplicationStatus(input)]);
  assert.equal(await db.decisionLetter.count({where:{applicationId:a.id}}),1);const letter=await db.decisionLetter.findFirstOrThrow({where:{applicationId:a.id}});
  assert.equal(await db.userNotification.count({where:{eventKey:`decision:${a.id}:1`}}),1);assert.equal(await db.notificationEmailOutbox.count({where:{notification:{eventKey:`decision:${a.id}:1`}}}),1);
  assert.equal((await db.application.findUniqueOrThrow({where:{id:a.id}})).decisionVersion,1);
  await assert.rejects(db.decisionLetter.update({where:{id:letter.id},data:{content:{body:'changed'}}}));await assert.rejects(db.decisionLetter.delete({where:{id:letter.id}}));
 });
 await t.test('canonical recipient inbox, concurrent read, unread, archive and restore',async()=>{
  assert.equal(await f.communications.getDecisionLetter(a.id),null);assert.ok(await s.communications.getDecisionLetter(a.id));const [n]=(await s.communications.getDurableNotifications()).items;
  assert.ok(!JSON.stringify(n).includes('answers'));assert.equal((await f.communications.setDurableNotificationsRead([n.id],true)).updated,0);
  await Promise.all([s.communications.setDurableNotificationsRead([n.id],true),s.communications.setDurableNotificationsRead([n.id],true)]);assert.ok((await s.communications.getDurableNotifications()).items[0].readAt);
  await s.communications.setDurableNotificationsRead([n.id],false);assert.equal((await s.communications.getDurableNotifications()).items[0].readAt,null);
  await s.communications.setDurableNotificationsArchived([n.id],true);assert.equal((await s.communications.getDurableNotifications()).items.length,0);await s.communications.setDurableNotificationsArchived([n.id],false);assert.equal((await s.communications.getDurableNotifications()).items.length,1);
 });
 await t.test('templates do not expose anonymous identity; published copy stays stable after edits and correction',async()=>{
  const before=await s.communications.getDecisionLetter(a.id);assert.deepEqual(Object.keys(await l.communications.getDecisionTemplates(club.id)).sort(),['color','decisionLetterTemplates','logoUrl','name','templates']);
  await l.communications.saveDecisionTemplates(club.id,{ACCEPTED:{title:'Welcome {{student.firstName}}',body:'A new letter',closing:'Sincerely,',signer:'{{club.name}}',footer:''}});assert.deepEqual((await s.communications.getDecisionLetter(a.id)).letter,before.letter);
  await l.crm.setApplicationStatus({clubId:club.id,applicationId:a.id,status:'WAITLISTED'});const corrected=await s.communications.getDecisionLetter(a.id);assert.equal(corrected.letter.decision,'WAITLISTED');assert.equal(corrected.offer.status,'REVOKED');
  const old=await s.communications.getDecisionLetter(a.id,before.letter.id);assert.equal(old.isCurrent,false);assert.deepEqual(old.letter,before.letter);
  await l.crm.setApplicationStatus({clubId:club.id,applicationId:a.id,status:'REJECTED'});assert.equal((await s.communications.getDecisionLetter(a.id)).letter.decision,'REJECTED');assert.equal(await db.decisionLetter.count({where:{applicationId:a.id}}),3);
 });
 await t.test('unauthorized/cross-club/disabled and revoked template writers fail closed',async()=>{
  await assert.rejects(s.communications.saveDecisionTemplates(club.id,{}),/Denied/);await assert.rejects(l.communications.saveDecisionTemplates(randomUUID(),{}),/Denied/);
  await db.user.update({where:{id:leader.id},data:{disabledAt:new Date()}});await assert.rejects(l.communications.saveDecisionTemplates(club.id,{}),/Denied/);await db.user.update({where:{id:leader.id},data:{disabledAt:null}});
  await db.clubMember.update({where:{id:membership.id},data:{permissions:['decisions.manage','applicants.identify']}});await assert.rejects(l.communications.saveDecisionTemplates(club.id,{}),/Denied/);await db.clubMember.update({where:{id:membership.id},data:{permissions:['decisions.manage','applicants.identify','recruitment.manage']}});
 });

 await t.test('notification failure rolls back decision, offer, snapshot and audit atomically',async()=>{
  const target=await fresh();
  const proxy=new Proxy(db,{get(object,key){if(key==='$transaction')return callback=>db.$transaction(tx=>callback(new Proxy(tx,{get(transaction,field){if(field==='userNotification')return {create:async()=>{throw Error('Synthetic notification failure')}};return transaction[field]}})));const value=object[key];return typeof value==='function'?value.bind(object):value;}});
  await assert.rejects(api(proxy,leader.id).crm.setApplicationStatus({clubId:club.id,applicationId:target.id,status:'ACCEPTED'}),/Synthetic/);
  assert.equal((await db.application.findUniqueOrThrow({where:{id:target.id}})).status,'IN_REVIEW');assert.equal(await db.decisionLetter.count({where:{applicationId:target.id}}),0);assert.equal(await db.clubInvitation.count({where:{applicationId:target.id}}),0);
 });
 await t.test('publication vs template edit serializes one coherent immutable template snapshot',async()=>{
  const target=await fresh(),copy={title:'A complete custom letter',body:'One coherent template body.',closing:'Sincerely,',signer:'Synthetic Club',footer:'Custom footer'};
  const previous=(await l.communications.getDecisionTemplates(club.id)).templates.ACCEPTED;
  await Promise.all([l.crm.setApplicationStatus({clubId:club.id,applicationId:target.id,status:'ACCEPTED'}),l.communications.saveDecisionTemplates(club.id,{ACCEPTED:copy})]);
  const {content}=await db.decisionLetter.findFirstOrThrow({where:{applicationId:target.id}});assert.ok(content.body===previous.body||content.body===copy.body);if(content.body===copy.body){assert.equal(content.title,copy.title);assert.equal(content.footer,copy.footer);}
 });
 await t.test('template mutation reauthorizes a revoked capability after waiting on Club lock',async()=>{
  let pending;
  await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${club.id} FOR UPDATE`;const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
   pending=l.communications.saveDecisionTemplates(club.id,{}).then(()=>({ok:true}),()=>({ok:false}));
   const deadline=Date.now()+8000;while(true){const [{count}]=await db.$queryRaw`SELECT count(*)::int AS count FROM pg_stat_activity WHERE ${pid}=ANY(pg_blocking_pids(pid))`;if(count)break;if(Date.now()>deadline)throw Error('Expected actual template lock wait');await new Promise(r=>setTimeout(r,20));}
   await tx.clubMember.update({where:{id:membership.id},data:{permissions:['decisions.manage','applicants.identify']}});
  },{timeout:15000});assert.equal((await pending).ok,false);await db.clubMember.update({where:{id:membership.id},data:{permissions:['decisions.manage','applicants.identify','recruitment.manage']}});
 });

});
