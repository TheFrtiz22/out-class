"use server";
import {z} from "zod";
import {decisionPublicationGuard} from "@/lib/decision-publication-guard";
import {requireClubPermission} from "@/utils/auth";
import {clubWriteTransaction} from "@/utils/club-write-transaction";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
const uuid=z.string().uuid();
export async function getRecruitmentCycles(clubId:string){
 uuid.parse(clubId);const {user}=await requireClubPermission(clubId,["recruitment.manage"]);
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,clubId,user.id,["recruitment.manage"],{readOnly:true});
  return tx.recruitmentCycle.findMany({where:{clubId},orderBy:{createdAt:"desc"}});
 });
}
export async function saveRecruitmentCycle(input:unknown){
 const d=z.object({id:uuid,clubId:uuid,name:z.string().trim().min(1).max(100),archived:z.boolean()}).strict().parse(input);
 const {user}=await requireClubPermission(d.clubId,["recruitment.manage"]);
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,d.clubId,user.id,["recruitment.manage"]);
  const existing=await tx.recruitmentCycle.findUnique({where:{id:d.id}});
  if(existing&&existing.clubId!==d.clubId)throw Error("Cycle unavailable.");
  await tx.recruitmentCycle.upsert({where:{id:d.id},create:{id:d.id,clubId:d.clubId,name:d.name,archivedAt:d.archived?new Date():null},update:{name:d.name,archivedAt:d.archived?existing?.archivedAt??new Date():null}});
  await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:d.id,action:"recruitment.cycle.saved",details:{name:d.name,archived:d.archived}}});
  return {success:true};
 });
}
export async function assignApplicationCycle(input:unknown){
 const d=z.object({clubId:uuid,applicationId:uuid,cycleId:uuid.nullable(),expectedCycleId:uuid.nullable()}).strict().parse(input);
 const {user}=await requireClubPermission(d.clubId,["recruitment.manage","applications.review","applicants.identify"]);
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,d.clubId,user.id,["recruitment.manage","applications.review","applicants.identify"]);
  if(d.cycleId&&!await tx.recruitmentCycle.findFirst({where:{id:d.cycleId,clubId:d.clubId,archivedAt:null}}))throw Error("Cycle unavailable.");
  const result=await tx.application.updateMany({where:{id:d.applicationId,clubId:d.clubId,status:{not:"DRAFTING"},recruitmentCycleId:d.expectedCycleId,round:{anonymousReview:false}},data:{recruitmentCycleId:d.cycleId}});
  if(result.count!==1)throw Error("Application changed or unavailable.");
  await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:d.applicationId,action:"recruitment.cycle.assigned",details:{previous:d.expectedCycleId,cycleId:d.cycleId}}});
  return {success:true};
 });
}
/** Explicit reconsideration preserves all submitted material and immutable decisions. */
export async function reconsiderRejectedApplication(input:unknown){
 const d=z.object({clubId:uuid,applicationId:uuid,expectedGuard:z.string().regex(/^[a-f0-9]{64}$/),reason:z.string().trim().min(10).max(1000)}).strict().parse(input);
 const {user}=await requireClubPermission(d.clubId,["decisions.manage","applicants.identify"]);
 return clubWriteTransaction(async tx=>{
  await authorizeClubTransaction(tx,d.clubId,user.id,["decisions.manage","applicants.identify"]);
  const app=await tx.application.findFirst({where:{id:d.applicationId,clubId:d.clubId,status:"REJECTED",round:{archivedAt:null}}});
  if(!app||decisionPublicationGuard(app)!==d.expectedGuard)throw Error("Rejected application changed or unavailable.");
  const result=await tx.application.updateMany({where:{id:app.id,clubId:d.clubId,status:"REJECTED",decisionVersion:app.decisionVersion,decisionStateRevision:app.decisionStateRevision},data:{status:"IN_REVIEW",decisionVersion:{increment:1}}});
  if(result.count!==1)throw Error("Rejected application changed or unavailable.");
  await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:d.applicationId,action:"recruitment.reconsidered",reason:d.reason,details:{previousStatus:"REJECTED",status:"IN_REVIEW",previousVersion:app.decisionVersion}}});
  return {success:true};
 });
}
