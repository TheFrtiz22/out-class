
import { lockOperationalClub } from "@/lib/club-suspension";
import { z } from "zod";
import type { AppTransactionClient } from "@/utils/prisma";
import type { requireAuth } from "@/utils/auth";
import { verifiedSchoolIdentities } from "@/utils/school-identity";
import { canGrantOnboardingRole, invitationPurpose, normalizeSchoolIdentifier, onboardingRolePermissions } from "@/lib/club-onboarding";
import { hasPermission, isActiveMembership, type ClubPermission } from "@/lib/permissions";

export async function recipientInvitation(tx: AppTransactionClient, invitationId: string, account: Awaited<ReturnType<typeof requireAuth>>) {
  const hint = await tx.clubInvitation.findUnique({ where: { id: invitationId } });
  if (!hint) throw new Error("Invitation unavailable.");
  await lockOperationalClub(tx, hint.clubId);
  const identities = await verifiedSchoolIdentities(tx, account);
  const invitation = await tx.clubInvitation.findUniqueOrThrow({ where: { id: invitationId } });
  if (invitation.applicationId || invitation.status !== "PENDING" || invitation.acceptedAt || invitation.declinedAt || invitation.revokedAt || invitation.expiredAt || invitation.expiresAt <= new Date() || !identities.some(i => i.id === invitation.schoolIdentityId)) {
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

/** Shared canonical invitation creation; callers authorize before opening the transaction. */
export async function createIdentityInvitationInTransaction(tx: AppTransactionClient, data: { clubId: string; identifierTypeId: string; identifier: string; invitedName: string | null; invitedYear: string | null; requestedRole: keyof typeof onboardingRolePermissions; deliveryEmail?: string; platformDesignation: boolean }, actor: { id: string }) {
    await lockOperationalClub(tx, data.clubId);
    const club = await tx.club.findUniqueOrThrow({ where: { id: data.clubId } });
    const config = await tx.schoolIdentifierType.findUniqueOrThrow({ where: { id: data.identifierTypeId }, include: { school: true } });
    if (config.schoolId !== club.schoolId || !config.school.active) throw new Error("Identifier type does not belong to this organization's active school.");
    const member = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: actor.id, clubId: club.id } } });
    if (!data.platformDesignation && !canGrantOnboardingRole(member, data.requestedRole)) throw new Error("You cannot grant this organization role.");
    if (data.platformDesignation && data.requestedRole === "OWNER" &&
        (club.claimedAt || await tx.clubMember.count({ where: { clubId: club.id, isOwner: true } }))) {
      throw new Error("Organization already claimed. Use existing ownership management.");
    }
    const normalized = normalizeSchoolIdentifier(data.identifier, config);
    const email = config.verification === "EMAIL_LOCAL_PART" && config.emailDomain
      ? `${normalized}@${config.emailDomain}` : data.deliveryEmail;
    if (!email || !z.string().email().safeParse(email).success) throw new Error("A delivery address or configured school email mapping is required.");
    const identity = await tx.schoolIdentity.upsert({
      where: { schoolId_identifierTypeId_normalizedIdentifier: { schoolId: config.schoolId, identifierTypeId: config.id, normalizedIdentifier: normalized } },
      create: { schoolId: config.schoolId, identifierTypeId: config.id, identifier: data.identifier, normalizedIdentifier: normalized }, update: {},
    });
    const existingMember = await tx.clubMember.findFirst({ where: { clubId: club.id, status: "ACTIVE", OR: [...(identity.userId ? [{ userId: identity.userId }] : []), { user: { email } }] } });
    if (existingMember) throw new Error("This person is already an active member. Change their role through member management.");
    const expired = await tx.clubInvitation.findMany({ where: { clubId: club.id, schoolIdentityId: identity.id, status: "PENDING", expiresAt: { lte: new Date() } }, select: { id: true } });
    for (const stale of expired) {
      await tx.clubInvitation.update({ where: { id: stale.id }, data: { status: "EXPIRED", expiredAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "club.invite.expire", targetId: stale.id, clubId: club.id } });
    }
    const pending = await tx.clubInvitation.findFirst({ where: { clubId: club.id, schoolIdentityId: identity.id, status: "PENDING" } });
    if (pending) {
      if (pending.requestedRole !== data.requestedRole || pending.authoritySource !== (data.platformDesignation ? "PLATFORM_ADMIN" : "CLUB_MEMBER")) {
        throw new Error("A different invitation is pending. Revoke it before changing its grant.");
      }
      return { id: pending.id, reused: true };
    }
    const invitation = await tx.clubInvitation.create({ data: {
      clubId: club.id, schoolId: config.schoolId, schoolIdentityId: identity.id, email,
      invitedBy: actor.id, invitedName: data.invitedName, invitedYear: data.invitedYear,
      requestedRole: data.requestedRole, purpose: invitationPurpose(data.requestedRole),
      authoritySource: data.platformDesignation ? "PLATFORM_ADMIN" : "CLUB_MEMBER",
      permissions: onboardingRolePermissions[data.requestedRole], expiresAt: new Date(Date.now() + 7 * 86400000),
    } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "club.identity-invite.create", targetId: invitation.id, clubId: club.id, details: { requestedRole: data.requestedRole, schoolIdentityId: identity.id } } });
    return { id: invitation.id, reused: false };
}
