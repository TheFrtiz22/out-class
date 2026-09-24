"use server";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requirePlatformAdmin } from "@/utils/platform-admin";
export async function listClubClaims(status: string, page = 0) {
  const actor = await requirePlatformAdmin();
  const filter = z.enum(["PENDING", "APPROVED", "REJECTED"]).parse(status);
  const skip = z.number().int().min(0).max(10000).parse(page) * 50;
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "platform.claims.read",
      targetId: filter,
    },
  });
  const claims = await prisma.clubClaim.findMany({
    where: { status: filter },
    take: 50,
    skip,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    include: {
      club: { select: { name: true } },
      user: { select: { email: true } },
    },
  });
  const history = await prisma.auditLog.findMany({
    where: {
      targetId: { in: claims.map((c) => c.id) },
      action: { in: ["club.claim.request", "platform.claim.change"] },
    },
    orderBy: { createdAt: "asc" },
  });
  return claims.map((claim) => ({
    ...claim,
    history: history.filter((h) => h.targetId === claim.id),
  }));
}
