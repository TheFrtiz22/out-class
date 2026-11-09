import "server-only"
import { cookies } from "next/headers"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { hasPermission, isActiveMembership } from "@/lib/permissions"
import { roomAuthority, type LiveRoom } from "@/lib/voting-room-projection"
import { prisma } from "@/utils/prisma"
import { getSessionUser } from "@/utils/auth"

export type VotingRoomPageAccess = "CONTINUE" | "DENIED" | "UNAVAILABLE"

/**
 * Route-level preflight for the leader and presentation views. A viewer the room read would refuse
 * gets an access state instead of a thrown read that the client can only report as a connection
 * failure. Uses the same membership and roomAuthority rules as the room read; the room's own server
 * actions still authorize every read and command. Signed-out, Demo, support-view and degraded cases
 * return CONTINUE so the existing client states apply. Nothing about applicants is read.
 */
export async function votingRoomPageAccess(clubId: string, sessionId: string): Promise<VotingRoomPageAccess> {
  try {
    const jar = await cookies()
    if (jar.get(DEMO_COOKIE)?.value === "1" || jar.has(PLATFORM_VIEW_COOKIE)) return "CONTINUE"
    const { data } = await getSessionUser()
    if (!data.user) return "CONTINUE"
    const [member, session] = await Promise.all([
      prisma.clubMember.findUnique({ where: { userId_clubId: { userId: data.user.id, clubId } } }),
      prisma.votingSession.findFirst({ where: { id: sessionId, clubId, mode: "LIVE" }, select: { leaderMemberIds: true, participants: { select: { memberId: true } }, round: { select: { anonymousReview: true } } } }),
    ])
    if (!member || !isActiveMembership(member) || !hasPermission(member, "applications.review")) return "DENIED"
    if (!session) return "UNAVAILABLE"
    try { roomAuthority(session as unknown as LiveRoom, member, session.round.anonymousReview) } catch { return "DENIED" }
    return "CONTINUE"
  } catch {
    return "CONTINUE"
  }
}
