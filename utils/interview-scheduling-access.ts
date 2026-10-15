import { randomUUID } from "node:crypto";
import type { Prisma, InterviewPanelAssignment, ClubMember } from "@prisma/client";
export type BookingPanelBatch={grants:Prisma.InterviewPanelAssignmentCreateManyInput[];audits:Prisma.AuditLogCreateManyInput[]};
type SyncContext={app:Prisma.ApplicationGetPayload<{include:{round:true}}>;existing:InterviewPanelAssignment[];booking:Prisma.InterviewBookingGetPayload<{include:{slot:{include:{room:true;panelScheduleVersion:true}}}}>;members:ClubMember[];approvedBy:string};
import type { AppTransactionClient } from "@/utils/prisma";
import { interviewCapabilities } from "@/lib/interview-access";
import { loadInterviewerPool } from "@/utils/interviewer-pool";
import { intervalAvailability } from "@/lib/availability";
import { notifyInterviewAssignment } from "@/utils/interview-assignment-notifications";
/** Called inside the booking/owner transaction, serialized on Club and Application. */
export async function syncBookingPanel(tx: AppTransactionClient, applicationId: string, roundId: string, actorId: string, options: {notify?:boolean;context?:SyncContext;batch?:BookingPanelBatch} = {}) {
  const context=options.context;
  const app = context?.app ?? await tx.application.findFirst({ where: { id: applicationId }, include: { round: true } });
  if (!app) throw Error("Application unavailable.");
  const existing = context?.existing ?? await tx.interviewPanelAssignment.findMany({ where: { applicationId, roundId } });
  const booking = context?.booking ?? await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId, roundId } }, include: { slot: { include: { room: true, panelScheduleVersion: true } } } });
  const room = booking?.slot.room;
  const approvedBy = context?.approvedBy ?? booking?.slot.panelScheduleVersion?.publishedBy ?? room?.panelApprovedBy;
  const owner = context ? true : approvedBy ? await tx.clubMember.findFirst({ where: { userId: approvedBy, clubId: app.clubId, isOwner: true, status: "ACTIVE", user: { disabledAt: null } } }) : null;
  const allowed = owner && room?.isOpen && room.clubId === app.clubId && room.roundId === roundId && booking?.roundId === roundId && app.roundId === roundId && app.status === "INTERVIEWING" && !app.round.anonymousReview ? (booking?.slot.panelScheduleVersionId ? booking.slot.publishedPanelMemberIds : room.approvedPanelMemberIds.filter(id => room.panelMemberIds.includes(id))) : [];
  const members = context?.members ?? (allowed.length ? await tx.clubMember.findMany({ where: { id: { in: allowed }, clubId: app.clubId, status: "ACTIVE", user: { disabledAt: null } } }) : []);
  const pool = !context && booking?.slot.panelScheduleVersionId ? await loadInterviewerPool(tx,app.clubId,roundId) : null;
  const eligible = members.filter(m => allowed.includes(m.id) && m.userId !== app.studentId && interviewCapabilities(m).participate && (!pool || pool.members.some(p=>p.id===m.id&&p.eligible)));
  for (const old of existing.filter(a => a.bookingManaged && !a.revokedAt && !eligible.some(m => m.id === a.memberId))) {
    if(options.notify!==false) await notifyInterviewAssignment(tx, old, "cancelled");
    await tx.interviewPanelAssignment.updateMany({ where: { id: old.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId, clubId: app.clubId, targetId: old.id, action: "interview.panel.booking.revoke" } });
  }
  for (const member of eligible) {
    const old = existing.find(a => a.memberId === member.id);
    // Manual grants and manual revocations remain independent of scheduling.
    if (old && !old.bookingManaged) {
      if (!old.revokedAt && options.notify!==false) await notifyInterviewAssignment(tx, { ...old, bookingId: booking!.id }, "assigned");
      continue;
    }
    if (old && !old.revokedAt && old.bookingId === booking!.id) { if(old.grantedBy!==approvedBy)await tx.interviewPanelAssignment.update({where:{id:old.id},data:{grantedBy:approvedBy!}}); continue; }
    const key = { applicationId, roundId, memberId: member.id };
    if(options.batch&&!old){
      const id=randomUUID();options.batch.grants.push({id,...key,grantedBy:approvedBy!,bookingManaged:true,bookingId:booking!.id});
      options.batch.audits.push({id:randomUUID(),actorId,clubId:app.clubId,targetId:id,action:"interview.panel.booking.grant",details:{bookingId:booking!.id,approvedBy}});continue;
    }
    const grant = await tx.interviewPanelAssignment.upsert({ where: { applicationId_roundId_memberId: key }, create: { ...key, grantedBy: approvedBy!, bookingManaged: true, bookingId: booking!.id }, update: { revokedAt: null, grantedBy: approvedBy!, grantedAt: new Date(), bookingManaged: true, bookingId: booking!.id } });
    if(options.notify!==false) await notifyInterviewAssignment(tx, grant, "assigned");
    await tx.auditLog.create({ data: { actorId, clubId: app.clubId, targetId: grant.id, action: "interview.panel.booking.grant", details: { bookingId: booking!.id, approvedBy } } });
  }
}
