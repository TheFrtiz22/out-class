"use server";
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
  const [club, meeting, work, awaitingReview, recruitment] = await Promise.all([
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
        submittedAt: null,
        task: { clubId, status: { not: "DONE" } },
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
  ]);
  return {
    club,
    membership: {
      id: membership.id,
      isOwner: membership.isOwner,
      permissions: membership.permissions,
    },
    meeting,
    work,
    awaitingReview,
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
    where: { clubId },
    orderBy: { order: "asc" },
    select: { id: true, name: true, anonymousReview: true },
  });
}
