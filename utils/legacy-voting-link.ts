import "server-only"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { verifiedViewer } from "@/utils/verified-viewer"

/**
 * Older `/vote`, `/live-voting` and `/voting/<id>/join` links can point at a real live voting room.
 * Only a verified viewer (requireAuth's account rules) who is an ACTIVE member of the session's
 * operational club is sent to the room's canonical URL; the room still enforces roles. Everyone else
 * gets today's page, so the link reveals nothing about whether or where a session exists.
 */
export async function liveRoomHrefForLegacyLink(sessionId: string | undefined | null) {
  if (!z.string().uuid().safeParse(sessionId).success) return null
  try {
    const viewer = await verifiedViewer()
    if (viewer.state !== "VERIFIED") return null
    const session = await prisma.votingSession.findFirst({
      where: { id: sessionId!, mode: "LIVE", club: { suspendedAt: null, members: { some: { userId: viewer.userId, status: "ACTIVE" } } } },
      select: { clubId: true },
    })
    return session ? `/voting/rooms/${encodeURIComponent(sessionId!)}?clubId=${encodeURIComponent(session.clubId)}` : null
  } catch {
    // A degraded lookup keeps the existing page and its own error handling.
    return null
  }
}
