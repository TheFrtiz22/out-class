import type { InterviewPanelScheduleVersion } from "@prisma/client"
import type { AppTransactionClient } from "@/utils/prisma"
import { publishedPanelDocumentSchema, panelDocumentSchema, panelDraftScene, sameSessionTime, validatePanelDocument, type PanelDocument, type PanelPublishedView, type PanelScene, type PanelScheduleChange } from "@/lib/panel-proposals"

/**
 * A refusal whose message is written for leaders. `code` names the action that fixes it:
 * DRAFT_STALE needs the draft regenerated against current sessions; RECHECK_REQUIRED needs an
 * availability recheck before review.
 */
export class PanelPublicationError extends Error {
  constructor(message: string, readonly code: "DRAFT_STALE" | "RECHECK_REQUIRED" | "PANEL_REFUSED" = "PANEL_REFUSED") { super(message) }
}
export const staleDraftMessage = "Session times or staffing configuration changed. Regenerate the draft, then review it again."
/** Draft issues that regeneration resolves: positions on a session that closed, ended, was removed or moved. */
const staleIssueCodes = new Set(["SESSION_UNAVAILABLE", "SESSION_CHANGED"])
/**
 * Cross-club interview scheduling is consistent per person, not per platform.
 * Whether a session is bookable or a panel conflicts depends only on the official
 * commitments of the people involved (panelists, and an applicant's own bookings).
 * Every scheduling transaction first locks its club row (exclusively for club-wide
 * changes, shared for a single reservation), then calls this once, which locks the
 * people's User rows in one global (sorted id) order:
 * - exclusive: people whose official commitments this transaction adds to;
 * - shared: people whose commitments it only reads to decide.
 * Removing commitments (cancelling, closing, replacing a panel member) only frees
 * time elsewhere, so it needs no person lock.
 */
export async function lockSchedulingPeople(tx: Pick<AppTransactionClient, "$queryRaw">, people: { exclusive?: readonly string[]; shared?: readonly string[] }) {
  const exclusive = new Set(people.exclusive ?? [])
  for (const id of [...new Set([...exclusive, ...(people.shared ?? [])])].sort()) {
    if (exclusive.has(id)) await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id} FOR UPDATE`
    else await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id} FOR SHARE`
  }
}
export function assertCurrentPanelDocument(document: PanelDocument, scene: PanelScene) {
  if (!document.sessions.length) throw new PanelPublicationError("Choose at least one upcoming session.")
  for (const s of document.sessions) {
    const current=scene.sessions.find(row=>row.id===s.id)
    // A closed room's unbooked session may stay in a draft only so its interviewers can be kept or removed.
    if (!(current?.active || current?.unstaffOnly) || +new Date(current.endTime)<=+new Date(current.startTime) || !sameSessionTime(s,current) || current.roomRevision!==s.roomRevision || current.slotRevision!==s.slotRevision) throw new PanelPublicationError(staleDraftMessage, "DRAFT_STALE")
  }
  const validation=validatePanelDocument(document,panelDraftScene(document,scene))
  if(validation.issues.length)throw new PanelPublicationError(`Can't save the schedule: ${validation.issues[0].message} Nothing was changed.`, staleIssueCodes.has(validation.issues[0].code) ? "DRAFT_STALE" : "PANEL_REFUSED")
  return validation
}
export async function activePanelPublication(tx: AppTransactionClient, scope: {clubId:string;roundId:string}) {
  return tx.interviewPanelScheduleVersion.findFirst({where:{clubId:scope.clubId,roundId:scope.roundId,status:"PUBLISHED"},orderBy:{version:"desc"}})
}
export async function panelPublicationViews(tx: AppTransactionClient, scope: {clubId:string;roundId:string}): Promise<PanelPublishedView[]> {
  const rows=await tx.interviewPanelScheduleVersion.findMany({where:scope,orderBy:{version:"desc"},take:20,include:{publisher:{select:{email:true,studentProfile:{select:{firstName:true,lastName:true}}}}}})
  const intents=await tx.notificationEmailOutbox.findMany({where:{notification:{clubId:scope.clubId,eventKey:{startsWith:"panel-schedule:"}}},include:{notification:{select:{eventKey:true}},delivery:{select:{status:true}}}})
  return rows.map(row=>{
    const notifications: Record<string,number>={}
    for(const intent of intents.filter(i=>i.notification.eventKey.startsWith(`panel-schedule:${row.id}:`))){const status=intent.delivery?.status??intent.status;notifications[status]=(notifications[status]??0)+1}
    return {id:row.id,version:row.version,previousVersion:row.previousVersion,status:row.status as "PUBLISHED"|"SUPERSEDED",document:publishedPanelDocumentSchema.parse(row.document),changes:row.changes as PanelScheduleChange[],publishedAt:row.publishedAt.toISOString(),author:row.publisher.studentProfile?`${row.publisher.studentProfile.firstName} ${row.publisher.studentProfile.lastName}`:row.publisher.email,understaffedOverride:row.understaffedOverride,overrideReason:row.overrideReason,notifications}
  })
}
export async function assertPanelBookingSafety(tx: AppTransactionClient, scope: {clubId:string;roundId:string}, document: PanelDocument) {
  const bookings=await tx.interviewBooking.findMany({where:{slotId:{in:document.sessions.map(s=>s.id)}},include:{slot:{include:{room:true,panelScheduleVersion:true}},application:{include:{round:true,interviewAssignments:{where:{roundId:scope.roundId}}}}}})
  for(const booking of bookings){
    const app=booking.application, assigned=document.assignments.filter(a=>a.slotId===booking.slotId)
    if(booking.roundId!==scope.roundId||app.clubId!==scope.clubId||app.roundId!==scope.roundId||app.status!=="INTERVIEWING")throw new PanelPublicationError("A booked session is missing its applicant or round. Fix the booking first.")
    if(!assigned.length)throw new PanelPublicationError("A booked session needs at least one interviewer. Add one before you continue.")
    if(app.interviewAssignments.some(g=>!g.bookingManaged&&g.revokedAt&&assigned.some(a=>a.memberId===g.memberId)))throw new PanelPublicationError("A proposed interviewer has an explicit interview-access revocation for a booked applicant. Choose another interviewer or resolve access with the owner.")
  }
  return bookings
}
export function publicationDocument(row: InterviewPanelScheduleVersion | null) { return row ? publishedPanelDocumentSchema.parse(row.document) : null }
export const draftApprovalReset = {status:"UNPUBLISHED",approvalToken:null,readyBy:null,readyAt:null}
export function workingPublicationDocument(document: unknown) { return panelDocumentSchema.parse(document) }
