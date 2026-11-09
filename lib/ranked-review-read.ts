import type { Prisma } from "@prisma/client";
import { hasPermission, type ClubAccess } from "@/lib/permissions";
import { applicationReviewVisibility } from "@/lib/application-review-visibility";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";
import { profilePhotoSource } from "@/lib/profile-photo";
import type { RoundScoreSummary } from "@/lib/interview-review-summary";

/**
 * Database allowlist for the Ranked review list: only what the ranked rows render
 * (identity, status, cycle) and what `applicationReviewVisibility` needs to release
 * the canonical `roundScore`. Answers, bookings, experiences, profile text, offers,
 * evaluation notes and member rows are never read for this view.
 */
export const rankedReviewSelect = {
  id: true, clubId: true, roundId: true, status: true, studentId: true, recruitmentCycleId: true,
  round: { select: { anonymousReview: true } },
  student: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true, headshotUrl: true } } } },
  // Same order as the CRM detail read, so the per-interviewer score chosen is identical.
  evaluations: { where: { submittedAt: { not: null } }, select: { interviewerId: true, roundId: true, submittedAt: true, score: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  interviewAssignments: { where: { revokedAt: null }, select: {
    memberId: true, roundId: true, member: { select: { status: true, isOwner: true, permissions: true } },
  } },
} satisfies Prisma.ApplicationSelect;

export type RankedReviewCandidate = {
  id: string; roundId: string; status: string; studentId: string; recruitmentCycleId: string | null;
  student: { email: string; studentProfile: { firstName: string; lastName: string; headshotUrl: string | null } | null };
  roundScore: RoundScoreSummary | null;
};

type Raw = Prisma.ApplicationGetPayload<{ select: typeof rankedReviewSelect }>;

/**
 * Same identity, cycle, photo and score rules as the CRM detail projection
 * (`pipelineDetailProjection` via `anonymousApplication`/`identifiedApplication`),
 * narrowed to the ranked row fields.
 */
export function rankedReviewProjection(app: Raw, membership: ClubAccess & { id: string; userId: string }): RankedReviewCandidate {
  const anonymous = !hasPermission(membership, "applicants.identify") || app.round.anonymousReview;
  const { roundScore } = applicationReviewVisibility(app, membership);
  const profile = app.student.studentProfile;
  return {
    id: app.id, roundId: app.roundId, status: app.status,
    studentId: anonymous ? `anonymous-${app.id}` : app.studentId,
    recruitmentCycleId: anonymous ? null : app.recruitmentCycleId,
    student: anonymous
      ? { email: "", studentProfile: { firstName: "Applicant", lastName: anonymousApplicantLabel(app.id).slice("Applicant ".length), headshotUrl: null } }
      : { email: app.student.email, studentProfile: profile ? { firstName: profile.firstName, lastName: profile.lastName,
          headshotUrl: profilePhotoSource(profile.headshotUrl, { clubId: app.clubId, applicationId: app.id, mode: "crm" }) ?? null } : null },
    roundScore,
  };
}

/** Narrows an already-projected CRM pipeline row (used by Demo Mode) to the same ranked shape. */
export function rankedReviewCandidate(app: { id: string; roundId: string; status: string; studentId: string; recruitmentCycleId?: string | null; student: { email: string; studentProfile: { firstName: string; lastName: string; headshotUrl?: string | null } | null }; roundScore?: RoundScoreSummary | null }): RankedReviewCandidate {
  const p = app.student.studentProfile;
  return { id: app.id, roundId: app.roundId, status: app.status, studentId: app.studentId, recruitmentCycleId: app.recruitmentCycleId ?? null,
    student: { email: app.student.email, studentProfile: p ? { firstName: p.firstName, lastName: p.lastName, headshotUrl: p.headshotUrl ?? null } : null },
    roundScore: app.roundScore ?? null };
}
