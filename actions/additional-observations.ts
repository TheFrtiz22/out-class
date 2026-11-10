'use server';
import {prisma} from '@/utils/prisma';
import {requireClubPermission} from '@/utils/auth';
import {clubWriteTransaction} from '@/utils/club-write-transaction';
import {observationScope,observationSave,observationChange} from '@/lib/additional-observations';
import {authorizeObservation,listObservations} from '@/utils/additional-observations';
export async function getAdditionalObservations(input:unknown){
 const d=observationScope.parse(input),{user}=await requireClubPermission(d.clubId,['applications.review','applicants.identify']);
 return prisma.$transaction(tx=>listObservations(tx,d,user.id,true));
}
export async function saveAdditionalObservation(input:unknown){
 const d=observationSave.parse(input),{user}=await requireClubPermission(d.clubId,['applications.review','applicants.identify']);
 return clubWriteTransaction(async tx=>{
  const {app,moderator}=await authorizeObservation(tx,d,user.id,false,true);
  const old=await tx.applicantObservation.findUnique({where:{id:d.id}});
  if(old&&(old.applicationId!==app.id||old.clubId!==d.clubId||old.cycleId!==app.recruitmentCycleId||old.kind!=='ADDITIONAL'))throw Error('Observation unavailable.');
  const locked=!!old&&!!await tx.votingObservationReference.findFirst({where:{observationId:old.id},select:{sessionId:true}});
  const change=observationChange(old,d,user.id,moderator,locked);if(!change)return {id:d.id,revision:old!.revision};
  const content={body:d.body,interactionContext:d.interactionContext,revision:change.revision,history:change.history,deletedAt:d.remove?new Date():null};
  if(old)await tx.applicantObservation.update({where:{id:old.id},data:content});
  else await tx.applicantObservation.create({data:{...content,id:d.id,applicationId:app.id,authorId:user.id,clubId:d.clubId,cycleId:app.recruitmentCycleId,roundId:app.roundId,kind:'ADDITIONAL',anonymousReview:false}});
  await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:d.id,action:old&&(old.authorId!==user.id||locked)?'applicant.additional_observation.moderate':d.remove?'applicant.additional_observation.remove':old?'applicant.additional_observation.update':'applicant.additional_observation.share',details:{applicationId:app.id,revision:change.revision,reason:d.reason,removed:d.remove,locked}}});
  return {id:d.id,revision:change.revision};
 });
}
