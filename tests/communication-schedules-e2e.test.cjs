const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{randomUUID}=require('node:crypto');
const {Actor}=require('./helpers/onboarding-e2e.cjs');
const filename=process.env.OUTCLASS_SCHEDULING_E2E_CONFIG;
test('scheduling through local Auth, production actions and authenticated cron',{skip:!filename,timeout:120000},async t=>{
 const c=JSON.parse(fs.readFileSync(filename));assert.equal(c.projectId,'outclass-admin-session-e2e');for(const[value,port]of[[c.status.API_URL,'60321'],[c.status.DB_URL,'60322']]){const u=new URL(value);assert.ok(['127.0.0.1','localhost'].includes(u.hostname));assert.equal(u.port,port);}
 c.appUrl='http://127.0.0.1:3109';c.buildDir=path.resolve('.next-publish');
 const {PrismaClient}=require('@prisma/client'),db=new PrismaClient({datasourceUrl:c.status.DB_URL});t.after(()=>db.$disconnect());
 const actor=new Actor(c),member=new Actor(c);await actor.signIn(c.identities.leader.email,c.identities.leader.password);await member.signIn(c.identities.student.email,c.identities.student.password);
 const club=await db.club.create({data:{slug:randomUUID(),name:'Scheduling browser QA',tagline:'Isolated local fixture',description:'Local scheduling verification only',category:'Other',color:'#142d45'}});await db.clubMember.create({data:{clubId:club.id,userId:c.identities.leader.id,isOwner:true}});await db.clubMember.create({data:{clubId:club.id,userId:c.identities.student.id}});
 const action=(name,...args)=>actor.action('actions/communication-schedules.ts',name,args);
 const input=()=>({id:randomUUID(),clubId:club.id,revision:null,title:'Controlled scheduled announcement',body:'Local only. No outbound provider.',audience:{include:[{source:'MEMBERS'}]},recipientMode:'SEND_TIME',localTime:new Date(Date.now()+86400000).toISOString().slice(0,16),timeZone:'UTC',occurrence:'EARLIER'});
 let data=input();
 await t.test('schedule/preview/retry are authenticated and do not publish early',async()=>{
  const a=await action('saveCommunicationSchedule',data),b=await action('saveCommunicationSchedule',data);assert.equal(a.id,b.id);assert.ok(!('snapshot'in a));assert.equal((await action('getCommunicationSchedules',club.id)).length,1);assert.equal(await db.userNotification.count({where:{clubId:club.id}}),0);
  const preview=await actor.action('actions/recipient-groups.ts','previewRecipientAudience',[club.id,data.audience]);assert.equal(preview.count,2);
 });
 await t.test('member/Demo/foreign access and unauthenticated cron fail closed',async()=>{
  await assert.rejects(member.action('actions/communication-schedules.ts','getCommunicationSchedules',[club.id]));await assert.rejects(action('getCommunicationSchedules',randomUUID()));const demo=new Actor(c);demo.cookies=new Map(actor.cookies);demo.cookies.set('outclass-demo-session','1');await assert.rejects(demo.action('actions/communication-schedules.ts','getCommunicationSchedules',[club.id]));
  assert.equal((await fetch(c.appUrl+'/api/internal/scheduled-communications')).status,401);
 });
 await t.test('authenticated cron publishes due inbox once with email disabled',async()=>{
  await db.scheduledCommunication.update({where:{id:data.id},data:{scheduledAt:new Date(Date.now()-1000)}});
  const response=await fetch(c.appUrl+'/api/internal/scheduled-communications',{headers:{authorization:'Bearer local-scheduling-fixture'}});assert.equal(response.status,200);assert.equal((await response.json()).published,1);
  const row=await db.scheduledCommunication.findUniqueOrThrow({where:{id:data.id}});assert.equal(row.status,'PUBLISHED');assert.equal(await db.userNotification.count({where:{announcementId:row.publicationId}}),2);assert.equal(await db.notificationEmailOutbox.count({where:{notification:{announcementId:row.publicationId},status:"PENDING"}}),2);
  assert.equal((await (await fetch(c.appUrl+'/api/internal/scheduled-communications',{headers:{authorization:'Bearer local-scheduling-fixture'}})).json()).published,0);
 });
 await t.test('edit/cancel and discoverable rendering fixture preserved',async()=>{
  const cancelled=input();await action('saveCommunicationSchedule',cancelled);await action('saveCommunicationSchedule',{...cancelled,revision:0,title:'Cancelled local send'});await action('cancelCommunicationSchedule',club.id,cancelled.id,1);
  await action('saveCommunicationSchedule',{...input(),title:'Upcoming local send'});
  await actor.action('actions/recipient-groups.ts','saveRecipientGroup',[{clubId:club.id,id:randomUUID(),revision:null,name:'Consulting',kind:'RULES',rules:{include:[{source:'MEMBERS'}],exclude:[{source:'OFFICERS'}]}}]);
  const failed=input();await action('saveCommunicationSchedule',{...failed,title:'Failed local send'});await db.scheduledCommunication.update({where:{id:failed.id},data:{status:'FAILED',failureCode:'PUBLICATION_UNAVAILABLE'}}); // Rendering fixture; real failures are verified in native tests.
  const empty=await db.club.create({data:{slug:randomUUID(),name:'Empty scheduling QA',tagline:'',description:'Local empty/error states',category:'Other',color:'#142d45'}});await db.clubMember.create({data:{clubId:empty.id,userId:c.identities.leader.id,isOwner:true}});await db.clubMember.create({data:{clubId:empty.id,userId:c.identities.student.id,isOwner:true}});
  fs.writeFileSync(path.join(os.tmpdir(),'outclass-scheduling-browser.json'),JSON.stringify({clubId:club.id,url:c.appUrl+`/club/${club.id}/workspace?section=announcements`,emptyClubId:empty.id,emptyUrl:c.appUrl+`/club/${empty.id}/workspace?section=announcements`}));
 });
});
