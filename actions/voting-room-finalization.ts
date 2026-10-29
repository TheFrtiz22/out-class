"use server";
import { votingReadLimits } from "@/lib/voting-transaction-limits";
import { prisma } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { clubWriteTransaction,votingWriteLimits } from "@/utils/club-write-transaction";
import { roomScope,finalizationPreviewInput,finalizeRoomInput } from "@/lib/voting-room";
import { loadVotingRoom,requireRoomLeader,roomFingerprint,roomAuthority } from "@/utils/voting-room";
import { votingFinalizationPlan } from "@/utils/voting-finalization";
import { publishRecruitmentDecision } from "@/utils/recruitment-offers";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";
import { Prisma } from "@prisma/client";
import {z} from "zod";
import {decisionPublicationGuard} from "@/lib/decision-publication-guard";
import {publishDecisionCommunication} from "@/utils/decision-communications";
const caps=["applications.review","decisions.start","decisions.manage","decisions.publish","applicants.identify"] as const;
export async function getLiveVotingSummary(input:unknown){
 const d=roomScope.parse(input),{user}=await requireClubPermission(d.clubId,["applications.review","decisions.start"]);
 return prisma.$transaction(async tx=>{
  const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.start"],{readOnly:true});const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId);requireRoomLeader(s,m,"decisions.start");roomAuthority(s,m,round.anonymousReview);
  const rows=await tx.application.findMany({where:{clubId:d.clubId,id:{in:s.candidates.map(c=>c.applicationId)}},include:{round:true,student:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}}});
  const rounds=await tx.pipelineRound.findMany({where:{clubId:d.clubId,archivedAt:null,order:{gt:round.order}},orderBy:{order:"asc"},select:{id:true,name:true}});
  return {revision:s.revision,rounds,labels:rows.map(a=>({id:a.id,label:round.anonymousReview||a.round.anonymousReview?anonymousApplicantLabel(a.id):a.student.studentProfile?`${a.student.studentProfile.firstName} ${a.student.studentProfile.lastName}`:"Applicant"}))};
 },votingReadLimits);
}
export async function previewLiveVotingFinalization(input:unknown){
 const d=finalizationPreviewInput.parse(input),{user}=await requireClubPermission(d.clubId,[...caps]);
 return prisma.$transaction(async tx=>{const m=await authorizeClubTransaction(tx,d.clubId,user.id,[...caps,...(d.mapping.kind==="ADVANCE"?["recruitment.manage" as const]:[])],{readOnly:true});const {s}=await loadVotingRoom(tx,d.clubId,d.sessionId);requireRoomLeader(s,m,"decisions.publish");if(s.state!=="COMPLETED"||s.finalizedAt)throw Error("End voting before previewing unfinalized decisions.");return votingFinalizationPlan(tx,s,d.mapping);},votingReadLimits);
}
export async function finalizeLiveVotingRoom(input:unknown){
 const d=finalizeRoomInput.parse(input),{user}=await requireClubPermission(d.clubId,[...caps]);
 try{return {ok:true as const,result:await clubWriteTransaction(async tx=>{
  const m=await authorizeClubTransaction(tx,d.clubId,user.id,[...caps,...(d.mapping.kind==="ADVANCE"?["recruitment.manage" as const]:[])]);const {s}=await loadVotingRoom(tx,d.clubId,d.sessionId,true);requireRoomLeader(s,m,"decisions.publish");
  const fingerprint=roomFingerprint(d),key={sessionId:s.id,requestId:d.requestId},prior=await tx.votingRoomCommand.findUnique({where:{sessionId_requestId:key}});
  if(prior){if(prior.actorId!==user.id||prior.fingerprint!==fingerprint)throw Error("Request ID reused with different content.");return {revision:s.revision};}
  if(s.state!=="COMPLETED"||s.finalizedAt||s.revision!==d.revision)throw Error("Session changed. Preview decisions again.");
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "Application" WHERE "clubId"=${d.clubId} AND id IN (${Prisma.join(s.candidates.map(c=>c.applicationId))}) ORDER BY id FOR UPDATE`);
  const plan=await votingFinalizationPlan(tx,s,d.mapping);if(plan.guard!==d.guard)throw Error("Applicant or pipeline state changed. Preview decisions again.");
  await tx.$queryRaw`SELECT set_config('outclass.voting_finalization',${s.id},true)`;
  for(const c of plan.changes){
   if(c.outcome==="HOLD"||c.outcome==="UNREVIEWED")continue;
   if(c.toRoundId!==c.fromRoundId){await tx.application.update({where:{id:c.applicationId},data:{roundId:c.toRoundId,status:c.toStatus}});await tx.auditLog.create({data:{clubId:d.clubId,actorId:user.id,targetId:c.applicationId,action:"club.round.move",details:{sessionId:s.id,previousRoundId:c.fromRoundId,newRoundId:c.toRoundId,previousStatus:c.fromStatus,status:c.toStatus}}});}
   else await publishRecruitmentDecision(tx,{clubId:d.clubId,applicationId:c.applicationId,roundId:c.fromRoundId,expectedStatus:c.fromStatus,status:c.toStatus},user.id,undefined,undefined,"DEFERRED");
  }
  await tx.votingSession.update({where:{id:s.id},data:{finalizedAt:new Date(),revision:{increment:1}}});const result={revision:s.revision+1};
  await tx.$queryRaw`SELECT set_config('outclass.voting_finalization','',true)`;
  const finalRows=await tx.application.findMany({where:{clubId:d.clubId,id:{in:plan.changes.filter(c=>c.outcome==="ACCEPT"||c.outcome==="REJECT").map(c=>c.applicationId)}}});
  await tx.auditLog.create({data:{clubId:d.clubId,actorId:user.id,targetId:s.id,action:"voting.room.finalized",details:{mapping:d.mapping,changes:plan.changes.map(({label:_label,...change})=>change),finalGuards:finalRows.map(a=>({applicationId:a.id,guard:decisionPublicationGuard(a)})),notifications:"DEFERRED"}}});await tx.votingRoomCommand.create({data:{...key,actorId:user.id,fingerprint,result}});return result;
 },votingWriteLimits)};}catch(e){if(e instanceof Error&&/^(Session changed|Applicant or pipeline|Application changed since|Choose an active)/.test(e.message))return {ok:false as const,message:e.message};throw e;}
}
/** Separately confirmed delivery uses the existing decision/notification outbox;
 * finalization never calls this action. Exact current decisions are rechecked. */
export async function sendLiveVotingNotifications(input:unknown){
 const d=roomScope.extend({requestId:z.string().uuid(),confirmed:z.literal(true)}).parse(input),{user}=await requireClubPermission(d.clubId,[...caps]);
 return clubWriteTransaction(async tx=>{
  const m=await authorizeClubTransaction(tx,d.clubId,user.id,caps),{s}=await loadVotingRoom(tx,d.clubId,d.sessionId);requireRoomLeader(s,m,"decisions.publish");
  if(!s.finalizedAt)throw Error("Finalize before preparing applicant messages.");
  const fingerprint=roomFingerprint(d),key={sessionId:s.id,requestId:d.requestId},prior=await tx.votingRoomCommand.findUnique({where:{sessionId_requestId:key}});
  if(prior){if(prior.actorId!==user.id||prior.fingerprint!==fingerprint)throw Error("Request ID reused with different content.");return z.object({sent:z.number().int().nonnegative()}).parse(prior.result);}
  const audit=await tx.auditLog.findFirst({where:{clubId:d.clubId,targetId:s.id,action:"voting.room.finalized"},orderBy:{createdAt:"desc"}});
  const record=z.object({finalGuards:z.array(z.object({applicationId:z.string(),guard:z.string()}))}).parse(audit?.details);
  const rows=await tx.application.findMany({where:{clubId:d.clubId,id:{in:record.finalGuards.map(r=>r.applicationId)}}});
  if(rows.length!==record.finalGuards.length||rows.some(a=>a.recruitmentCycleId!==s.cycleId||decisionPublicationGuard(a)!==record.finalGuards.find(r=>r.applicationId===a.id)?.guard))throw Error("Recruitment decisions changed. Review their current communication workflow before sending.");
  let sent=0;
  for(const a of rows){
   const final=["ACCEPTED","REJECTED"].includes(a.status),eventKey=final?`decision:${a.id}:${a.decisionVersion}`:`voting-round:${s.id}:${a.id}`;
   if(await tx.userNotification.findUnique({where:{userId_eventKey:{userId:a.studentId,eventKey}}}))continue;
   if(final)await publishDecisionCommunication(tx,a.id,user.id);
   else await tx.$queryRaw`SELECT outclass_notify(${a.studentId},${d.clubId},${eventKey},'APPLICATION','Application update','Your application has advanced. Open OutClass for your current round.','/?workspace=student&view=tracker')`;
   sent++;
  }
  const result={sent};await tx.auditLog.create({data:{clubId:d.clubId,actorId:user.id,targetId:s.id,action:"voting.room.notifications.requested",details:{count:sent}}});await tx.votingRoomCommand.create({data:{...key,actorId:user.id,fingerprint,result}});return result;
 },votingWriteLimits);
}
