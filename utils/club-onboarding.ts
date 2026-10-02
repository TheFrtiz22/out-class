import type { AppTransactionClient } from "@/utils/prisma";
import type { requireAuth } from "@/utils/auth";
import { verifiedSchoolIdentities } from "@/utils/school-identity";
import { canGrantOnboardingRole } from "@/lib/club-onboarding";
import { hasPermission, isActiveMembership, type ClubPermission } from "@/lib/permissions";

export async function recipientInvitation(tx: AppTransactionClient, invitationId: string, account: Awaited<ReturnType<typeof requireAuth>>) {
  const hint = await tx.clubInvitation.findUnique({ where: { id: invitationId } });
  if (!hint) throw new Error("Invitation unavailable.");
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${hint.clubId} FOR UPDATE`;
  const identities = await verifiedSchoolIdentities(tx, account);
  const invitation = await tx.clubInvitation.findUniqueOrThrow({ where: { id: invitationId } });
  if (invitation.status !== "PENDING" || invitation.acceptedAt || invitation.declinedAt || invitation.revokedAt || invitation.expiredAt || invitation.expiresAt <= new Date() || !identities.some(i => i.id === invitation.schoolIdentityId)) {
    throw new Error("Invitation unavailable or expired.");
  }
  return invitation;
}

export async function acceptIdentityInvitationInTransaction(tx: AppTransactionClient, invitationId: string, account: Awaited<ReturnType<typeof requireAuth>>) {
    const invitation = await recipientInvitation(tx, invitationId, account);
    const inviterAccount = await tx.user.findUnique({ where: { id: invitation.invitedBy } });
    if (!inviterAccount || inviterAccount.disabledAt) throw new Error("Inviter account unavailable.");
    if (invitation.authoritySource === "PLATFORM_ADMIN") {
      const allowed = (process.env.OUTCLASS_PLATFORM_ADMIN_IDS || "").split(",").map(s => s.trim());
      const grant = await tx.platformAdmin.findUnique({ where: { userId: invitation.invitedBy } });
      if (!allowed.includes(invitation.invitedBy) || !grant?.active) throw new Error("Platform invitation authority was revoked.");
      if (invitation.requestedRole === "OWNER" && await tx.clubMember.count({ where: { clubId: invitation.clubId, isOwner: true } })) {
        throw new Error("Organization already has an owner. Request an updated invitation.");
      }
    } else {
      const inviter = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: invitation.invitedBy, clubId: invitation.clubId } } });
      if (!canGrantOnboardingRole(inviter, invitation.requestedRole) || invitation.permissions.some(p => !hasPermission(inviter, p as ClubPermission))) {
        throw new Error("The inviter can no longer grant this access.");
      }
    }
    const where = { userId_clubId: { userId: account.user.id, clubId: invitation.clubId } };
    const existing = await tx.clubMember.findUnique({ where });
    // Removed members may rejoin only through a new, currently authorized invitation.
    // Suspensions and invitations predating removal never reactivate membership.
    const rejoining = existing?.status === "LEFT" && invitation.createdAt > existing.updatedAt;
    if (existing && !isActiveMembership(existing) && !rejoining) throw new Error("Membership is inactive. Contact an organization owner.");
    const permissions = Array.from(new Set([...(existing?.permissions || []), ...invitation.permissions]));
    const isOwner = existing?.isOwner === true || invitation.requestedRole === "OWNER";
    const roleOrder = ["MEMBER", "INTERVIEWER", "RECRUITING_ADMIN", "ADMIN", "OWNER"];
    const accessRole = existing && !rejoining && roleOrder.indexOf(existing.accessRole) > roleOrder.indexOf(invitation.requestedRole) ? existing.accessRole : invitation.requestedRole;
    const membership = await tx.clubMember.upsert({ where,
      create: { userId: account.user.id, clubId: invitation.clubId, permissions, isOwner, accessRole },
      update: { permissions, isOwner, accessRole, ...(rejoining ? { status: "ACTIVE", joinedAt: new Date() } : {}) },
    });
    if (isOwner) await tx.club.update({ where: { id: invitation.clubId }, data: { claimedAt: new Date() } });
    const now = new Date();
    await tx.clubInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", acceptedAt: now, claimedAt: now, claimedUserId: account.user.id } });
    await tx.auditLog.create({ data: { actorId: account.user.id, action: "club.invite.accept", targetId: invitation.id, clubId: invitation.clubId, details: { membershipId: membership.id } } });
    return { clubId: invitation.clubId };
}
