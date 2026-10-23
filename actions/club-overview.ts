"use server";
import { dashboardSummary, dashboardReviewQueue } from "@/utils/dashboard-summary";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireClubMembership, requireClubPermission } from "@/utils/auth";
import { hasPermission } from "@/lib/permissions";
export async function getClubWorkspaceOverview(clubId: string) {
  z.string().uuid().parse(clubId);
  const { membership } = await requireClubMembership(clubId);
  const canReview =
    hasPermission(membership, "applicants.identify") ||
    hasPermission(membership, "applications.review");
  const now = new Date();
  const [club, meeting, work, awaitingReview, recruitment, upcomingInterviews, votingSessions, operations] = await Promise.all([
    prisma.club.findUniqueOrThrow({
      where: { id: clubId },
      select: { id: true, name: true, tagline: true },
    }),
    prisma.meeting.findFirst({
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
    prisma.taskAssignment.findMany({
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
    hasPermission(membership, "tasks.manage")
      ? prisma.taskAssignment.count({
          where: {
            task: { clubId },
            submittedAt: { not: null },
            reviewedAt: null,
            revisionRequestedAt: null,
          },
        })
      : Promise.resolve(null),
    canReview
      ? prisma.application.groupBy({
          by: ["status"],
          where: {
            clubId,
            status: { not: "DRAFTING" },
            ...(hasPermission(membership, "applicants.identify")
              ? {}
              : { round: { anonymousReview: true } }),
          },
          _count: { _all: true },
        })
      : Promise.resolve(null),
    hasPermission(membership, "interviews.manage")
      ? prisma.interviewBooking.count({ where: { slot: { clubId, startTime: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } } } })
      : Promise.resolve(null),
    hasPermission(membership, "decisions.manage")
      ? prisma.votingSession.findMany({ where: { clubId, state: { in: ["OPEN", "ACTIVE"] } }, select: { id: true, state: true }, take: 10, orderBy: { createdAt: "desc" } })
      : Promise.resolve(null),
    dashboardSummary(clubId, membership),
  ]);
  const current = await requireClubMembership(clubId);
  if (JSON.stringify(current.membership) !== JSON.stringify(membership)) throw new Error("Workspace access changed. Refresh and try again.");
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
    recruitment:
      recruitment?.map((row) => ({
        status: row.status,
        count: row._count._all,
      })) ?? null,
  };
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
