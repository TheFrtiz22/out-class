import type { AppTransactionClient } from "@/utils/prisma";
import { interviewCapabilities } from "@/lib/interview-access";
/** Called inside the booking/owner transaction, serialized on Club and Application. */
export async function syncBookingPanel(tx: AppTransactionClient, applicationId: string, roundId: string, actorId: string) {
  const app = await tx.application.findFirst({ where: { id: applicationId }, include: { round: true } });
  if (!app) throw Error("Application unavailable.");
  const existing = await tx.interviewPanelAssignment.findMany({ where: { applicationId, roundId } });
  const booking = await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId, roundId } }, include: { slot: { include: { room: true } } } });
  const room = booking?.slot.room;
  const owner = room?.panelApprovedBy ? await tx.clubMember.findFirst({ where: { userId: room.panelApprovedBy, clubId: app.clubId, isOwner: true, status: "ACTIVE", user: { disabledAt: null } } }) : null;
  const allowed = owner && room?.isOpen && room.clubId === app.clubId && room.roundId === roundId && booking?.roundId === roundId && app.roundId === roundId && app.status === "INTERVIEWING" && !app.round.anonymousReview ? room.approvedPanelMemberIds.filter(id => room.panelMemberIds.includes(id)) : [];
  const members = allowed.length ? await tx.clubMember.findMany({ where: { id: { in: allowed }, clubId: app.clubId, status: "ACTIVE", user: { disabledAt: null } } }) : [];
  const eligible = members.filter(m => m.userId !== app.studentId && interviewCapabilities(m).participate);
  for (const old of existing.filter(a => a.bookingManaged && !a.revokedAt && !eligible.some(m => m.id === a.memberId))) {
    await tx.interviewPanelAssignment.updateMany({ where: { id: old.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId, clubId: app.clubId, targetId: old.id, action: "interview.panel.booking.revoke" } });
  }
  for (const member of eligible) {
    const old = existing.find(a => a.memberId === member.id);
    // Manual grants and manual revocations remain independent of scheduling.
    if (old && !old.bookingManaged) continue;
    if (old && !old.revokedAt && old.bookingId === booking!.id) continue;
    const key = { applicationId, roundId, memberId: member.id };
    const grant = await tx.interviewPanelAssignment.upsert({ where: { applicationId_roundId_memberId: key }, create: { ...key, grantedBy: room!.panelApprovedBy!, bookingManaged: true, bookingId: booking!.id }, update: { revokedAt: null, grantedBy: room!.panelApprovedBy!, grantedAt: new Date(), bookingManaged: true, bookingId: booking!.id } });
    await tx.auditLog.create({ data: { actorId, clubId: app.clubId, targetId: grant.id, action: "interview.panel.booking.grant", details: { bookingId: booking!.id, approvedBy: room!.panelApprovedBy } } });
  }
}
