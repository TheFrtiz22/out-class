import type { AppTransactionClient } from "@/utils/prisma";
import { roomOutcomes } from "@/lib/voting-room";
import { votingRecruitmentChange } from "@/lib/voting-finalization";
import { decisionPublicationGuard } from "@/lib/decision-publication-guard";
import { roomFingerprint,type LiveRoom } from "@/utils/voting-room";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";
import type { z } from "zod";
import type { finalizationMapping } from "@/lib/voting-room";
export async function votingFinalizationPlan(tx:AppTransactionClient,s:LiveRoom,mapping:z.infer<typeof finalizationMapping>){
 const round=await tx.pipelineRound.findFirst({where:{id:s.roundId,clubId:s.clubId,archivedAt:null}});
 const target=mapping.kind==="ADVANCE"?await tx.pipelineRound.findFirst({where:{id:mapping.roundId,clubId:s.clubId,archivedAt:null}}):null;
 if(!round||mapping.kind==="ADVANCE"&&(!target||target.order<=round.order))throw Error("Choose an active later recruitment round in this club.");
 const rows=await tx.application.findMany({where:{id:{in:s.candidates.map(c=>c.applicationId)},clubId:s.clubId},include:{round:true,student:{select:{studentProfile:{select:{firstName:true,lastName:true}}}}},orderBy:{id:"asc"}});
 const outcomes=roomOutcomes(s);
 const changes=s.candidates.map(c=>{
  const a=rows.find(a=>a.id===c.applicationId),outcome=outcomes.find(o=>o.applicationId===c.applicationId)!.outcome;
  if(!a||a.roundId!==s.roundId||a.recruitmentCycleId!==s.cycleId||a.status!==c.expectedStatus)throw Error("Application changed since voting began. Finalization cancelled; review recruitment state.");
  const change=votingRecruitmentChange(a.status,outcome,round.type,target),profile=a.student.studentProfile;
  return {applicationId:a.id,label:round.anonymousReview||a.round.anonymousReview?anonymousApplicantLabel(a.id):profile?`${profile.firstName} ${profile.lastName}`:"Applicant",outcome,fromStatus:a.status,toStatus:change.status,fromRoundId:a.roundId,toRoundId:change.roundId??a.roundId,guard:decisionPublicationGuard(a)};
 });
 const guard=roomFingerprint({revision:s.revision,mapping,round:{id:round.id,type:round.type,order:round.order,anonymous:round.anonymousReview},target:target?{id:target.id,type:target.type,order:target.order,anonymous:target.anonymousReview}:null,changes});
 return {guard,revision:s.revision,mapping,roundName:round.name,targetRoundName:target?.name??null,changes};
}
