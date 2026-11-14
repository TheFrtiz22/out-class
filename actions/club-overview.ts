"use server";
import { dashboardSummary, dashboardReviewQueue, type OverviewView } from "@/utils/dashboard-summary";
import { z } from "zod";
import type { AppStatus } from "@prisma/client";
import { prisma } from "@/utils/prisma";
import { offerTally } from "@/lib/offer-tally";
import { requireClubMembership, requireClubPermission } from "@/utils/auth";
import { hasPermission, activeMemberWhere } from "@/lib/permissions";
import { organizationCapabilities } from "@/lib/organization-authorization";
/** `view` limits the read to one dashboard (see OverviewView); the default keeps the full projection. */
export async function getClubWorkspaceOverview(clubId: string, view: OverviewView = "all") {
  z.string().uuid().parse(clubId);
  z.enum(["all", "club", "recruiting", "strip"]).parse(view);
  const { membership } = await requireClubMembership(clubId);
  const clubPart = view === "all" || view === "club", recruitingPart = view === "all" || view === "recruiting";
  const canReview = recruitingPart && (
    hasPermission(membership, "applicants.identify") ||
    hasPermission(membership, "applications.review"));
  const now = new Date();
  // Same gate as the member directory (getOrganizationMemberManagement): counts only, no identities.
  const directory = organizationCapabilities(membership);
  const [club, meeting, work, awaitingReview, recruitment, upcomingInterviews, votingSessions, operations, members] = await Promise.all([
    prisma.club.findUniqueOrThrow({
      where: { id: clubId },
      select: { id: true, name: true, tagline: true },
    }),
    !clubPart ? null : prisma.meeting.findFirst({
      where: { clubId, date: { gte: now } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        title: true,
        date: true,
        location: true,
        audience: true,
      },
    }),
    !clubPart ? [] : prisma.taskAssignment.findMany({
      where: {
        memberId: membership.id,
        reviewedAt: null,
        OR: [{ submittedAt: null }, { revisionRequestedAt: { not: null } }],
        task: { clubId, status: { notIn: ["DRAFT", "DONE"] } },
      },
      select: {
        id: true,
        task: { select: { id: true, title: true, dueAt: true, kind: true } },
      },
      orderBy: { task: { dueAt: "asc" } },
      take: 5,
    }),
    clubPart && hasPermission(membership, "tasks.manage")
      ? prisma.taskAssignment.count({
          where: {
            task: { clubId },
            submittedAt: { not: null },
            reviewedAt: null,
            revisionRequestedAt: null,
          },
        })
      : Promise.resolve(null),
    // One grouped read serves both the outcome counts and the offer tally (application status x current
    // offer status), so the overview gains no extra query. Same visibility as before: identity viewers see
    // every round, review-only viewers anonymous rounds only.
    canReview
      ? prisma.$queryRaw<{ status: AppStatus; offer: string | null; count: number }[]>`
          SELECT a.status,
            CASE WHEN i.status = 'PENDING' AND i."expiresAt" <= ${now} THEN 'EXPIRED' ELSE i.status::text END AS offer,
            COUNT(*)::int AS count
          FROM "Application" a JOIN "PipelineRound" r ON r.id = a."roundId"
          LEFT JOIN "ClubInvitation" i ON i."applicationId" = a.id AND i."clubId" = a."clubId"
          WHERE a."clubId" = ${clubId} AND a.status <> 'DRAFTING'
            AND (${hasPermission(membership, "applicants.identify")} OR r."anonymousReview")
          GROUP BY 1, 2`
      : Promise.resolve(null),
    recruitingPart && hasPermission(membership, "interviews.manage")
      ? prisma.interviewBooking.count({ where: { slot: { clubId, startTime: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } } } })
      : Promise.resolve(null),
    recruitingPart && hasPermission(membership, "decisions.manage")
      ? prisma.votingSession.findMany({ where: { clubId, state: { in: ["OPEN", "ACTIVE"] } }, select: { id: true, state: true }, take: 10, orderBy: { createdAt: "desc" } })
      : Promise.resolve(null),
    dashboardSummary(clubId, membership, view),
    clubPart && (directory.canManageMembers || directory.canChangeRoles)
      ? Promise.all([
          prisma.clubMember.count({ where: { clubId, ...activeMemberWhere, user: { disabledAt: null } } }),
          prisma.clubInvitation.count({ where: { clubId, applicationId: null, requestedRole: "MEMBER", purpose: { in: ["MEMBERSHIP", "ACCESS_GRANT"] }, status: "PENDING", expiresAt: { gt: now }, revokedAt: null, acceptedAt: null, declinedAt: null } }),
          // New members: joined in the last 30 days (counts only, same gate as the directory).
          prisma.clubMember.count({ where: { clubId, ...activeMemberWhere, user: { disabledAt: null }, joinedAt: { gte: new Date(+now - 30 * 86400000) } } }),
        ]).then(([active, pendingInvitations, recent]) => ({ active, pendingInvitations, recent }))
      : Promise.resolve(null),
  ]);
  const current = await requireClubMembership(clubId);
  if (JSON.stringify(current.membership) !== JSON.stringify(membership)) throw new Error("Workspace access changed. Reload the page and try again.");
  return {
    operations,
    club,
    membership: {
      id: membership.id,
      isOwner: membership.isOwner,
      permissions: membership.permissions,
      interviewOffices: membership.interviewOffices,
      status: membership.status,
    },
    meeting,
    work,
    awaitingReview,
    upcomingInterviews,
    votingSessions,
    members,
    recruitment: recruitment ? recruitmentCounts(recruitment) : null,
    offerTally: recruitment ? offerTally(recruitment) : null,
  };
}
function recruitmentCounts(rows: { status: AppStatus; count: number }[]) {
  const counts = new Map<AppStatus, number>();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + Number(row.count));
  return [...counts].map(([status, count]) => ({ status, count }));
}
export async function getWorkspaceRounds(clubId: string) {
  z.string().uuid().parse(clubId);
  await requireClubPermission(clubId, ["recruitment.manage"]);
  return prisma.pipelineRound.findMany({
    where: { clubId, archivedAt: null },
    orderBy: { order: "asc" },
    select: { id: true, name: true, anonymousReview: true },
  });
}

export async function getDashboardReviewQueue(clubId: string, roundId: string) {
  z.string().uuid().parse(clubId); z.string().uuid().parse(roundId);
  const { membership } = await requireClubMembership(clubId);
  if (!hasPermission(membership, "applications.review") && !hasPermission(membership, "applicants.identify")) throw new Error("Review access required.");
  const rows = await dashboardReviewQueue(clubId, membership, roundId);
  const current = await requireClubMembership(clubId);
  if (JSON.stringify(current.membership) !== JSON.stringify(membership)) throw new Error("Review access changed.");
  return rows;
}
