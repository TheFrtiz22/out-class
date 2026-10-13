import type { AppTransactionClient } from "@/utils/prisma"
import { interviewerEligible, parseSchedule } from "@/lib/availability"
import { interviewCapabilities } from "@/lib/interview-access"

/** The shared Phase 1/2 candidate boundary. No grants, schedules or notifications are written. */
export async function loadInterviewerPool(tx: AppTransactionClient, clubId: string, roundId: string) {
  const club = await tx.club.findUniqueOrThrow({ where: { id: clubId }, select: { interviewerRoles: true, interviewerEligibilityRevision: true } })
  const members = await tx.clubMember.findMany({ where: { clubId }, orderBy: { id: "asc" }, include: {
    user: { select: { email: true, disabledAt: true, studentProfile: { select: { firstName: true, lastName: true } } } },
    interviewParticipation: { where: { clubId, roundId } },
  } })
  return { club, members: members.map(m => {
    const participation = m.interviewParticipation[0]
    return { id: m.id, userId: m.userId, name: m.user.studentProfile ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}` : m.user.email,
      role: m.accessRole, eligible: interviewerEligible(m, club.interviewerRoles, participation?.eligibilityOverride),
      confirmed: !!participation?.confirmedAt, evidenceAccess: !m.user.disabledAt && interviewCapabilities(m).participate,
      availability: participation?.availability ? parseSchedule(participation.availability) : null,
      participationRevision: participation?.revision ?? 0, updatedAt: m.updatedAt, disabledAt: m.user.disabledAt,
    }
  }) }
}
