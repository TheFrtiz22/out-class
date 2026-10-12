import type { AppTransactionClient } from "@/utils/prisma";
import type { InterviewPanelAssignment } from "@prisma/client";
import { collaborationAccess } from "@/utils/interview-collaboration";

export const assignmentNotificationPrefix = "interview-assignment:";
export async function notifyInterviewAssignment(tx: AppTransactionClient, grant: InterviewPanelAssignment, kind: "assigned" | "cancelled") {
  const member = await tx.clubMember.findUniqueOrThrow({ where: { id: grant.memberId } });
  const eventKey = `${assignmentNotificationPrefix}${grant.id}:${kind}:${grant.bookingId || grant.grantedAt.toISOString()}`;
  // Stored/email content is deliberately generic. Names and times are projected under current access on inbox reads.
  await tx.userNotification.createMany({ data: [{ userId: member.userId, clubId: member.clubId, eventKey, type: "INTERVIEW", title: kind === "assigned" ? "Interview assignment" : "Interview assignment changed", body: kind === "assigned" ? "You have an interview assignment. Open the interview room to review its current details." : "An interview assignment was cancelled or changed. Check your current interview list.", href: `/club/${member.clubId}/workspace?section=recruitment&tool=interviews&interview=1&applicationId=${grant.applicationId}&roundId=${grant.roundId}` }], skipDuplicates: true });
}
export async function currentAssignmentNotification(tx: AppTransactionClient, notification: { eventKey: string | null; href: string; clubId: string | null }, userId: string) {
  if (!notification.eventKey?.startsWith(assignmentNotificationPrefix) || !notification.clubId) return null;
  if (notification.eventKey.includes(":cancelled:")) return null;
  const query = new URL(notification.href, "https://out-class.net").searchParams;
  const scope = { clubId: notification.clubId, applicationId: query.get("applicationId") || "", roundId: query.get("roundId") || "" };
  try {
    // Skip stale contexts cheaply. Full current authorization remains mandatory below.
    const current = await tx.application.findFirst({ where: { id: scope.applicationId, clubId: scope.clubId, roundId: scope.roundId }, select: { id: true } });
    if (!current) return null;
    const grant = await tx.interviewPanelAssignment.findFirst({ where: { applicationId: scope.applicationId, roundId: scope.roundId, revokedAt: null, member: { userId, clubId: scope.clubId, status: "ACTIVE", user: { disabledAt: null } } }, select: { id: true } });
    if (!grant) return null;
    const actor = await collaborationAccess(tx, scope, userId, "share");
    if (actor.app.roundId !== scope.roundId) return null;
    const booking = await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId: scope.applicationId, roundId: scope.roundId } }, include: { slot: { include: { room: true } } } });
    const p = await tx.studentProfile.findUnique({ where: { userId: actor.app.studentId }, select: { firstName: true, lastName: true } });
    return { title: `Interview assignment · ${actor.round.name}`, body: `${p ? `${p.firstName} ${p.lastName}` : "Applicant"}${booking?.slot.room ? ` · ${booking.slot.room.name} · ${booking.slot.startTime.toISOString()}` : ""}`, href: notification.href };
  } catch { return null; }
}

/** Before deleting a booking, notify active direct grants as well as booking-managed grants. */
export async function notifyInterviewBookingChange(tx: AppTransactionClient, booking: { id: string; applicationId: string; roundId: string | null }) {
  if (!booking.roundId) return;
  const grants = await tx.interviewPanelAssignment.findMany({ where: { applicationId: booking.applicationId, roundId: booking.roundId, revokedAt: null } });
  for (const grant of grants) await notifyInterviewAssignment(tx, { ...grant, bookingId: booking.id }, "cancelled");
}
