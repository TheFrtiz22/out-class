import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/utils/prisma";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
export const viewTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function platformViewSession() {
  const actor = await requirePlatformAdmin({ allowViewAs: true });
  const token = (await cookies()).get(PLATFORM_VIEW_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await prisma.platformViewSession.findUnique({
    where: { tokenHash: viewTokenHash(token) },
  });
  if (!session || session.actorId !== actor.id || session.endedAt) return null;
  if (
    await prisma.platformAdmin.findUnique({
      where: { userId: session.targetUserId },
    })
  )
    return null;
  if (session.expiresAt <= new Date()) {
    await prisma.$transaction(async (tx) => {
      const result = await tx.platformViewSession.updateMany({
        where: { id: session.id, endedAt: null },
        data: { endedAt: new Date() },
      });
      if (result.count)
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: "platform.view-as.end",
            targetId: session.targetUserId,
            clubId: session.clubId,
            reason: "Session expired",
            details: { sessionId: session.id },
          },
        });
    });
    return null;
  }
  return session;
}
