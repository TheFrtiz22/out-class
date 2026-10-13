import type { AppTransactionClient } from "@/utils/prisma"
import { interviewerEligible, availabilityHref } from "@/lib/availability"
export const availabilityRequestPrefix = "availability-request:"
/** Resolve current access again at inbox/email delivery; revoked requests leak no club detail. */
export async function currentAvailabilityRequest(tx: AppTransactionClient, notification: { eventKey: string; clubId: string | null }, userId: string) {
  if (!notification.clubId || !notification.eventKey.startsWith(availabilityRequestPrefix)) return null
  const participationId = notification.eventKey.split(":")[1]
  const row = await tx.interviewRoundParticipation.findFirst({ where: { id: participationId, clubId: notification.clubId, member: { userId, status: "ACTIVE", user: { disabledAt: null }, club: { suspendedAt: null } }, round: { archivedAt: null } }, include: { member: { include: { club: true } }, round: true } })
  if (!row || row.confirmedAt || row.declinedAt || !row.requestedAt || !interviewerEligible(row.member, row.member.club.interviewerRoles, row.eligibilityOverride)) return null
  return { title: `Availability requested · ${row.member.club.name}`, body: `Respond to ${row.round.name}. Your global schedule will be prefilled.`, href: availabilityHref(row.clubId, row.roundId) }
}
