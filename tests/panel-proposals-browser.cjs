const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{randomUUID}=require('node:crypto')
const {chromium,devices}=require('playwright'),{createServerClient}=require('@supabase/ssr'),{PrismaClient}=require('@prisma/client'),{Actor}=require('./helpers/onboarding-e2e.cjs')
async function prepare(db,auth,config){
 const club=config.clubs[0],other=config.clubs[1],start=new Date();start.setUTCDate(start.getUTCDate()+7);start.setUTCHours(14,0,0,0)
 const schedule={timezone:'America/New_York',weeklySubmitted:true,weekly:Array.from({length:7},()=>[[0,1440]]),exceptions:{}}
 for(const role of ['partner','third']){const email=`panels.${role}.${randomUUID().slice(0,8)}@virginia.edu`,password='Local-panels-only!'+randomUUID();const {data,error}=await auth.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;config.actors[role]={id:data.user.id,email,password};await db.user.create({data:{id:data.user.id,email,studentProfile:{create:{firstName:'Test',lastName:role,computingId:role+randomUUID().slice(0,8),major:'Economics',gradYear:2028}}}});await db.clubMember.create({data:{clubId:club.id,userId:data.user.id,accessRole:'INTERVIEWER',permissions:['applications.review','applicants.identify']}})}
 await db.pipelineRound.updateMany({where:{id:{in:config.clubs.map(c=>c.roundId)}},data:{anonymousReview:false}})
 const members=await db.clubMember.findMany({where:{clubId:club.id,accessRole:'INTERVIEWER'}})
 for(const m of members)await db.interviewRoundParticipation.create({data:{clubId:club.id,roundId:club.roundId,memberId:m.id,availability:schedule,confirmedAt:new Date()}})
 const existing=await db.interviewRoom.findFirstOrThrow({where:{clubId:club.id},include:{slots:true}})
 await db.interviewSlot.update({where:{id:existing.slots[0].id},data:{startTime:start,endTime:new Date(+start+20*60000)}})
 await db.interviewSlot.create({data:{clubId:club.id,roomId:existing.id,startTime:new Date(+start+60*60000),endTime:new Date(+start+80*60000),location:'Hall'}})
 await db.interviewRoom.update({where:{id:existing.id},data:{name:'Room A',interviewersNeeded:2,panelMemberIds:[club.memberId],approvedPanelMemberIds:[club.memberId],panelApprovedBy:config.actors.owner.id}})
 await db.interviewRoom.create({data:{clubId:club.id,roundId:club.roundId,name:'Room B',location:'Second hall',kind:'IN_PERSON',timezone:'America/New_York',duration:20,interviewersNeeded:1,slots:{create:[0,60].map(min=>({clubId:club.id,startTime:new Date(+start+min*60000),endTime:new Date(+start+(min+20)*60000),location:'Second hall'}))}}})
 const foreign=await db.interviewRoom.findFirstOrThrow({where:{clubId:other.id},include:{slots:true}})
 await db.interviewSlot.update({where:{id:foreign.slots[0].id},data:{startTime:start,endTime:new Date(+start+20*60000)}})
 await db.interviewRoom.update({where:{id:foreign.id},data:{panelMemberIds:[other.memberId],approvedPanelMemberIds:[other.memberId],panelApprovedBy:config.actors.owner.id}})
 await db.interviewRoom.update({where:{id:existing.id},data:{approvedPanelMemberIds:[club.memberId],panelApprovedBy:config.actors.owner.id}})
 await db.interviewRoom.update({where:{id:foreign.id},data:{approvedPanelMemberIds:[other.memberId],panelApprovedBy:config.actors.owner.id}})
 const application=await db.application.create({data:{clubId:club.id,roundId:club.roundId,studentId:config.actors.outsider.id,status:'INTERVIEWING'}})
 const booking=await db.interviewBooking.create({data:{applicationId:application.id,roundId:club.roundId,slotId:existing.slots[0].id}})
 await db.interviewPanelAssignment.create({data:{applicationId:application.id,roundId:club.roundId,memberId:club.memberId,grantedBy:config.actors.owner.id,bookingId:booking.id,bookingManaged:true}})
 const notification=await db.userNotification.create({data:{userId:config.actors.interviewer.id,clubId:club.id,eventKey:'fixture-existing',type:'interview.booking',title:'Existing notification',body:'Fixture baseline',href:'/'}})
 await db.notificationEmailOutbox.upsert({where:{notificationId:notification.id},create:{notificationId:notification.id},update:{}})
 config.panels={applicationId:application.id,roomId:existing.id,slotId:existing.slots[0].id,window:{start:start.toISOString(),end:new Date(+start+80*60000).toISOString()}}
}
async function verify(config,root){
 assert.equal(config.projectId,'outclass-availability-e2e');assert.equal(config.appUrl,'http://127.0.0.1:3126');assert.equal(new URL(config.status.DB_URL).port,'57322')
 const db=new PrismaClient({datasourceUrl:config.status.DB_URL}),browser=await chromium.launch(process.platform==='darwin'?{channel:'chrome'}:{}),errors=[]
 const club=config.clubs[0],scope={clubId:club.id,roundId:club.roundId},actors={}
 const snapshot=async()=>Object.fromEntries(await Promise.all(['interviewRoom','interviewSlot','interviewBooking','interviewPanelAssignment','userNotification','notificationEmailOutbox','notificationEmailDelivery'].map(async model=>[model,await db[model].findMany({orderBy:model==='notificationEmailOutbox'?{notificationId:'asc'}:{id:'asc'}})])))
 async function context(role,mobile=false){const cookies=new Map(),client=createServerClient(config.status.API_URL,config.status.PUBLISHABLE_KEY,{cookies:{getAll:()=>[...cookies.values()],setAll:values=>values.forEach(value=>cookies.set(value.name,value))}});const {error}=await client.auth.signInWithPassword(config.actors[role]);if(error)throw error;const ctx=await browser.newContext(mobile?{...devices['iPhone 13'],defaultBrowserType:undefined}:{viewport:{width:1440,height:1000},timezoneId:'America/New_York'});await ctx.addCookies([...cookies.values()].map(({name,value})=>({name,value,url:config.appUrl,sameSite:'Lax'})));const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));return{page,ctx}}
 async function workspace(page){await page.goto(`${config.appUrl}/club/${club.id}/workspace?section=recruitment&tool=interviews`);await page.getByRole('tab',{name:'Rooms & Booking'}).waitFor();const skip=page.getByRole('button',{name:'Skip tutorial',exact:true});try{await skip.waitFor({timeout:3000});await skip.click();await skip.waitFor({state:'hidden'})}catch{}await page.getByRole('tab',{name:'Rooms & Booking'}).click();await page.getByRole('heading',{name:'Great conversations start here.'}).waitFor()}
 const action=(name,args)=>actors.owner.action('actions/panel-proposals.ts',name,[args])
 try{
  for(const role of ['owner','interviewer','outsider']){actors[role]=new Actor(config);await actors[role].signIn(config.actors[role].email,config.actors[role].password)}
  await db.interviewPanelProposal.deleteMany({where:{clubId:club.id}})
  assert.equal(new URL(config.status.MAILPIT_URL).port,'57324');const mailBefore=(await (await fetch(config.status.MAILPIT_URL+'/api/v1/messages')).json()).total
  const before=await snapshot(),applicantBefore=await actors.outsider.action('actions/interview-rooms.ts','getApplicantSchedule',[config.panels.applicationId]),managerBefore=await actors.owner.action('actions/interview-rooms.ts','getRoomWorkspace',[club.id])
  const owner=await context('owner');await workspace(owner.page)
  assert.equal(await owner.page.getByLabel('Interviewers needed for Room A',{exact:true}).inputValue(),'2');assert.equal(await owner.page.getByLabel('Interviewers needed for Room B',{exact:true}).inputValue(),'1')
  await owner.page.getByRole('button',{name:'Auto-Fill',exact:true}).first().click()
  const panel=owner.page.getByRole('region',{name:'Review Panel Assignments'});await panel.getByText('83% staffed',{exact:false}).waitFor();assert.equal(await db.interviewPanelScheduleVersion.count(),0)
  let draft=(await action('getPanelProposalWorkspace',scope)).proposal;assert.equal(draft.status,'UNPUBLISHED');assert.equal(draft.validation.filled,5);assert.equal(draft.validation.required,6)
  assert.deepEqual(await snapshot(),before);assert.deepEqual(await actors.owner.action('actions/interview-rooms.ts','getRoomWorkspace',[club.id]),managerBefore);assert.deepEqual(await actors.outsider.action('actions/interview-rooms.ts','getApplicantSchedule',[config.panels.applicationId]),applicantBefore)
  await panel.getByRole('button',{name:/^Lock /}).first().click();await panel.getByText('Change validated.',{exact:false}).waitFor()
  await panel.getByRole('button',{name:'Save Draft',exact:true}).click();await panel.getByText('Draft saved.',{exact:true}).waitFor()
  draft=(await action('getPanelProposalWorkspace',scope)).proposal;assert.equal(draft.document.assignments.filter(a=>a.locked).length,1)
  await panel.getByRole('button',{name:/^Remove /}).last().click();await panel.getByText('Change validated.',{exact:false}).waitFor();await panel.getByRole('button',{name:'Save Draft',exact:true}).click();await panel.getByText('Draft saved.',{exact:true}).waitFor()
  draft=(await action('getPanelProposalWorkspace',scope)).proposal;assert.equal(draft.document.assignments.length,4)
  await owner.page.reload();await owner.page.getByRole('tab',{name:'Rooms & Booking'}).click();await owner.page.getByRole('button',{name:'Panel drafts',exact:true}).click();await panel.getByText('67% staffed',{exact:false}).waitFor()
  await panel.getByRole('button',{name:'Fill missing positions',exact:true}).click();await panel.getByText('83% staffed',{exact:false}).waitFor();draft=(await action('getPanelProposalWorkspace',scope)).proposal;assert.equal(draft.document.assignments.length,5);assert.equal(draft.document.assignments.filter(a=>a.locked).length,1)
  await panel.getByRole('button',{name:'Regenerate unlocked',exact:true}).click();await panel.getByText('Unpublished proposal saved.',{exact:false}).waitFor();assert.deepEqual(await snapshot(),before)
  await owner.page.screenshot({path:path.join(root,'panel-desktop.png'),fullPage:false})
  const mobile=await context('owner',true);await workspace(mobile.page);await mobile.page.getByRole('button',{name:'Panel drafts',exact:true}).tap();const mobilePanel=mobile.page.getByRole('region',{name:'Review Panel Assignments'});await mobilePanel.getByText('83% staffed',{exact:false}).waitFor();await mobilePanel.getByRole('button',{name:/^Unlock /}).first().tap();await mobilePanel.getByText('Change validated.',{exact:false}).waitFor();await mobilePanel.getByRole('button',{name:'Save Draft',exact:true}).tap();await mobilePanel.getByText('Draft saved.',{exact:true}).waitFor();assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.page.screenshot({path:path.join(root,'panel-mobile.png'),fullPage:false})
  for(const role of ['interviewer','outsider'])await assert.rejects(actors[role].action('actions/panel-proposals.ts','getPanelProposalWorkspace',[scope]))
  await assert.rejects(action('getPanelProposalWorkspace',{clubId:club.id,roundId:config.clubs[1].roundId}))
  draft=(await action('getPanelProposalWorkspace',scope)).proposal;await assert.rejects(action('generatePanelProposal',{...scope,revision:0,window:draft.document.window,options:draft.document.options,mode:'REGENERATE'}))
  await mobilePanel.getByRole('button',{name:'Discard Draft',exact:true}).tap();await mobilePanel.getByText('Draft discarded.',{exact:true}).waitFor();assert.equal(await db.interviewPanelProposal.count({where:{clubId:club.id}}),0);assert.equal((await action('getPanelProposalWorkspace',scope)).proposal,null)
  assert.deepEqual(await snapshot(),before);assert.deepEqual(await actors.owner.action('actions/interview-rooms.ts','getRoomWorkspace',[club.id]),managerBefore);assert.deepEqual(await actors.outsider.action('actions/interview-rooms.ts','getApplicantSchedule',[config.panels.applicationId]),applicantBefore)
  assert.equal(await db.interviewPanelAssignment.count(),before.interviewPanelAssignment.length);assert.equal(await db.userNotification.count(),before.userNotification.length);assert.equal(await db.notificationEmailOutbox.count(),before.notificationEmailOutbox.length);assert.equal(await db.notificationEmailDelivery.count(),before.notificationEmailDelivery.length)
  assert.equal((await (await fetch(config.status.MAILPIT_URL+'/api/v1/messages')).json()).total,mailBefore)
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'panel-acceptance.json'),JSON.stringify({passed:true,officialTablesUnchanged:true,managerApiUnchanged:true,applicantApiUnchanged:true,noNewGrants:true,noNotificationsOrEmailIntents:true,discarded:true,mobileEditing:true},null,2));console.log('Panel acceptance: real Auto-Fill → edit/lock → save/reopen → refill/regenerate → mobile → discard; DB and applicant/manager APIs unchanged: PASS')
 }finally{await browser.close();await db.$disconnect()}
}
module.exports={prepare,verify}
if(require.main===module){const config=process.argv[2];verify(JSON.parse(fs.readFileSync(config)),path.dirname(config)).catch(e=>{console.error(e);process.exitCode=1})}
