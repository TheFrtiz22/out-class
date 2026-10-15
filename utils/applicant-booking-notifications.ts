import type { AppTransactionClient } from "@/utils/prisma"
export const applicantBookingNotificationPrefix = "applicant-interview-booking:"
export async function notifyBookingPublished(tx: AppTransactionClient, round: { id: string; clubId: string; bookingCycleId: string | null }) {
  const applicants = await tx.application.findMany({ where: { clubId: round.clubId, roundId: round.id, recruitmentCycleId: round.bookingCycleId, status: "INTERVIEWING", student: { disabledAt: null } }, select: { id: true, studentId: true } })
  if (applicants.length) await tx.userNotification.createMany({ data: applicants.map(a => ({ userId: a.studentId, clubId: round.clubId, type: "INTERVIEW" as const, eventKey: `${applicantBookingNotificationPrefix}published:${a.id}:${round.id}:${round.bookingCycleId || "legacy"}`, title: "Book your interview", body: "Interview booking is open for your invited round. Choose a time from your application.", href: `/interviews/book?clubId=${round.clubId}&roundId=${round.id}` })), skipDuplicates: true })
}
export async function currentApplicantBookingNotification(tx: AppTransactionClient, notification: { eventKey: string; clubId: string | null; href: string }, userId: string) {
  if (!notification.eventKey.startsWith(applicantBookingNotificationPrefix) || !notification.clubId) return null
  const query = new URL(notification.href, "https://out-class.net").searchParams
  const app = await tx.application.findFirst({ where: { studentId: userId, clubId: notification.clubId, roundId: query.get("roundId") || "", status: "INTERVIEWING", student: { disabledAt: null }, club: { suspendedAt: null } }, include: { round: true } })
  if (!app || app.round.archivedAt || app.round.anonymousReview) return null
  if (notification.eventKey.startsWith(`${applicantBookingNotificationPrefix}published:`) && (!app.round.bookingPublishedAt || app.round.bookingPaused || app.recruitmentCycleId !== app.round.bookingCycleId)) return null
  if (notification.eventKey.startsWith(`${applicantBookingNotificationPrefix}confirmed:`)) {
    const id = notification.eventKey.slice(`${applicantBookingNotificationPrefix}confirmed:`.length)
    if (!await tx.interviewBooking.findFirst({ where: { id, applicationId: app.id, roundId: app.roundId } })) return null
  }
  return { href: notification.href }
}
