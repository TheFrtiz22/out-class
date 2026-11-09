import "server-only"
import { hasPermission, isActiveMembership } from "@/lib/permissions"
import { assertClubOperational } from "@/lib/club-suspension"
import { roomAuthority, type LiveRoom } from "@/lib/voting-room-projection"
import { prisma } from "@/utils/prisma"
import { verifiedViewer } from "@/utils/verified-viewer"

export type VotingRoomPageAccess = "CONTINUE" | "DENIED" | "SUSPENDED" | "UNAVAILABLE"

/**
 * Route-level preflight for the leader and presentation views. A viewer the room read would refuse
 * gets an access state instead of a thrown read that the client can only report as a connection
 * failure. Mirrors requireAuth's account gate, requireClubPermission's suspended-club check and the
 * room read's membership and roomAuthority rules; the room's own server actions still authorize every
 * read and command. Signed-out viewers keep the sign-in state; Demo, support view-as and degraded
 * cases return CONTINUE so the existing room applies. Nothing about applicants is read.
 */
export async function votingRoomPageAccess(clubId: string, sessionId: string): Promise<VotingRoomPageAccess> {
  try {
    const viewer = await verifiedViewer()
    if (viewer.state === "SIGNED_OUT" || viewer.state === "SKIPPED") return "CONTINUE"
    if (viewer.state === "REFUSED") return "DENIED"
    const [member, session] = await Promise.all([
      prisma.clubMember.findUnique({ where: { userId_clubId: { userId: viewer.userId, clubId } } }),
      prisma.votingSession.findFirst({ where: { id: sessionId, clubId, mode: "LIVE" }, select: { leaderMemberIds: true, participants: { select: { memberId: true } }, round: { select: { anonymousReview: true } } } }),
    ])
    if (!member || !isActiveMembership(member) || !hasPermission(member, "applications.review")) return "DENIED"
    try { await assertClubOperational(prisma, clubId) } catch { return "SUSPENDED" }
    if (!session) return "UNAVAILABLE"
    try { roomAuthority(session as unknown as LiveRoom, member, session.round.anonymousReview) } catch { return "DENIED" }
    return "CONTINUE"
  } catch {
    return "CONTINUE"
  }
}
