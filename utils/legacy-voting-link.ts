import "server-only"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { verifiedViewer } from "@/utils/verified-viewer"

/**
 * Older `/vote`, `/live-voting` and `/voting/<id>/join` links (printed QR codes, short links, emails)
 * map onto voting rooms, the one voting system. Only a verified viewer (requireAuth's account rules)
 * who is an ACTIVE member of the session's operational club gets a session URL: a live room opens the
 * room, and a retired board (LEGACY) session opens its read-only history. Both pages still enforce
 * roles. Everyone else gets null and the same generic page, so the link reveals nothing about whether
 * or where a session exists.
 */
export async function liveRoomHrefForLegacyLink(sessionId: string | undefined | null) {
  if (!z.string().uuid().safeParse(sessionId).success) return null
  try {
    const viewer = await verifiedViewer()
    if (viewer.state !== "VERIFIED") return null
    const session = await prisma.votingSession.findFirst({
      where: { id: sessionId!, club: { suspendedAt: null, members: { some: { userId: viewer.userId, status: "ACTIVE" } } } },
      select: { clubId: true, mode: true },
    })
    if (!session) return null
    const id = encodeURIComponent(sessionId!), clubId = encodeURIComponent(session.clubId)
    return session.mode === "LIVE" ? `/voting/rooms/${id}?clubId=${clubId}` : `/voting/rooms/${id}/history?clubId=${clubId}`
  } catch {
    // A degraded lookup keeps the generic page and its own error handling.
    return null
  }
}
