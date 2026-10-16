import type {AppTransactionClient} from "@/utils/prisma";
import { decisionSnapshotSchema, MAX_SCHEDULED_DECISIONS } from "@/lib/decision-schedule";
import {audienceKey} from "@/lib/recipient-audience";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
import {publishRecruitmentDecision} from "@/utils/recruitment-offers";
import {publishReviewedVotingCandidates} from "@/utils/voting-publication";
export const decisionCapabilities=["decisions.manage","applicants.identify"] as const;
export function roundPublicationKey(r:{id:string;type:string;anonymousReview:boolean;archivedAt:Date|null;configuration:unknown}){
 return audienceKey({id:r.id,type:r.type,anonymousReview:r.anonymousReview,archivedAt:r.archivedAt?.toISOString()??null,configuration:r.configuration});
}
export async function publishScheduledDecision(tx:AppTransactionClient,row:{clubId:string;senderId:string;snapshot:unknown}){
 const snapshot=decisionSnapshotSchema.parse(row.snapshot);
 if(snapshot.applications.length>MAX_SCHEDULED_DECISIONS)throw Error("Decision batch exceeds worker limit.");
 await authorizeClubTransaction(tx,row.clubId,row.senderId,snapshot.voting?["applications.review","decisions.publish","applicants.identify"]:[...decisionCapabilities]);
 // Validate the entire batch before writing anything. Version guards prevent ABA
 // changes, including reconsideration followed by a return to the same status.
 const ids=snapshot.applications.map(a=>a.id);
 await tx.$queryRaw`SELECT u.id FROM "User" u JOIN "Application" a ON a."studentId"=u.id WHERE a."clubId"=${row.clubId} AND a.id=ANY(${ids}::text[]) ORDER BY u.id FOR SHARE OF u`;
 const apps=await tx.application.findMany({where:{clubId:row.clubId,id:{in:snapshot.applications.map(a=>a.id)}},include:{round:true,student:{select:{disabledAt:true}}}});
 for(const expected of snapshot.applications){
  const app=apps.find(a=>a.id===expected.id);
  if(!app||app.student.disabledAt||app.status!==expected.status||app.decisionVersion!==expected.version||app.decisionStateRevision!==expected.stateRevision||app.roundId!==expected.roundId||app.round.archivedAt||roundPublicationKey(app.round)!==expected.roundKey)throw Error("Decision state changed. Review and schedule again.");
 }
 if(snapshot.voting){
  await tx.$queryRaw`SELECT id FROM "VotingSession" WHERE id=${snapshot.voting.id} AND "clubId"=${row.clubId} FOR UPDATE`;
  const session=await tx.votingSession.findFirst({where:{id:snapshot.voting.id,clubId:row.clubId},include:{candidates:{where:{applicationId:{in:ids}},take:MAX_SCHEDULED_DECISIONS}}});
  if(!session||session.revision!==snapshot.voting.revision)throw Error("Voting session changed.");
  await publishReviewedVotingCandidates(tx,session,ids,snapshot.applications.map(a=>({applicationId:a.id,passNumber:a.passNumber,outcome:a.decision==="ACCEPTED"?"PASS":a.decision==="WAITLISTED"?"HOLD":"NOT_PASS",automatic:false})),row.senderId,snapshot.settings,Object.fromEntries(snapshot.applications.map(a=>[a.id,{firstName:a.firstName,fullName:a.fullName}])));
  await tx.votingSession.update({where:{id:session.id},data:{publishedAt:new Date(),publishedBy:row.senderId,revision:{increment:1}}});
  await tx.auditLog.create({data:{actorId:row.senderId,clubId:row.clubId,targetId:session.id,action:"voting.publish",details:{applicationIds:snapshot.applications.map(a=>a.id),scheduled:true}}});
 }else{
  for(const app of snapshot.applications)await publishRecruitmentDecision(tx,{clubId:row.clubId,applicationId:app.id,status:app.decision,expectedStatus:app.status,roundId:app.roundId},row.senderId,snapshot.settings,{firstName:app.firstName,fullName:app.fullName});
 }
 return snapshot.applications.length;
}