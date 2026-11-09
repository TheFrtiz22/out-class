import type { Prisma } from "@prisma/client";
import type { ClubAccess } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";
import { applicationReviewVisibility } from "@/lib/application-review-visibility";
import { anonymousApplication, identifiedApplication } from "@/lib/anonymous-review";
import { genderVisibility } from "@/lib/recruitment-profile";
import { decisionPublicationGuard } from "@/lib/decision-publication-guard";
import type { PriorApplication } from "@/lib/prior-applications";

// Exactly the canonical CRM detail projection, hydrated only for visible IDs.
export const pipelineDetailInclude = {
  recruitmentOffer: { select: { status: true, expiresAt: true } },
  round: true,
  evaluations: { omit: { notes: true, applicantQuestions: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  interviewAssignments: { where: { revokedAt: null }, include: { member: true } },
  student: { include: { studentProfile: { include: { experiences: { orderBy: { id: "asc" } } } } } },
  answers: { include: { question: true }, orderBy: [{ question: { order: "asc" } }, { id: "asc" }] },
  bookings: { include: { slot: true }, orderBy: [{ slot: { startTime: "asc" } }, { id: "asc" }] },
} satisfies Prisma.ApplicationInclude;
export function pipelineDetailProjection(raw: Prisma.ApplicationGetPayload<{ include: typeof pipelineDetailInclude }>, membership: ClubAccess & { id: string; userId: string }, priorApplications: readonly PriorApplication[] = []) {
        const { caps, ownSubmitted, assigned, roundScore, evaluations } = applicationReviewVisibility(raw, membership);
        const safe = { ...raw }; delete (safe as Partial<typeof raw>).interviewAssignments;
        const app = { ...safe, evaluations: evaluations.map(e => ({ ...e, notes: null, applicantQuestions: null })) };
        const anonymous = !hasPermission(membership, "applicants.identify") || app.round.anonymousReview;
        const projected = anonymous ? anonymousApplication(app, hasPermission(membership, "applications.review") && genderVisibility(app.round.applicantDisplay)) : identifiedApplication(app, hasPermission(membership, "applications.review") && genderVisibility(app.round.applicantDisplay), "crm");
        const canEvaluate = !ownSubmitted && raw.studentId !== membership.userId && (raw.round.anonymousReview ? hasPermission(membership, "applications.review") : caps.participate && assigned);
        return { ...projected, canEvaluate, priorApplications: anonymous ? [] : [...priorApplications], publicationGuard:decisionPublicationGuard(raw), recruitmentOffer: raw.recruitmentOffer ?? null, roundScore };
}
