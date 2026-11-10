import "server-only"
import { prisma } from "@/utils/prisma"
import { membershipRoleLabels, type MembershipRole } from "@/lib/copy/terms"

/**
 * What a signed-out visitor holding a link may see before signing in. Nothing here grants access:
 * accepting an invitation, claiming a club or editing access still runs the existing server-side
 * identity checks after sign-in (the URL is never trusted).
 *
 * Invitation preview: club name and offered role, only for a pending, unexpired, unanswered
 * invitation of an unsuspended club. Never the invited email, inviter, school identity, or why a
 * link is invalid (unknown, expired, revoked and answered all return null alike).
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type InvitationPreview = { clubName: string; role: string; owner: boolean }

export async function invitationPreview(id: string, now = new Date()): Promise<InvitationPreview | null> {
  if (!uuid.test(id)) return null
  try {
    const invitation = await prisma.clubInvitation.findFirst({
      where: { id, status: "PENDING", acceptedAt: null, declinedAt: null, revokedAt: null, expiresAt: { gt: now }, club: { suspendedAt: null } },
      select: { requestedRole: true, schoolIdentityId: true, club: { select: { name: true } } },
    })
    if (!invitation) return null
    const owner = !!invitation.schoolIdentityId && invitation.requestedRole === "OWNER"
    return { clubName: invitation.club.name, role: membershipRoleLabels[invitation.requestedRole as MembershipRole] ?? membershipRoleLabels.MEMBER, owner }
  } catch {
    return null
  }
}

/** Club name for sign-in cards on club-scoped links (unsuspended clubs only; same fields as public SEO). */
export async function clubLinkPreview(clubId: string): Promise<{ name: string } | null> {
  if (!clubId || clubId.length > 200) return null
  try {
    return await prisma.club.findFirst({ where: { OR: [{ id: clubId }, { slug: clubId }], suspendedAt: null }, select: { name: true } })
  } catch {
    return null
  }
}
