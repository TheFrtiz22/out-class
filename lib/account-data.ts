import type { Prisma } from "@prisma/client"

// Shared by the RSC bootstrap and /api/users/me. New Club columns must be
// deliberately reviewed before becoming part of the common account payload.
// Recruiting's private decision templates use their separately authorized loader.
export const accountClubSelect = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  tagline: true,
  description: true,
  logoUrl: true,
  bannerUrl: true,
  color: true,
  category: true,
  acceptanceRate: true,
  aumValue: true,
  schoolId: true,
  campusKey: true,
  directorySource: true,
  marketing: true,
  marketingApprovedAt: true,
  claimedAt: true,
  testRequirement: true,
  applicationOpen: true,
  applicationDeadline: true,
  applicationVersion: true,
  pipelineVersion: true,
  isDiscoverable: true,
  invitationEmailEnabled: true,
  suspendedAt: true,
  interviewerRoles: true,
  interviewerEligibilityRevision: true,
  sendFormalDecisionLetters: true,
} as const satisfies Prisma.ClubSelect

export type AccountClub = Prisma.ClubGetPayload<{ select: typeof accountClubSelect }>

export const accountUserInclude = {
  studentProfile: true,
  applications: {
    omit: { anonymousReviewText: true },
    include: { club: { select: accountClubSelect } },
    // A student can have several applications to one club after re-applying;
    // the first per club is the current one (drafts first, then newest).
    orderBy: [{ submittedAt: { sort: "desc", nulls: "first" } }, { id: "asc" }],
  },
  memberships: {
    where: { status: "ACTIVE" },
    include: { club: { select: accountClubSelect } },
  },
} as const satisfies Prisma.UserInclude
