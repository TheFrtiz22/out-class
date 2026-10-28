// Additional synthetic states in the reserved local project. No application env is loaded.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict')
const {PrismaClient}=require('@prisma/client'),{Actor,readConfig}=require('../tests/helpers/onboarding-e2e.cjs')
async function run(){const root=path.join(os.tmpdir(),'outclass-dashboards-e2e'),c=readConfig(path.join(root,'config.json'));assert.equal(c.suite,'dashboards');const file=path.join(root,'visual-fixture.json'),f=JSON.parse(fs.readFileSync(file)),db=new PrismaClient({datasourceUrl:c.status.DB_URL});try{
 const owner=await db.clubMember.findUniqueOrThrow({where:{userId_clubId:{clubId:f.clubId,userId:f.actors.owner.id}}}),reviewer=await db.clubMember.findUniqueOrThrow({where:{userId_clubId:{clubId:f.clubId,userId:f.actors.reviewer.id}}})
 await db.clubMember.update({where:{id:reviewer.id},data:{interviewOffices:['PRESIDENT'],permissions:['applications.review','applicants.identify','interviews.manage','decisions.view','decisions.vote']}})
 const room=await db.interviewRoom.findFirstOrThrow({where:{clubId:f.clubId}}),slot=await db.interviewSlot.findFirstOrThrow({where:{roomId:room.id}}),application=await db.application.findFirstOrThrow({where:{clubId:f.clubId,status:'INTERVIEWING'}})
 await db.interviewRoom.update({where:{id:room.id},data:{panelMemberIds:[reviewer.id],approvedPanelMemberIds:[reviewer.id],panelApprovedBy:f.actors.owner.id,panelApprovalRevision:1}})
 await db.interviewPanelAssignment.upsert({where:{applicationId_roundId_memberId:{applicationId:application.id,roundId:f.roundId,memberId:reviewer.id}},create:{applicationId:application.id,roundId:f.roundId,memberId:reviewer.id,grantedBy:f.actors.owner.id},update:{}})
 const booking=await db.interviewBooking.findFirst({where:{applicationId:application.id}})||await db.interviewBooking.create({data:{applicationId:application.id,roundId:f.roundId,slotId:slot.id}})
 f.focusedApplicationId=application.id;f.bookingId=booking.id;f.roomId=room.id
 for(let i=0;i<20;i++)await db.userNotification.upsert({where:{userId_eventKey:{userId:f.actors.member.id,eventKey:`visual-dense-${i}`}},create:{userId:f.actors.member.id,clubId:f.clubId,eventKey:`visual-dense-${i}`,type:i%2?'ANNOUNCEMENT':'TASK',title:i%2?`A new project update ${i+1}`:`Your next project task ${i+1}`,body:'A synthetic update with enough detail to review message wrapping, hierarchy and keyboard selection.',href:`/club/${f.clubId}/workspace?section=${i%2?'announcements':'tasks'}`,readAt:i%3?null:new Date()},update:{}})
 const actor=new Actor(c);await actor.signIn(f.actors.owner.credentials.email,f.actors.owner.credentials.password)
 const candidateIds=(await db.application.findMany({where:{clubId:f.clubId,status:'SUBMITTED'},take:3})).map(a=>a.id)
 if(!f.votingSessionId)f.votingSessionId=await actor.action('actions/voting.ts','createVotingSession',[{clubId:f.clubId,roundId:(await db.pipelineRound.findFirstOrThrow({where:{clubId:f.clubId,type:'APPLICATION_REVIEW'}})).id,applicationIds:candidateIds,participantIds:[owner.id,reviewer.id],targetSize:1}])
 fs.writeFileSync(file,JSON.stringify(f),{mode:0o600});console.log('Prepared explicit interview leadership, assigned booked room, dense inbox and persisted voting session.')
}finally{await db.$disconnect()}}
run().catch(error=>{console.error(error);process.exitCode=1})
