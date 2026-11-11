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
 const label=(a:(typeof rows)[number]|undefined,id:string)=>{const profile=a?.student.studentProfile;return !a||round.anonymousReview||a.round.anonymousReview?anonymousApplicantLabel(id):profile?`${profile.firstName} ${profile.lastName}`:"Applicant";};
 // Applicants whose recruitment state moved since the session began are listed
 // individually and block finalization; nothing is changed for anyone.
 const stale:{applicationId:string;label:string;outcome:string;reason:string}[]=[];
 const changes=s.candidates.flatMap(c=>{
  const a=rows.find(a=>a.id===c.applicationId),outcome=outcomes.find(o=>o.applicationId===c.applicationId)!.outcome;
  const reason=!a?"no longer available":a.recruitmentCycleId!==s.cycleId?"moved to another recruitment cycle":a.roundId!==s.roundId?`moved to ${a.round.name} after this session began`:a.status!==c.expectedStatus?`status changed from ${c.expectedStatus} to ${a.status}`:null;
  if(reason){stale.push({applicationId:c.applicationId,label:label(a,c.applicationId),outcome,reason});return [];}
  const change=votingRecruitmentChange(a!.status,outcome,round.type,target);
  return [{applicationId:a!.id,label:label(a,a!.id),outcome,fromStatus:a!.status,toStatus:change.status,fromRoundId:a!.roundId,toRoundId:change.roundId??a!.roundId,guard:decisionPublicationGuard(a!)}];
 });
 // Admission from a round that has later active rounds is allowed but must be explicit.
 const laterRounds=await tx.pipelineRound.count({where:{clubId:s.clubId,archivedAt:null,order:{gt:round.order}}});
 const guard=roomFingerprint({revision:s.revision,mapping,round:{id:round.id,type:round.type,order:round.order,anonymous:round.anonymousReview},target:target?{id:target.id,type:target.type,order:target.order,anonymous:target.anonymousReview}:null,changes,stale});
 return {guard,revision:s.revision,mapping,roundName:round.name,roundType:round.type,targetRoundName:target?.name??null,laterRounds,changes,stale};
}
