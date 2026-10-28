// Synthetic records in the reserved local dashboard project only; never loads .env.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const { PrismaClient } = require('@prisma/client')
const { Actor, readConfig, randomUUID } = require('../tests/helpers/onboarding-e2e.cjs')
const configFile = path.join(os.tmpdir(), 'outclass-dashboards-e2e/config.json')
async function seed() {
  const config = readConfig(configFile); assert.equal(config.suite, 'dashboards')
  const db = new PrismaClient({ datasourceUrl: config.status.DB_URL }), actors = {}, suffix = randomUUID().slice(0,8), now = Date.now()
  try {
    for (const [role, name] of Object.entries({owner:'Avery Morgan',member:'Sam Rivera',student:'Jamie Chen',reviewer:'Taylor Brooks',empty:'Casey Ellis'})) {
      const actor = new Actor(config); await actor.signUp(name, `visual${role}${suffix}`,2028); await actor.profile(name,2028)
      await actor.action('actions/tutorials.ts','saveTutorial',[{experience:'student',action:'skip',step:0}]); actors[role] = actor
    }
    const club = await db.club.create({data:{slug:`visual-society-${suffix}`,name:'Grounds Creative Society',tagline:'Build something worth sharing.',description:'A fictional student community for interdisciplinary projects, thoughtful conversations, and creative work.',category:'Arts',color:'#315b4b',claimedAt:new Date(),applicationDeadline:new Date(now+7*86400000)}})
    const emptyClub = await db.club.create({data:{slug:`visual-empty-${suffix}`,name:'New Campus Collective',tagline:'A new beginning.',description:'A synthetic empty workspace.',category:'Academic',color:'#142d45',claimedAt:new Date()}})
    const members = {}
    for (const role of ['owner','member','reviewer']) members[role] = await db.clubMember.create({data:{clubId:club.id,userId:actors[role].user.id,isOwner:role==='owner',accessRole:role==='owner'?'OWNER':'MEMBER',permissions:role==='reviewer'?['applications.review']:[]}})
    await db.clubMember.create({data:{clubId:emptyClub.id,userId:actors.owner.user.id,isOwner:true,accessRole:'OWNER'}})
    for (const id of [club.id,emptyClub.id]) await actors.owner.action('actions/tutorials.ts','saveTutorial',[{experience:'leader',clubId:id,action:'skip',step:0}])
    const written = await db.pipelineRound.create({data:{clubId:club.id,name:'Written application',type:'APPLICATION_REVIEW',anonymousReview:false,order:0}})
    const interview = await db.pipelineRound.create({data:{clubId:club.id,name:'Conversation',type:'INTERVIEW',order:1}})
    await db.applicationQuestion.create({data:{clubId:club.id,prompt:'What would you like to create with us?',type:'ESSAY',required:true,wordLimit:200,order:0}})
    const application = await db.application.create({data:{clubId:club.id,studentId:actors.student.user.id,roundId:written.id,status:'DRAFTING'}})
    for(let i=0;i<14;i++) {
      const user = await db.user.create({data:{email:`visualcandidate${i}${suffix}@virginia.edu`,studentProfile:{create:{firstName:['Alex','Jordan','Morgan','Riley'][i%4],lastName:`Sample ${i+1}`,computingId:`vs${i}${suffix}`,major:['Economics','Computer Science','Architecture'][i%3],gradYear:2027+i%3}}}})
      await db.application.create({data:{clubId:club.id,studentId:user.id,roundId:i%3===0?interview.id:written.id,status:i%3===0?'INTERVIEWING':'SUBMITTED',submittedAt:new Date(now-i*3600000)}})
    }
    const room = await db.interviewRoom.create({data:{clubId:club.id,roundId:interview.id,name:'Newcomb conversation room',location:'Newcomb Hall 201',kind:'IN_PERSON',timezone:'America/New_York',duration:30,interviewersNeeded:1}})
    await db.interviewSlot.create({data:{clubId:club.id,roomId:room.id,startTime:new Date(now+2*86400000),endTime:new Date(now+2*86400000+1800000),location:room.location}})
    for(let i=0;i<5;i++) {
      const task = await db.clubTask.create({data:{clubId:club.id,title:['Draft the exhibition brief','Choose a project partner','Share your research notes','Prepare the member agenda','Review the exhibition plan'][i],description:'Share your contribution and the next steps for the team.',requirements:['TEXT'],audience:{everyone:true},dueAt:new Date(now+(i-1)*86400000)}})
      await db.taskAssignment.create({data:{taskId:task.id,memberId:members[i%2?'member':'owner'].id,userId:actors[i%2?'member':'owner'].user.id}})
    }
    const meeting = await db.meeting.create({data:{clubId:club.id,title:'Project working session',date:new Date(now+86400000),endDate:new Date(now+86400000+3600000),location:'Newcomb Hall',audience:'MEMBERS',isPublic:false,agenda:'Review proposals, share feedback, and agree on next steps.'}})
    const event = await db.meeting.create({data:{clubId:club.id,title:'An evening of new ideas',description:'Meet the teams and discover what we are making together.',date:new Date(now+3*86400000),endDate:new Date(now+3*86400000+3600000),location:'Newcomb Ballroom',audience:'RECRUITMENT',isPublic:true,publication:{create:{status:'PUBLISHED',approvedRevision:0,rsvpEnabled:true,reviewedAt:new Date(),reviewedBy:actors.owner.user.id,publishedAt:new Date()}}}})
    await actors.owner.action('actions/communications.ts','publishClubAnnouncement',[{clubId:club.id,title:'Your next project starts here',body:'Bring one idea to our next working session. We will choose teams and shape the exhibition together.',audience:'CUSTOM',audienceSpec:{include:[{source:'PEOPLE',userIds:[actors.member.user.id,actors.student.user.id]}]},requestKey:randomUUID()}])
    await db.platformReport.create({data:{kind:'SUPPORT',targetId:club.id,reporterId:actors.student.user.id,summary:'Help us check a sample invitation',status:'OPEN'}})
    await db.schoolRequest.create({data:{fullName:'Robin Sample',email:'robin@example.edu',university:'Example University',role:'STUDENT',organization:'Creative Society',message:'A synthetic request for local visual review.'}})
    const fixture = {clubId:club.id,emptyClubId:emptyClub.id,applicationId:application.id,meetingId:meeting.id,eventId:event.id,roundId:interview.id,actors:Object.fromEntries(Object.entries(actors).map(([role,actor])=>[role,{id:actor.user.id,credentials:actor.credentials,cookies:[...actor.cookies].map(([name,value])=>({name,value,url:config.appUrl}))}]))}
    fs.writeFileSync(path.join(path.dirname(configFile),'visual-fixture.json'),JSON.stringify(fixture),{mode:0o600})
    console.log('Synthetic visual fixture ready: five roles, two clubs, 15 applications, tasks, meetings, events, announcements and support records.')
  } finally { await db.$disconnect() }
}
seed().catch(error=>{console.error(error);process.exitCode=1})
