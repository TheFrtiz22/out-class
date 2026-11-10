import type {AppTransactionClient} from '@/utils/prisma';
import {authorizeClubTransaction} from '@/lib/club-transaction-authorization';
import {hasPermission} from '@/lib/permissions';
import {interviewCapabilities} from '@/lib/interview-access';
import {assertNotRecused} from '@/lib/recusal';
import {observationSnapshot,type AdditionalObservation} from '@/lib/additional-observations';
/** refuseRecused: member-facing reads and writes refuse a member who stepped out of this applicant.
 * Voting-session snapshots and room projections keep the room's own rules. */
export async function authorizeObservation(tx:AppTransactionClient,scope:{clubId:string;applicationId:string},userId:string,readOnly=false,refuseRecused=false){
 const member=await authorizeClubTransaction(tx,scope.clubId,userId,['applications.review','applicants.identify'],{readOnly});
 const app=await tx.application.findFirst({where:{id:scope.applicationId,clubId:scope.clubId,status:{not:'DRAFTING'}},include:{round:true}});
 if(!app||!app.recruitmentCycleId||app.studentId===userId||app.round.anonymousReview||!hasPermission(member,'applicants.identify'))throw Error('Additional observations are unavailable. An authorized identified applicant in a recruitment cycle is required.');
 if(refuseRecused)await assertNotRecused(tx,app.id,member.id);
 return {app,member,moderator:interviewCapabilities(member).moderateResume};
}
export async function observationRows(tx:AppTransactionClient,scope:{clubId:string;applicationId:string;cycleId:string|null}){
 return tx.applicantObservation.findMany({where:{applicationId:scope.applicationId,clubId:scope.clubId,cycleId:scope.cycleId,kind:'ADDITIONAL',deletedAt:null},include:{author:{select:{studentProfile:{select:{firstName:true,lastName:true}}}},presentationReferences:{select:{sessionId:true},take:1}},orderBy:[{createdAt:'asc'},{id:'asc'}]});
}
export async function listObservations(tx:AppTransactionClient,scope:{clubId:string;applicationId:string},userId:string,refuseRecused=false):Promise<AdditionalObservation[]>{
 const {app,moderator}=await authorizeObservation(tx,scope,userId,true,refuseRecused),rows=await observationRows(tx,{...scope,cycleId:app.recruitmentCycleId});
 const rounds=await tx.pipelineRound.findMany({where:{clubId:scope.clubId,anonymousReview:false,id:{in:[...new Set(rows.flatMap(r=>r.roundId?[r.roundId]:[]))]}},select:{id:true,name:true}});
 return rows.filter(row=>rounds.some(r=>r.id===row.roundId)).map(row=>{const p=row.author.studentProfile,locked=!!row.presentationReferences.length;return {id:row.id,revision:row.revision,body:row.body,interactionContext:row.interactionContext??'',author:p?`${p.firstName} ${p.lastName}`:'Club reviewer',createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),roundId:row.roundId,roundName:rounds.find(r=>r.id===row.roundId)!.name,locked,canEdit:row.authorId===userId&&!locked,canModerate:moderator};});
}
/** Called once inside START's club/session transaction, before the first pass.
 * An empty reference list in a started session stays empty; later observations
 * never appear retroactively in that presentation. */
export async function lockVotingObservations(tx:AppTransactionClient,s:{id:string;clubId:string;cycleId:string|null;roundId:string;candidates:{applicationId:string}[]},userId:string){
 for(const candidate of s.candidates){
  const rows=await listObservations(tx,{clubId:s.clubId,applicationId:candidate.applicationId},userId);
  if(rows.length)await tx.votingObservationReference.createMany({data:rows.map(row=>({sessionId:s.id,observationId:row.id,applicationId:candidate.applicationId,revision:row.revision,snapshot:observationSnapshot.parse(row)}))});
 }
}
/** Room and current applicant authorization must precede this projection. */
export async function votingObservations(tx:AppTransactionClient,s:{id:string;startedAt:Date|null;clubId:string;cycleId:string|null},applicationId:string,userId:string,selected:boolean,anonymous:boolean){
 if(!selected||anonymous)return {};
 const app=await tx.application.findFirst({where:{id:applicationId,clubId:s.clubId},select:{studentId:true}});if(app?.studentId===userId)return {};
 await authorizeObservation(tx,{clubId:s.clubId,applicationId},userId,true);
 let rows=s.startedAt?(await tx.votingObservationReference.findMany({where:{sessionId:s.id,applicationId},orderBy:[{createdAt:'asc'},{observationId:'asc'}]})).map(r=>observationSnapshot.parse(r.snapshot)):(await listObservations(tx,{clubId:s.clubId,applicationId},userId)).map(r=>observationSnapshot.parse(r));
 const rounds=await tx.pipelineRound.findMany({where:{clubId:s.clubId,anonymousReview:false,id:{in:rows.flatMap(r=>r.roundId?[r.roundId]:[])}},select:{id:true}});rows=rows.filter(row=>rounds.some(r=>r.id===row.roundId));
 return {additionalObservations:rows};
}
