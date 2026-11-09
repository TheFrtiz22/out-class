import "server-only"
import { cookies } from "next/headers"
import { z } from "zod"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { prisma } from "@/utils/prisma"
import { getSessionUser } from "@/utils/auth"

/**
 * Older `/vote`, `/live-voting` and `/voting/<id>/join` links can point at a real live voting room.
 * For a signed-in viewer outside Demo Mode, resolve that room's canonical URL; the room page itself
 * enforces membership and roles. Returns null (keep today's page) otherwise. Only the club id and
 * mode are read, so nothing about the session is disclosed beyond what the room's own URL carries.
 */
export async function liveRoomHrefForLegacyLink(sessionId: string | undefined | null) {
  if (!z.string().uuid().safeParse(sessionId).success) return null
  if ((await cookies()).get(DEMO_COOKIE)?.value === "1") return null
  try {
    const { data } = await getSessionUser()
    if (!data.user) return null
    const session = await prisma.votingSession.findUnique({ where: { id: sessionId! }, select: { clubId: true, mode: true } })
    if (!session || session.mode !== "LIVE") return null
    return `/voting/rooms/${encodeURIComponent(sessionId!)}?clubId=${encodeURIComponent(session.clubId)}`
  } catch {
    // A degraded lookup keeps the existing page and its own error handling.
    return null
  }
}
