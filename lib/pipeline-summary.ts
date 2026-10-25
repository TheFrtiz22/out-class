import type { Prisma } from "@prisma/client";
import { anonymousListProfile } from "@/lib/anonymous-review";
import { recruitmentListProfile } from "@/lib/recruitment-profile";
import { applicationReviewVisibility } from "@/lib/application-review-visibility";
import { hasPermission, type ClubAccess } from "@/lib/permissions";

/** Database allowlist, independent of future application/profile schema fields.
 * The complete metadata set is still read to preserve global privacy-aware
 * filtering/order/counts. Detail, offer, private draft and member content is not. */
export const pipelineSummarySelect = {
  id: true, roundId: true, status: true, studentId: true,
  round: { select: { anonymousReview: true } },
  student: { select: { email: true, studentProfile: { select: {
    firstName: true, lastName: true, major: true, gradYear: true,
    transferStudent: true, gpa: true, satScore: true, actScore: true,
  } } } },
  evaluations: { where: { submittedAt: { not: null } }, select: {
    interviewerId: true, roundId: true, submittedAt: true, score: true,
  } },
  interviewAssignments: { where: { revokedAt: null }, select: {
    memberId: true, roundId: true, member: { select: { status: true, isOwner: true, permissions: true } },
  } },
} satisfies Prisma.ApplicationSelect;

type Summary = Prisma.ApplicationGetPayload<{ select: typeof pipelineSummarySelect }>;
export function pipelineSummaryProjection(app: Summary, membership: ClubAccess & { id: string; userId: string }) {
  const anonymous = !hasPermission(membership, "applicants.identify") || app.round.anonymousReview;
  const { evaluations, roundScore } = applicationReviewVisibility(app, membership);
  return {
    id: app.id, roundId: app.roundId, status: app.status,
    studentId: anonymous ? `anonymous-${app.id}` : app.studentId,
    student: { email: anonymous ? "" : app.student.email,
      studentProfile: anonymous ? anonymousListProfile(app.id, app.student.studentProfile) :
        app.student.studentProfile ? recruitmentListProfile(app.student.studentProfile) : null },
    evaluations: evaluations.map(e => ({ interviewerId: e.interviewerId })), roundScore,
  };
}
