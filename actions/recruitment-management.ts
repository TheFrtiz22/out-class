"use server";
import {z} from "zod";
import {decisionPublicationGuard} from "@/lib/decision-publication-guard";
import {requireClubPermission} from "@/utils/auth";
import {clubWriteTransaction} from "@/utils/club-write-transaction";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
import {START_NEXT_CYCLE_ACTION,nextCycleDeadline,undecidedApplicationStatuses} from "@/lib/recruitment-cycle";
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
  // Reopening is unavailable once the student has re-applied: review their current application instead.
  if(await tx.application.findFirst({where:{studentId:app.studentId,clubId:d.clubId,status:{not:"REJECTED"}},select:{id:true}}))throw Error("This student has re-applied. Review their current application instead.");
  const result=await tx.application.updateMany({where:{id:app.id,clubId:d.clubId,status:"REJECTED",decisionVersion:app.decisionVersion,decisionStateRevision:app.decisionStateRevision},data:{status:"IN_REVIEW",decisionVersion:{increment:1}}});
  if(result.count!==1)throw Error("Rejected application changed or unavailable.");
  await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:d.applicationId,action:"recruitment.reconsidered",reason:d.reason,details:{previousStatus:"REJECTED",status:"IN_REVIEW",previousVersion:app.decisionVersion}}});
  return {success:true};
 });
}
const startNextCycleInput=z.object({id:uuid,clubId:uuid,sourceCycleId:uuid,name:z.string().trim().min(1).max(100)}).strict();
/**
 * Start the next recruitment cycle from the last one in one transaction.
 * Configuration is club-scoped and stays in place for the new cycle (see
 * nextCycleCarriesForward); nothing applicant-side is read into or written for
 * the new cycle. The source cycle is archived so new submissions join only the
 * new cycle, and a passed application deadline is left unset. The link to the
 * source is the audit entry. `id` is generated once per form, so a double
 * submit replays instead of creating a second cycle.
 */
export async function startRecruitmentCycleFromPrevious(input:unknown){
 const d=startNextCycleInput.parse(input);
 const {user}=await requireClubPermission(d.clubId,["recruitment.manage"]);
 return clubWriteTransaction(async tx=>{
  // Takes the club row FOR UPDATE and rechecks suspension: concurrent starts for one club run one at a time.
  await authorizeClubTransaction(tx,d.clubId,user.id,["recruitment.manage"]);
  const existing=await tx.recruitmentCycle.findUnique({where:{id:d.id}});
  if(existing){
   const prior=existing.clubId===d.clubId?await tx.auditLog.findFirst({where:{clubId:d.clubId,targetId:d.id,action:START_NEXT_CYCLE_ACTION},select:{details:true}}):null;
   if((prior?.details as {sourceCycleId?:unknown}|null|undefined)?.sourceCycleId!==d.sourceCycleId)throw Error("Cycle unavailable.");
   return {success:true as const,id:d.id,replayed:true};
  }
  const source=await tx.recruitmentCycle.findFirst({where:{id:d.sourceCycleId,clubId:d.clubId}});
  if(!source)throw Error("Cycle unavailable.");
  if(await tx.recruitmentCycle.count({where:{clubId:d.clubId,archivedAt:null,id:{not:source.id}}}))
   throw Error("Archive the club's other open cycles first, so new applications join only the new cycle.");
  if(await tx.recruitmentCycle.findFirst({where:{clubId:d.clubId,name:d.name},select:{id:true}}))throw Error("A cycle with this name already exists.");
  const archiveSource=!source.archivedAt;
  if(archiveSource){
   if(await tx.application.count({where:{clubId:d.clubId,recruitmentCycleId:source.id,status:{in:[...undecidedApplicationStatuses]}}}))
    throw Error(`${source.name} still has undecided applications. Record their decisions before starting the next cycle.`);
   const archived=await tx.recruitmentCycle.updateMany({where:{id:source.id,clubId:d.clubId,archivedAt:null},data:{archivedAt:new Date()}});
   if(archived.count!==1)throw Error("Cycle changed. Reload and try again.");
  }
  const club=await tx.club.findUniqueOrThrow({where:{id:d.clubId},select:{applicationDeadline:true,decisionLetterTemplates:true}});
  const clearedApplicationDeadline=!!club.applicationDeadline&&!nextCycleDeadline(club.applicationDeadline,new Date());
  if(clearedApplicationDeadline)await tx.club.update({where:{id:d.clubId},data:{applicationDeadline:null,applicationVersion:{increment:1}}});
  await tx.recruitmentCycle.create({data:{id:d.id,clubId:d.clubId,name:d.name}});
  const rounds=await tx.pipelineRound.findMany({where:{clubId:d.clubId,archivedAt:null},select:{id:true,interviewKit:true}});
  const carriedForward={
   questions:await tx.applicationQuestion.count({where:{clubId:d.clubId,archivedAt:null}}),
   rounds:rounds.length,
   interviewKits:rounds.filter(r=>Array.isArray(r.interviewKit)&&r.interviewKit.length>0).length,
   screeningRules:await tx.recruitingRule.count({where:{round:{clubId:d.clubId,archivedAt:null}}}),
   votingRuleDefaults:await tx.votingRuleDefault.count({where:{clubId:d.clubId}}),
   decisionLetterTemplates:club.decisionLetterTemplates!==null,
  };
  await tx.auditLog.create({data:{actorId:user.id,clubId:d.clubId,targetId:d.id,action:START_NEXT_CYCLE_ACTION,details:{name:d.name,sourceCycleId:source.id,sourceCycleName:source.name,archivedSourceCycle:archiveSource,clearedApplicationDeadline,carriedForward}}});
  return {success:true as const,id:d.id,replayed:false,archivedSourceCycle:archiveSource,clearedApplicationDeadline,carriedForward};
 });
}
