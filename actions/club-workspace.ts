"use server";
import { clubProfileSchema } from "@/lib/club-marketing";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubPermission } from "@/utils/auth";

export async function updateClubSettings(input: {
  clubId: string; name: string; tagline: string; description: string;
} & Partial<import("@/lib/club-marketing").ClubProfileDraft>) {
  const data = clubProfileSchema.partial().extend({
    clubId: z.string().uuid(), name: z.string().trim().min(1).max(150),
    tagline: z.string().max(300), description: z.string().max(10000),
  }).parse(input);
  const { user } = await requireClubPermission(data.clubId, ["club.settings"]);
  const { clubId, ...fields } = data;
  return prisma.$transaction(async (tx) => {
    await tx.club.update({ where: { id: clubId }, data: fields });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.settings.update",
        targetId: clubId,
        clubId,
      },
    });
    return { success: true };
  });
}
export async function getClubTasks(clubId: string) {
  await requireClubPermission(clubId, ["tasks.manage"]);
  return prisma.clubTask.findMany({
    where: { clubId },
    orderBy: { createdAt: "desc" },
  });
}
export async function saveClubTask(input: {
  clubId: string;
  id?: string;
  title: string;
  description?: string;
  status: string;
}) {
  // No current caller uses this pre-assignment API. Keep the endpoint fail-closed
  // for old clients instead of accepting revisionless writes or creating orphan tasks.
  const clubId = z.string().uuid().parse(input.clubId);
  await requireClubPermission(clubId, ["tasks.manage"]);
  throw new Error("Legacy task writes are disabled. Reload and use the current Tasks workspace.");
}

export async function requestClubClaim(clubId: string, explanation: string) {
  const data = z
    .object({
      clubId: z.string().uuid(),
      explanation: z.string().trim().min(10).max(3000),
    })
    .parse({ clubId, explanation });
  const { user } = await requireAuth();
  if (!(await prisma.club.findUnique({ where: { id: clubId } })))
    throw new Error("Club unavailable.");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${data.clubId} FOR UPDATE`;
    const club = await tx.club.findUnique({ where: { id: data.clubId } });
    if (
      !club ||
      club.claimedAt ||
      (await tx.clubMember.count({
        where: { clubId: data.clubId, isOwner: true },
      }))
    )
      throw new Error(
        "This club is already managed. Ask an existing manager for an invitation.",
      );
    const existing = await tx.clubClaim.findFirst({
      where: { clubId: data.clubId, userId: user.id, status: "PENDING" },
    });
    if (existing) return existing;
    const claim = await tx.clubClaim.create({
      data: { ...data, userId: user.id },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.claim.request",
        targetId: claim.id,
        clubId: data.clubId,
      },
    });
    return claim;
  });
}
