const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {Actor}=require('./helpers/onboarding-e2e.cjs');
const configFile=process.env.OUTCLASS_AUDIENCE_E2E_CONFIG;
test('recipient groups through real local Auth and production Next server actions',{skip:!configFile,timeout:120000},async t=>{
 const c=JSON.parse(fs.readFileSync(configFile));assert.equal(c.projectId,'outclass-admin-session-e2e');
 for(const [value,port]of [[c.status.API_URL,'60321'],[c.status.DB_URL,'60322']]){const u=new URL(value);assert.ok(['localhost','127.0.0.1'].includes(u.hostname));assert.equal(u.port,port);}
 c.appUrl='http://127.0.0.1:3109';c.buildDir=path.resolve('.next-publish');
 const {PrismaClient}=require('@prisma/client'),db=new PrismaClient({datasourceUrl:c.status.DB_URL});t.after(()=>db.$disconnect());
 const leader=new Actor(c),student=new Actor(c);await leader.signIn(c.identities.leader.email,c.identities.leader.password);await student.signIn(c.identities.student.email,c.identities.student.password);
 const club=await db.club.create({data:{slug:randomUUID(),name:'HTTP audience fixture',tagline:'',description:'',category:'Other',color:'#142d45'}});
 await db.clubMember.create({data:{clubId:club.id,userId:c.identities.leader.id,isOwner:true}});await db.clubMember.create({data:{clubId:club.id,userId:c.identities.student.id}});
 const action=(name,...args)=>leader.action('actions/recipient-groups.ts',name,args);
 let group,notice;
 await t.test('workspace and discoverable management load; group create/edit and preview work over HTTP',async()=>{
  const page=await leader.request(`/club/${club.id}/workspace?section=announcements`);assert.equal(page.status,200);
  group=await action('saveRecipientGroup',{clubId:club.id,id:randomUUID(),revision:null,name:'Consulting',kind:'MANUAL',userIds:[c.identities.student.id]});
  assert.equal((await action('getRecipientGroups',club.id)).groups[0].name,'Consulting');
  const preview=await action('previewRecipientAudience',club.id,{include:[{source:'GROUP',groupId:group.id},{source:'MEMBERS'}],exclude:[{source:'OFFICERS'}]});assert.equal(preview.count,1);assert.equal(preview.recipients[0].id,c.identities.student.id);
  group=await action('saveRecipientGroup',{clubId:club.id,id:group.id,revision:group.revision,name:'Finance',kind:'MANUAL',userIds:[c.identities.student.id]});assert.equal(group.revision,1);
 });
 await t.test('member, cross-club and Demo attempts are rejected through normal authorization',async()=>{
  await assert.rejects(student.action('actions/recipient-groups.ts','saveRecipientGroup',[{clubId:club.id,id:randomUUID(),revision:null,name:'Forbidden',kind:'MANUAL',userIds:[]}]));
  await assert.rejects(action('previewRecipientAudience',randomUUID(),{include:[{source:'MEMBERS'}]}));
  const demo=new Actor(c);demo.cookies=new Map(leader.cookies);demo.cookies.set('outclass-demo-session','1');
  await assert.rejects(demo.action('actions/recipient-groups.ts','getRecipientGroups',[club.id]));
 });
 await t.test('custom publication and retry use one canonical notification/outbox with delivery disabled',async()=>{
  const data={clubId:club.id,title:'Controlled HTTP publication',body:'Isolated only; no worker delivery',audience:'CUSTOM',audienceSpec:{include:[{source:'GROUP',groupId:group.id}]},requestKey:randomUUID()};
  const a=await leader.action('actions/communications.ts','publishClubAnnouncement',[data]),b=await leader.action('actions/communications.ts','publishClubAnnouncement',[data]);assert.equal(a.id,b.id);assert.equal(a.recipientCount,1);
  notice=a.id;assert.equal(await db.userNotification.count({where:{announcementId:notice}}),1);assert.equal(await db.notificationEmailOutbox.count({where:{notification:{announcementId:notice}}}),1);
 });
 await t.test('group deletion preserves account and publication history',async()=>{
  await action('deleteRecipientGroup',club.id,group.id,group.revision);assert.ok(await db.user.findUnique({where:{id:c.identities.student.id}}));assert.equal(await db.userNotification.count({where:{announcementId:notice}}),1);
 });
});
