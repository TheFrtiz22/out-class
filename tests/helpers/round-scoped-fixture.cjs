// Shared synthetic three-round cycle (application review, Interview 1, Interview 2) on migrated PGlite SQL.
const {randomUUID}=require('node:crypto');
const {harness}=require('./interview-sql-harness.cjs');
async function fixture(){
 const h=await harness(),{db,ids}=h,review=randomUUID(),r1=randomUUID(),r2=ids.round,final=randomUUID(),late=randomUUID(),lateMember=randomUUID(),cycleA=randomUUID(),cycleB=randomUUID();
 await db.query(`INSERT INTO "RecruitmentCycle"(id,"clubId",name) VALUES ($1,$3,'Fall'),($2,$3,'Spring')`,[cycleA,cycleB,ids.club]);
 await db.query(`UPDATE "PipelineRound" SET type='INTERVIEW',name='Interview 2',"order"=2 WHERE id=$1`,[r2]);
 await db.query(`INSERT INTO "PipelineRound"(id,"clubId",name,"order",type) VALUES ($1,$4,'Application review',0,'APPLICATION_REVIEW'),($2,$4,'Interview 1',1,'INTERVIEW'),($3,$4,'Final decision',3,'CUSTOM')`,[review,r1,final,ids.club]);
 await db.query(`UPDATE "Application" SET "recruitmentCycleId"=$1,"roundId"=$2,status='SUBMITTED' WHERE id=$3`,[cycleA,review,ids.app]);
 await db.query(`INSERT INTO "User"(id,email) VALUES ($1,'late@virginia.edu')`,[late]);
 await db.query(`INSERT INTO "ClubMember"(id,"clubId","userId",permissions) VALUES ($1,$2,$3,'{applications.review,applicants.identify}')`,[lateMember,ids.club,late]);
 for(const [k,first,last] of [['panel','Avery','Panel'],['peer','Blake','Peer'],['owner','Casey','Owner'],['late','Lee','Late']])
  await db.query(`INSERT INTO "StudentProfile"(id,"userId","firstName","lastName","computingId",major,"gradYear") VALUES ($1,$2,$3,$4,$5,'Economics',2028)`,[randomUUID(),k==='late'?late:ids[k],first,last,`cid${k}`]);
 const assign=(memberId,roundId,app=ids.app)=>db.query(`INSERT INTO "InterviewPanelAssignment"(id,"applicationId","roundId","memberId","grantedBy") VALUES ($1,$2,$3,$4,$5)`,[randomUUID(),app,roundId,memberId,ids.owner]);
 /** Kit record + submitted evaluation; `kit:false` records a submitted evaluation only; `submitted:false` leaves a private draft. */
 const review_=async(memberId,roundId,score,thoughts,{submitted=true,kit=true,app=ids.app}={})=>{
  const evaluationId=randomUUID(),at=submitted?new Date():null;
  await db.query(`INSERT INTO "Evaluation"(id,"applicationId","interviewerId","roundId",round,score,notes,"applicantQuestions","submittedAt") VALUES ($1,$2,$3,$4,'Interview',$5,'PRIVATE NOTES','PRIVATE QUESTIONS',$6)`,[evaluationId,app,memberId,roundId,score,at]);
  if(kit)await db.query(`INSERT INTO "InterviewRecord"(id,"applicationId","interviewerId","roundId",questions,draft,"anonymousReview","completedAt","evaluationId","updatedAt") VALUES ($1,$2,$3,$4,'[]',$5,false,$6,$7,NOW())`,
   [randomUUID(),app,memberId,roundId,JSON.stringify({questionNotes:[{questionId:ids.question,notes:'PRIVATE QUESTION NOTE'}],additionalQuestions:[],additionalNotes:'PRIVATE ADDITIONAL',finalInterviewThoughts:submitted?thoughts:'DRAFT SECRET'}),at,evaluationId]);
 };
 const presentation=h.load('utils/voting-room-presentation.ts'),feedbackApi=h.load('actions/interview-feedback.ts');
 /** Exactly the evidence part getLiveVotingPresentation spreads into its response, serialized like a Server Action result. */
 const voting=async(user,roundId,fields=['interviewScore','finalInterviewThoughts'],app=ids.app)=>JSON.parse(JSON.stringify(await h.prisma.$transaction(tx=>presentation.votingSelectedEvidence(tx,ids.club,app,user,fields,false,roundId))));
 const dialog=async(user,input={})=>{h.as(user);return JSON.parse(JSON.stringify(await feedbackApi.getInterviewFeedback({clubId:ids.club,applicationId:ids.app,...input})));};
 const moveTo=roundId=>db.query(`UPDATE "Application" SET "roundId"=$1,status='INTERVIEWING' WHERE id=$2`,[roundId,ids.app]);
 return {h,db,ids,review,r1,r2,final,lateMember,late,cycleA,cycleB,assign,review_,voting,dialog,moveTo};
}

/** Interview 1: Avery (kit, 8) and Lee (evaluation only, 6). Interview 2: Avery (9) and Blake (7), plus Lee's private draft. */
async function seedInterviews(f){
 const {ids}=f;
 await f.assign(ids.panelMember,f.r1);await f.assign(f.lateMember,f.r1);
 await f.moveTo(f.r1);
 await f.review_(ids.panelMember,f.r1,8,'R1 AVERY summary.');await f.review_(f.lateMember,f.r1,6,'',{kit:false});
 for(const m of [ids.panelMember,ids.peerMember,f.lateMember])await f.assign(m,f.r2);
 await f.moveTo(f.r2);
 await f.review_(ids.panelMember,f.r2,9,'R2 Avery summary.');await f.review_(ids.peerMember,f.r2,7,'R2 Blake summary.');
 await f.review_(f.lateMember,f.r2,1,'',{submitted:false});
}

module.exports={fixture,seedInterviews};
