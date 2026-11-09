"use server"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireClubPermission } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { activeRecruitmentCycle } from "@/lib/recruitment-cycle"
import { reviewerCalibration, recruitingFunnel } from "@/lib/recruiting-insights"

/** Funnel and reviewer calibration for the active cycle (or every non-draft
 * application when there isn't exactly one active cycle). Recruitment leads only.
 * Applicant identities are never returned; reviewers are named for leads. */
export async function getRecruitingInsights(clubId: string) {
  z.string().uuid().parse(clubId)
  const { user } = await requireClubPermission(clubId, ["recruitment.manage"], { allowSuspendedRead: true })
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, clubId, user.id, ["recruitment.manage"], { readOnly: true, allowSuspendedRead: true })
    const cycle = await activeRecruitmentCycle(tx, clubId)
    const apps = await tx.application.findMany({
      where: { clubId, status: { not: "DRAFTING" }, ...(cycle ? { recruitmentCycleId: cycle.id } : {}) },
      select: { id: true, status: true, bookings: { select: { id: true }, take: 1 }, interviewAssignments: { where: { revokedAt: null }, select: { memberId: true }, take: 1 }, recruitmentOffer: { select: { status: true } } },
    })
    const evaluations = apps.length ? await tx.evaluation.findMany({
      where: { applicationId: { in: apps.map(a => a.id) }, submittedAt: { not: null } },
      select: { interviewerId: true, applicationId: true, roundId: true, score: true },
    }) : []
    const calibration = reviewerCalibration(evaluations)
    const names = calibration.length ? await tx.clubMember.findMany({ where: { clubId, id: { in: calibration.map(c => c.memberId) } }, select: { id: true, user: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } }) : []
    return {
      cycleName: cycle ? (await tx.recruitmentCycle.findUnique({ where: { id: cycle.id }, select: { name: true } }))?.name ?? null : null,
      funnel: recruitingFunnel(apps.map(a => ({ status: a.status, interviewed: a.bookings.length > 0 || a.interviewAssignments.length > 0, offerAccepted: a.recruitmentOffer?.status === "ACCEPTED" }))),
      reviewers: calibration.map(c => {
        const p = names.find(n => n.id === c.memberId)?.user.studentProfile
        return { ...c, name: p ? `${p.firstName} ${p.lastName}`.trim() : "Former member" }
      }),
    }
  }, { isolationLevel: "RepeatableRead", timeout: 20000 })
}
