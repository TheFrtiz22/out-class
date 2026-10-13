"use server"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { prisma, type AppTransactionClient } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { interviewCapabilities } from "@/lib/interview-access"
import { panelScopeSchema, panelDocumentSchema, panelScheduleChanges, mergePanelPublication, publishedPanelDocumentSchema, type PanelApprovalReview, type PanelDocument } from "@/lib/panel-proposals"
import { loadPanelPlanningScene } from "@/utils/panel-planning"
import { activePanelPublication, assertCurrentPanelDocument, assertPanelBookingSafety, publicationDocument, panelPublicationLock, PanelPublicationError, draftApprovalReset } from "@/utils/panel-publication"
import { syncBookingPanel,type BookingPanelBatch } from "@/utils/interview-scheduling-access"
import { panelScheduleNotificationPrefix } from "@/utils/official-panel-schedule"
const draftScope=panelScopeSchema.extend({proposalId:z.string().uuid(),revision:z.number().int().positive()}).strict()
type Result<T>={ok:true;value:T}|{ok:false;error:string}
async function operation<T>(clubId:string,owner:boolean,publishing:boolean,work:(tx:AppTransactionClient,actorId:string)=>Promise<T>):Promise<Result<T>>{
 try{
  const {user}=await requireAuth({verifyEmail:owner})
  for(let attempt=0;;attempt++)try{
   const value=await prisma.$transaction(async tx=>{
    if(publishing)await panelPublicationLock(tx)
    const member=await authorizeClubTransaction(tx,clubId,user.id,["interviews.manage"])
    if(owner&&!interviewCapabilities(member).manageGrants)throw new PanelPublicationError("Only a current club owner can approve panel access and publish schedules.")
    if(!publishing)await tx.$queryRaw`SELECT set_config('outclass.panel_proposal_mode','unpublished',true)`
    return work(tx,user.id)
   },{isolationLevel:publishing?"ReadCommitted":"Serializable",timeout:60000,maxWait:15000})
   return{ok:true,value}
  }catch(error){if(error&&typeof error==="object"&&"code"in error&&error.code==="P2034"&&attempt<2)continue;throw error}
 }catch(error){return{ok:false,error:error instanceof PanelPublicationError?error.message:"Could not complete this action. Your draft and current schedule are retained. Reload to check permissions and current revisions."}}
}
async function draftFor(tx:AppTransactionClient,input:z.infer<typeof draftScope>){
 const row=await tx.interviewPanelProposal.findFirst({where:{id:input.proposalId,clubId:input.clubId,roundId:input.roundId}})
 if(!row||row.revision!==input.revision)throw new PanelPublicationError("The draft changed in another tab. Reload before reviewing or publishing.")
 const active=await activePanelPublication(tx,{clubId:input.clubId,roundId:input.roundId})
 if(row.basePublishedVersion!==(active?.version??0))throw new PanelPublicationError("A newer schedule was published. The current version remains active; reopen it before making changes.")
 return{row,active,document:panelDocumentSchema.parse(row.document)}
}
function currentOfficialDocument(previous:PanelDocument|null,document:PanelDocument,live:Awaited<ReturnType<typeof loadPanelPlanningScene>>){
 const oldScope={...document,sessions:live.scene.sessions.filter(s=>document.sessions.some(d=>d.id===s.id)),assignments:live.scene.sessions.flatMap(s=>document.sessions.some(d=>d.id===s.id)?s.existingMemberIds.map(memberId=>({slotId:s.id,memberId,locked:false,source:"EXISTING" as const})):[])}
 return mergePanelPublication(previous,oldScope)
}
export async function beginPanelScheduleRevision(raw:unknown){
 const input=panelScopeSchema.extend({publishedVersion:z.number().int().positive(),restoreVersion:z.number().int().positive().optional()}).strict().parse(raw)
 return operation(input.clubId,false,false,async(tx,actorId)=>{
  const active=await activePanelPublication(tx,input)
  if(!active||active.version!==input.publishedVersion)throw new PanelPublicationError("The published version changed. Reload before opening a revision.")
  if(await tx.interviewPanelProposal.findUnique({where:{roundId_clubId:{roundId:input.roundId,clubId:input.clubId}}}))throw new PanelPublicationError("A working revision already exists. Open the saved draft or discard it before restoring another version.")
  const restore=input.restoreVersion?await tx.interviewPanelScheduleVersion.findFirst({where:{clubId:input.clubId,roundId:input.roundId,version:input.restoreVersion}}):active
  if(!restore)throw new PanelPublicationError("Choose a published revision from this round's history.")
  const source=publicationDocument(restore)!,live=await loadPanelPlanningScene(tx,input)
  if(!live.window||!live.scene.sessions.some(s=>s.active))throw new PanelPublicationError("There are no upcoming open sessions to revise.")
  const sessions=live.scene.sessions.filter(s=>s.active).map(s=>{const previous=source.sessions.find(old=>old.id===s.id);return input.restoreVersion&&previous?{...previous,originalRequired:s.required,roomRevision:s.roomRevision,slotRevision:s.slotRevision}:{...s,originalRequired:s.required}}),ids=new Set(sessions.map(s=>s.id))
  const assignments=input.restoreVersion?source.assignments.filter(a=>ids.has(a.slotId)):sessions.flatMap(s=>s.existingMemberIds.map(memberId=>({slotId:s.id,memberId,locked:false,source:"EXISTING" as const})))
  const document:PanelDocument=panelDocumentSchema.parse({version:1,window:live.window,options:source.options,sessions,assignments})
  const {validatePanelDocument,panelDraftScene}=await import("@/lib/panel-proposals")
  const row=await tx.interviewPanelProposal.create({data:{clubId:input.clubId,roundId:input.roundId,basePublishedVersion:active.version,createdBy:actorId,modifiedBy:actorId,document,validation:validatePanelDocument(document,panelDraftScene(document,live.scene)),sourceFingerprint:live.fingerprint}})
  await tx.auditLog.create({data:{actorId,clubId:input.clubId,targetId:row.id,action:"interview.panel-proposal.revise",details:{baseVersion:active.version,restoreVersion:input.restoreVersion}}})
  return{proposalId:row.id}
 })
}
export async function revalidatePanelDraft(raw:unknown){
 const input=draftScope.parse(raw)
 return operation(input.clubId,false,false,async(tx,actorId)=>{
  const {row,document}=await draftFor(tx,input),live=await loadPanelPlanningScene(tx,input,document.window)
  const validation=assertCurrentPanelDocument(document,live.scene)
  const saved=await tx.interviewPanelProposal.update({where:{id:row.id},data:{...draftApprovalReset,validation,sourceFingerprint:live.fingerprint,modifiedBy:actorId,revision:{increment:1}}})
  return{revision:saved.revision}
 })
}
export async function reviewPanelPublication(raw:unknown):Promise<Result<PanelApprovalReview>>{
 const input=draftScope.parse(raw)
 return operation(input.clubId,true,false,async(tx,actorId)=>{
  const {row,document,active}=await draftFor(tx,input),live=await loadPanelPlanningScene(tx,input,document.window)
  const validation=assertCurrentPanelDocument(document,live.scene)
  if(row.sourceFingerprint!==live.fingerprint)throw new PanelPublicationError("Availability, eligibility, official commitments or room configuration changed. Revalidate the draft and review it again.")
  const round=await tx.pipelineRound.findUniqueOrThrow({where:{id:input.roundId}})
  if(round.anonymousReview)throw new PanelPublicationError("Panel access publication requires an identified interview round. Review privacy settings with the owner first.")
  await assertPanelBookingSafety(tx,input,document)
  const club=await tx.club.findUniqueOrThrow({where:{id:input.clubId},select:{name:true}}),approvalToken=randomUUID(),changes=panelScheduleChanges(currentOfficialDocument(publicationDocument(active),document,live),mergePanelPublication(publicationDocument(active),document))
  const ready=await tx.interviewPanelProposal.update({where:{id:row.id},data:{status:"READY_FOR_APPROVAL",approvalToken,readyBy:actorId,readyAt:new Date(),validation,modifiedBy:actorId,revision:{increment:1}}})
  await tx.auditLog.create({data:{actorId,clubId:input.clubId,targetId:row.id,action:"interview.panel-proposal.ready",details:{revision:ready.revision}}})
  return{proposalId:row.id,revision:ready.revision,approvalToken,clubName:club.name,roundName:live.roundName,rooms:new Set(document.sessions.map(s=>s.roomId)).size,sessions:document.sessions.length,required:validation.required,filled:validation.filled,unfilled:validation.required-validation.filled,conflicts:validation.issues.length,canOverride:true,overrideWarning:validation.filled<validation.required?"This schedule is understaffed. Booked sessions retain at least one qualified interviewer; unstaffed sessions will not be offered for booking. Confirm that the remaining panels can support the existing applicant capacity.":null,changes,previousVersion:active?.version??0}
 })
}
export async function publishPanelSchedule(raw:unknown){
 const input=draftScope.extend({approvalToken:z.string().uuid(),understaffedOverride:z.boolean().default(false),overrideReason:z.string().trim().max(1000).optional()}).strict().parse(raw)
 return operation(input.clubId,true,true,async(tx,actorId)=>{
  const prior=await tx.interviewPanelScheduleVersion.findUnique({where:{approvalToken:input.approvalToken}})
  if(prior){if(prior.clubId!==input.clubId||prior.roundId!==input.roundId||prior.publishedBy!==actorId||prior.sourceProposalId!==input.proposalId||prior.sourceProposalRevision!==input.revision)throw new PanelPublicationError("This approval belongs to a different publication.");return{publicationId:prior.id,version:prior.version,idempotent:true}}
  const {row,document,active}=await draftFor(tx,input)
  if(row.status!=="READY_FOR_APPROVAL"||row.approvalToken!==input.approvalToken||row.readyBy!==actorId)throw new PanelPublicationError("Review this draft and explicitly confirm publication as the approving owner.")
  // Cross-club publications serialize globally; identity locks also hold account disable and applicant booking mutations.
  const candidateMembers=await tx.clubMember.findMany({where:{id:{in:document.assignments.map(a=>a.memberId)},clubId:input.clubId}})
  for(const userId of [...new Set(candidateMembers.map(m=>m.userId))].sort())await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`
  const live=await loadPanelPlanningScene(tx,input,document.window),validation=assertCurrentPanelDocument(document,live.scene)
  if(row.sourceFingerprint!==live.fingerprint)throw new PanelPublicationError("This approval is stale. Revalidate and review the draft again; the current schedule is unchanged.")
  const bookings=await assertPanelBookingSafety(tx,input,document),understaffed=validation.filled<validation.required
  if(understaffed&&(!input.understaffedOverride||!input.overrideReason||input.overrideReason.length<10))throw new PanelPublicationError("Staffing is incomplete. A safe publication requires an explicit understaffing override and a reason of at least 10 characters.")
  const before=currentOfficialDocument(publicationDocument(active),document,live),combined=publishedPanelDocumentSchema.parse(mergePanelPublication(publicationDocument(active),document)),changes=panelScheduleChanges(before,combined),publicationId=randomUUID()
  await tx.$queryRaw`SELECT set_config('outclass.panel_publication_id',${publicationId},true)`
  const version=await tx.interviewPanelScheduleVersion.create({data:{id:publicationId,clubId:input.clubId,roundId:input.roundId,version:(active?.version??0)+1,previousVersion:active?.version??0,sourceProposalId:row.id,sourceProposalRevision:row.revision,approvalToken:input.approvalToken,publishedBy:actorId,document:combined,changes,sourceFingerprint:live.fingerprint,understaffedOverride:understaffed,overrideReason:understaffed?input.overrideReason!:null}})
  if(active)await tx.interviewPanelScheduleVersion.update({where:{id:active.id},data:{status:"SUPERSEDED"}})
  const slotGroups=new Map<string,{ids:string[];memberIds:string[];required:number}>()
  for(const s of document.sessions){const memberIds=document.assignments.filter(a=>a.slotId===s.id).map(a=>a.memberId).sort(),key=JSON.stringify([s.required,memberIds]),group=slotGroups.get(key);if(group)group.ids.push(s.id);else slotGroups.set(key,{ids:[s.id],memberIds,required:s.required})}
  for(const group of slotGroups.values()){const changed=await tx.interviewSlot.updateMany({where:{id:{in:group.ids},clubId:input.clubId},data:{panelScheduleVersionId:version.id,publishedPanelMemberIds:group.memberIds,interviewersNeeded:group.required}});if(changed.count!==group.ids.length)throw new PanelPublicationError("A session changed during publication. Reload and review again.")}
  const updated=await tx.pipelineRound.updateMany({where:{id:input.roundId,clubId:input.clubId,panelScheduleRevision:row.basePublishedVersion},data:{panelScheduleRevision:{increment:1}}})
  if(updated.count!==1)throw new PanelPublicationError("Another schedule was published concurrently. Reload the current version.")
  const batch:BookingPanelBatch={grants:[],audits:[]}
  for(const booking of bookings){await tx.$queryRaw`SELECT id FROM "Application" WHERE id=${booking.applicationId} FOR UPDATE`;const assigned=document.assignments.filter(a=>a.slotId===booking.slotId).map(a=>a.memberId);await syncBookingPanel(tx,booking.applicationId,input.roundId,actorId,{notify:false,batch,context:{app:booking.application,existing:booking.application.interviewAssignments,booking:{...booking,slot:{...booking.slot,panelScheduleVersion:version,panelScheduleVersionId:version.id,publishedPanelMemberIds:assigned}},members:candidateMembers,approvedBy:actorId}})}
  if(batch.grants.length)await tx.interviewPanelAssignment.createMany({data:batch.grants})
  if(batch.audits.length)await tx.auditLog.createMany({data:batch.audits})
  const affected=[...new Set(changes.flatMap(c=>c.memberId?[c.memberId]:[]))],members=await tx.clubMember.findMany({where:{id:{in:affected},clubId:input.clubId,status:"ACTIVE",user:{disabledAt:null}}})
  // These intents commit with the publication; the existing worker performs provider I/O after commit.
  if(members.length)await tx.userNotification.createMany({data:members.map(m=>({userId:m.userId,clubId:input.clubId,eventKey:`${panelScheduleNotificationPrefix}${version.id}:${m.id}`,type:"INTERVIEW",title:"Interview panel schedule updated",body:"An approved interview panel schedule changed. Open your interview schedule to review your assignments.",href:`/settings/interviews?clubId=${input.clubId}&roundId=${input.roundId}`})),skipDuplicates:true})
  await tx.auditLog.create({data:{actorId,clubId:input.clubId,targetId:version.id,action:"interview.panels.publish",details:{previousVersion:version.previousVersion,version:version.version,proposalId:row.id,revision:row.revision,changes,understaffedOverride:understaffed,overrideReason:understaffed?input.overrideReason:null,notifiedMembers:affected}}})
  await tx.interviewPanelProposal.delete({where:{id:row.id}})
  return{publicationId:version.id,version:version.version,idempotent:false}
 })
}
