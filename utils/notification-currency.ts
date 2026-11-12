import type { AppTransactionClient } from "@/utils/prisma";
import { requireCommunicationAccess } from "@/lib/communications-policy";
import { panelScheduleNotificationPrefix, currentPanelScheduleNotification } from "@/utils/official-panel-schedule";
import { availabilityRequestPrefix, currentAvailabilityRequest } from "@/utils/availability-request-notifications";
import { assignmentNotificationPrefix, currentAssignmentNotification } from "@/utils/interview-assignment-notifications";
import { applicantBookingNotificationPrefix, currentApplicantBookingNotification } from "@/utils/applicant-booking-notifications";

type CurrencyNotification = { eventKey: string; clubId: string | null; href: string; type: string };
/**
 * The per-item access and currency checks the email claim applies before every send: the
 * booking, assignment and availability links are still current and a MESSAGE recipient still
 * has access to the conversation. `panel: true` also requires a current panel schedule (the
 * email claim instead compares the payload's snapshot signature). Shared with Web Push
 * (utils/notification-push.ts) so a user who lost access gets no stale push either.
 */
export async function notificationStillCurrent(tx: AppTransactionClient, notification: CurrencyNotification, userId: string, siteUrl: string, { panel = false } = {}) {
  if (notification.eventKey.startsWith(applicantBookingNotificationPrefix) && !await currentApplicantBookingNotification(tx, notification, userId)) return false;
  if (notification.eventKey?.startsWith(assignmentNotificationPrefix) && notification.eventKey.includes(":assigned:") && !await currentAssignmentNotification(tx, notification, userId)) return false;
  if (notification.eventKey.startsWith(availabilityRequestPrefix) && !await currentAvailabilityRequest(tx, notification, userId)) return false;
  if (panel && notification.eventKey?.startsWith(panelScheduleNotificationPrefix) && !await currentPanelScheduleNotification(tx, notification, userId)) return false;
  if (notification.type === "MESSAGE") {
    const conversationId = new URL(notification.href, siteUrl).searchParams.get("conversation");
    const conversation = conversationId ? await tx.clubConversation.findUnique({ where: { id: conversationId }, select: { clubId: true, studentId: true } }) : null;
    if (!conversation || !await requireCommunicationAccess(tx, conversation.clubId, conversation.studentId, userId).catch(() => null)) return false;
  }
  return true;
}
