"use server";
import {z} from "zod";
import {decisionPublicationGuard} from "@/lib/decision-publication-guard";
import {hasPermission} from "@/lib/permissions";
import {Prisma} from "@prisma/client";
import {decisionScheduleInput,decisionSnapshotSchema} from "@/lib/decision-schedule";
import {letterTemplatesSchema,defaultLetters} from "@/lib/decision-letters";
import {resolveScheduleTime,requireFutureSchedule} from "@/lib/communication-schedule";
import {assertRecruitmentTransition} from "@/lib/recruitment-lifecycle";
import {ballotOutcome} from "@/lib/voting-engine";
import {requireClubPermission} from "@/utils/auth";
import {supportContext} from "@/utils/support-audit";
import {clubWriteTransaction} from "@/utils/club-write-transaction";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
import {roundPublicationKey} from "@/utils/decision-scheduling";
const uuid=z.string().uuid();
export async function scheduleDecisionPublication(input:unknown){
 const d=decisionScheduleInput.parse(input),scheduledAt=resolveScheduleTime(d.localTime,d.timeZone,d.occurrence);
 const caps=d.selection.kind==="VOTING"?["applications.review","decisions.publish","applicants.identify"] as const:["decisions.manage","applicants.identify"] as const;
 const {user}=await requireClubPermission(d.clubId,[...caps]);
 if(await supportContext())throw Error("Exit temporary support impersonation before scheduling decisions.");
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,d.clubId,user.id,[...caps]);
  const existing=await tx.scheduledCommunication.findUnique({where:{id:d.id}});
  const request=JSON.stringify(d);
  if(existing){if(existing.clubId===d.clubId&&existing.senderId===user.id&&existing.kind==="DECISION"&&existing.body===request)return {id:existing.id,status:existing.status};throw Error("Schedule identifier already used.");}
  requireFutureSchedule(scheduledAt);
  if(await tx.scheduledCommunication.count({where:{clubId:d.clubId,status:{in:["SCHEDULED","PROCESSING","FAILED"]}}})>=100)throw Error("Cancel unused scheduled work first.");
  let voting:{id:string;revision:number}|null=null,votingRoundId:string|null=null;
  const expectedStatuses=new Map<string,string>();
  let decisions:{id:string;passNumber:number;decision:"ACCEPTED"|"WAITLISTED"|"REJECTED"}[];
  const selection=d.selection;
  if(selection.kind==="VOTING"){
   if(new Set(selection.applicationIds).size!==selection.applicationIds.length)throw Error("Duplicate candidates.");
   await tx.$queryRaw`SELECT id FROM "VotingSession" WHERE id=${selection.sessionId} AND "clubId"=${d.clubId} FOR UPDATE`;
   const session=await tx.votingSession.findFirst({where:{id:selection.sessionId,clubId:d.clubId,mode:{not:"LIVE"}},include:{_count:{select:{participants:true}}}});
   if(!session||session.revision!==selection.revision||session.state!=="COMPLETED"||session.publishedAt)throw Error("Review the completed session before scheduling.");
   // Fetch only selected candidates and their latest pass. Historical ballot
   // volume and unrelated applicants cannot make a queued intent unbounded.
   const candidates=await tx.votingCandidate.findMany({where:{sessionId:session.id,applicationId:{in:selection.applicationIds}},take:50,include:{passes:{orderBy:{passNumber:"desc"},take:1,include:{ballots:{select:{decision:true},take:501}}}}});
   decisions=selection.applicationIds.map(id=>{
    const candidate=candidates.find(c=>c.applicationId===id),entry=candidate?.passes[0];
    if(!candidate||!entry||entry.ballots.length>500)throw Error("Candidate outcome unavailable.");
    const outcome=entry.override??ballotOutcome(entry.ballots,session._count.participants,session.autoAdvance,session.threshold).outcome;
    if(!["PASS","HOLD","NOT_PASS"].includes(outcome))throw Error("Select resolved candidates.");
    return {id,passNumber:entry.passNumber,decision:outcome==="PASS"?"ACCEPTED":outcome==="HOLD"?"WAITLISTED":"REJECTED"};
   });
   for(const c of candidates)expectedStatuses.set(c.applicationId,c.expectedStatus);
   votingRoundId=session.roundId;
   voting={id:session.id,revision:session.revision};
  }else decisions=[{id:selection.applicationId,passNumber:0,decision:selection.status}];
  const apps=await tx.application.findMany({where:{clubId:d.clubId,id:{in:decisions.map(a=>a.id)}},include:{round:true,student:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}});
  const applications=decisions.sort((a,b)=>a.id.localeCompare(b.id)).map(item=>{
   const app=apps.find(a=>a.id===item.id);
   if(!app||voting&&(app.roundId!==votingRoundId||app.status!==expectedStatuses.get(app.id))||app.round.archivedAt||app.status==="DRAFTING"||app.status===item.decision||selection.kind==="DIRECT"&&decisionPublicationGuard(app)!==selection.expectedGuard)throw Error("Application changed or unavailable.");
   assertRecruitmentTransition(app.status,item.decision,app.round.type);
   return {id:app.id,status:app.status,firstName:app.student.studentProfile?.firstName||"Student",fullName:app.student.studentProfile?`${app.student.studentProfile.firstName} ${app.student.studentProfile.lastName}`:"Student",version:app.decisionVersion,stateRevision:app.decisionStateRevision,roundId:app.roundId,roundKey:roundPublicationKey(app.round),passNumber:item.passNumber,decision:item.decision};
  });
  const club=await tx.club.findUniqueOrThrow({where:{id:d.clubId},select:{sendFormalDecisionLetters:true,decisionLetterTemplates:true,name:true,color:true,logoUrl:true}});
  const snapshot=decisionSnapshotSchema.parse({applications,voting,settings:{enabled:club.sendFormalDecisionLetters,templates:{...defaultLetters,...letterTemplatesSchema.parse(club.decisionLetterTemplates??{})},name:club.name,color:club.color,logoUrl:club.logoUrl}});
  await tx.scheduledCommunication.create({data:{id:d.id,clubId:d.clubId,senderId:user.id,actorId:user.id,kind:"DECISION",title:selection.kind==="VOTING"?`Voting decisions · ${applications.length}`:"Application decision",body:request,audience:{},snapshot:snapshot as unknown as Prisma.InputJsonValue,recipientMode:"FIXED",scheduledAt,timeZone:d.timeZone,localTime:d.localTime,occurrence:d.occurrence,requestKey:d.id}});
  await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:d.id,action:"recruitment.decision.scheduled",details:{count:applications.length,scheduledAt:scheduledAt.toISOString(),votingSessionId:voting?.id??null}}});
  return {id:d.id,status:"SCHEDULED" as const};
 });
}
export async function getDecisionSchedules(clubId:string){
 uuid.parse(clubId);const {user}=await requireClubPermission(clubId,["applicants.identify"]);
 return clubWriteTransaction(async tx=>{
  const member=await authorizeClubTransaction(tx,clubId,user.id,["applicants.identify"],{readOnly:true});
  if(!hasPermission(member,"decisions.manage")&&!hasPermission(member,"decisions.publish"))throw Error("Decision management access required.");
  // Detailed intent/outcomes remain restricted to identified recruitment managers.
  const rows=await tx.scheduledCommunication.findMany({where:{clubId,kind:"DECISION"},select:{id:true,title:true,status:true,revision:true,scheduledAt:true,timeZone:true,recipientCount:true,failureCode:true,snapshot:true},orderBy:{createdAt:"desc"},take:150});
  const keys=(snapshot:unknown)=>decisionSnapshotSchema.parse(snapshot).applications.map(a=>`decision:${a.id}:${a.version+1}`);
  const eventKeys=rows.filter(r=>r.status==="PUBLISHED").flatMap(r=>keys(r.snapshot));
  const notices=eventKeys.length?await tx.userNotification.findMany({where:{clubId,type:"DECISION",eventKey:{in:eventKeys}},select:{eventKey:true,emailOutbox:{select:{status:true,delivery:{select:{status:true}}}}}}):[];
  return rows.map(({snapshot,...row})=>{
   const email={queued:0,sent:0,suppressed:0,attention:0};
   if(row.status==="PUBLISHED")for(const key of keys(snapshot)){
    const outbox=notices.find(n=>n.eventKey===key)?.emailOutbox;
    if(!outbox)continue;
    if(outbox.status==="SUPPRESSED"||outbox.delivery?.status==="SUPPRESSED")email.suppressed++;
    else if(outbox.delivery?.status==="SENT")email.sent++;
    else if(["FAILED","UNCERTAIN"].includes(outbox.delivery?.status??""))email.attention++;
    else email.queued++;
   }
   return {...row,email,targets:decisionSnapshotSchema.parse(snapshot).applications.map(a=>({label:`Applicant ${a.id.replaceAll("-","").slice(-10).toUpperCase()}`,decision:a.decision}))};
  });
 });
}
export async function cancelDecisionSchedule(clubId:string,id:string,revision:number){
 uuid.parse(clubId);uuid.parse(id);z.number().int().nonnegative().parse(revision);
 const {user}=await requireClubPermission(clubId,["applicants.identify"]);
 return clubWriteTransaction(async tx=>{
  const member=await authorizeClubTransaction(tx,clubId,user.id,["applicants.identify"]);
  const row=await tx.scheduledCommunication.findFirst({where:{id,clubId,kind:"DECISION"}});
  if(!row)throw Error("Scheduled decision unavailable.");
  const snapshot=decisionSnapshotSchema.parse(row.snapshot);
  if(!hasPermission(member,"decisions.manage")){if(!snapshot.voting)throw Error("Decision management access required.");await authorizeClubTransaction(tx,clubId,user.id,["applications.review","decisions.publish","applicants.identify"]);}
  if(row.status==="CANCELLED"&&row.revision===revision+1)return {success:true};
  if(!row||row.revision!==revision||!["SCHEDULED","FAILED"].includes(row.status))throw Error("Decision intent changed or already processing/published.");
  await tx.scheduledCommunication.update({where:{id},data:{status:"CANCELLED",revision:{increment:1}}});
  await tx.auditLog.create({data:{actorId:user.id,clubId,targetId:id,action:"recruitment.decision.schedule.cancelled"}});
  return {success:true};
 });
}
