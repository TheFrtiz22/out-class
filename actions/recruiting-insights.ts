"use server"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireClubPermission } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { activeRecruitmentCycle } from "@/lib/recruitment-cycle"
import { reviewerCalibration, recruitingFunnel } from "@/lib/recruiting-insights"
import { hasPermission } from "@/lib/permissions"
import { interviewCapabilities } from "@/lib/interview-access"
import { applicationReviewVisibility } from "@/lib/application-review-visibility"

/** Funnel and reviewer calibration for the active cycle (or every non-draft
 * application when there isn't exactly one active cycle). Recruitment leads only.
 * Applicant identities are never returned. Reviewers are named only to callers
 * who may read closing reviews, from exactly the submitted, non-anonymous scores
 * applicationReviewVisibility lets them see (never their own application). */
export async function getRecruitingInsights(clubId: string) {
  z.string().uuid().parse(clubId)
  const { user } = await requireClubPermission(clubId, ["recruitment.manage"], { allowSuspendedRead: true })
  return prisma.$transaction(async tx => {
    const member = await authorizeClubTransaction(tx, clubId, user.id, ["recruitment.manage"], { readOnly: true, allowSuspendedRead: true })
    const cycle = await activeRecruitmentCycle(tx, clubId)
    // Same rule as the dashboard: without applicants.identify, only anonymous-round applications count.
    const identify = hasPermission(member, "applicants.identify")
    const apps = await tx.application.findMany({
      where: { clubId, status: { not: "DRAFTING" }, ...(cycle ? { recruitmentCycleId: cycle.id } : {}), ...(!identify ? { round: { anonymousReview: true } } : {}) },
      select: { id: true, status: true, studentId: true, roundId: true, bookings: { select: { id: true }, take: 1 }, interviewAssignments: { where: { revokedAt: null }, select: { memberId: true, roundId: true, member: { select: { status: true, isOwner: true, permissions: true } } } }, recruitmentOffer: { select: { status: true } } },
    })
    const evaluations = apps.length && member && interviewCapabilities(member).readClosing ? await tx.evaluation.findMany({
      where: { applicationId: { in: apps.map(a => a.id) }, submittedAt: { not: null }, interviewer: { clubId }, stableRound: { clubId, anonymousReview: false }, interviewRecords: { none: { anonymousReview: true } } },
      select: { interviewerId: true, applicationId: true, roundId: true, score: true, submittedAt: true },
    }) : []
    const visible = member ? apps.flatMap(app => applicationReviewVisibility({ ...app, evaluations: evaluations.filter(e => e.applicationId === app.id) }, member).evaluations) : []
    const calibration = reviewerCalibration(visible)
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
