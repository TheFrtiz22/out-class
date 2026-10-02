"use server";

import { z } from "zod";
import { resendOrganizationInvitation } from "@/actions/invitation-emails";
import type { AppTransactionClient } from "@/utils/prisma";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { canChangeOrganizationRole, canRemoveOrganizationMember, canManageOrganizationInvitation, organizationCapabilities, organizationRoles, organizationRolePermissions } from "@/lib/organization-authorization";
import { createClubIdentityInvitation } from "@/actions/club-onboarding";

const id = z.string().uuid();
async function actorFor(tx: AppTransactionClient, clubId: string, userId: string) {
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const account = await tx.user.findUnique({ where: { id: userId }, select: { disabledAt: true } });
  const actor = await tx.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } } });
  const caps = organizationCapabilities(actor);
  if (!account || account.disabledAt || (!caps.canManageMembers && !caps.canChangeRoles)) throw new Error("Member management access denied.");
  return actor!;
}

async function revokePendingGrants(tx: AppTransactionClient, clubId: string, userId: string) {
  const person = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  await tx.invitationDelivery.updateMany({ where: { status: "QUEUED", invitation: { clubId, status: "PENDING", OR: [{ email: person.email.toLowerCase() }, { schoolIdentity: { userId } }] } }, data: { status: "CANCELLED" } });
  await tx.clubInvitation.updateMany({
    where: { clubId, status: "PENDING", OR: [{ email: person.email.toLowerCase() }, { schoolIdentity: { userId } }] },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
}

async function protectLastOwner(tx: AppTransactionClient, clubId: string, target: { id: string; isOwner: boolean; status: string }) {
  if (target.isOwner && target.status === "ACTIVE" && await tx.clubMember.count({ where: { clubId, id: { not: target.id }, isOwner: true, status: "ACTIVE", user: { disabledAt: null } } }) === 0)
    throw new Error("Assign another active owner before removing the last owner.");
}

export async function getOrganizationMemberManagement(clubId: string) {
  id.parse(clubId);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const actor = await actorFor(tx, clubId, user.id);
    const club = await tx.club.findUniqueOrThrow({ where: { id: clubId }, select: { schoolId: true } });
    return {
      actor,
      members: await tx.clubMember.findMany({ where: { clubId }, include: { user: { select: { email: true, disabledAt: true, studentProfile: { select: { firstName: true, lastName: true, major: true, gradYear: true } } } } }, orderBy: { joinedAt: "asc" } }),
      invitations: await tx.clubInvitation.findMany({ where: { clubId }, include: { schoolIdentity: { select: { normalizedIdentifier: true } }, deliveries: { select: { status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" } }),
      identifierTypes: await tx.schoolIdentifierType.findMany({ where: { schoolId: club.schoolId, school: { active: true }, verification: "EMAIL_LOCAL_PART" }, select: { id: true, label: true }, orderBy: { id: "asc" } }),
    };
  });
}

export async function changeOrganizationMemberRole(input: unknown) {
  const data = z.object({ clubId: id, memberId: id, role: z.enum(organizationRoles) }).strict().parse(input);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const actor = await actorFor(tx, data.clubId, user.id);
    const target = await tx.clubMember.findFirst({ where: { id: data.memberId, clubId: data.clubId }, include: { user: { select: { disabledAt: true } } } });
    if (!target || !canChangeOrganizationRole(actor, target, data.role)) throw new Error("You cannot change this member's role.");
    if (target.user.disabledAt) throw new Error("Role changes require an active account.");
    if (data.role !== "OWNER") await protectLastOwner(tx, data.clubId, target);
    await tx.clubMember.update({ where: { id: target.id }, data: { accessRole: data.role, isOwner: data.role === "OWNER", permissions: organizationRolePermissions[data.role] } });
    await revokePendingGrants(tx, data.clubId, target.userId);
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: target.id, action: "club.member.role", details: { before: { role: target.accessRole, permissions: target.permissions, isOwner: target.isOwner }, after: { role: data.role, permissions: organizationRolePermissions[data.role], isOwner: data.role === "OWNER" } } } });
  });
}

export async function removeOrganizationMember(input: unknown) {
  const data = z.object({ clubId: id, memberId: id }).strict().parse(input);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const actor = await actorFor(tx, data.clubId, user.id);
    const target = await tx.clubMember.findFirst({ where: { id: data.memberId, clubId: data.clubId } });
    if (!target || !canRemoveOrganizationMember(actor, target)) throw new Error("You cannot remove this member.");
    await protectLastOwner(tx, data.clubId, target);
    await tx.clubMember.update({ where: { id: target.id }, data: { status: "LEFT", accessRole: "MEMBER", isOwner: false, permissions: [] } });
    await revokePendingGrants(tx, data.clubId, target.userId);
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: target.id, action: "club.member.remove", details: { before: { role: target.accessRole, permissions: target.permissions, isOwner: target.isOwner, status: target.status }, after: { status: "LEFT" } } } });
  });
}

export async function transferOrganizationOwnership(input: unknown) {
  const data = z.object({ clubId: id, memberId: id, confirm: z.literal(true) }).strict().parse(input);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const actor = await actorFor(tx, data.clubId, user.id);
    const target = await tx.clubMember.findFirst({ where: { id: data.memberId, clubId: data.clubId, status: "ACTIVE", user: { disabledAt: null } } });
    if (!organizationCapabilities(actor).canTransferOwnership || !target || target.userId === user.id || target.isOwner) throw new Error("Transfer requires a different active non-owner member.");
    await tx.clubMember.update({ where: { id: target.id }, data: { accessRole: "OWNER", isOwner: true, permissions: organizationRolePermissions.OWNER } });
    await tx.clubMember.update({ where: { id: actor.id }, data: { accessRole: "ADMIN", isOwner: false, permissions: organizationRolePermissions.ADMIN } });
    await revokePendingGrants(tx, data.clubId, target.userId);
    await revokePendingGrants(tx, data.clubId, actor.userId);
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: target.id, action: "club.owner.transfer", details: { previousOwnerId: actor.id, newOwnerId: target.id } } });
  });
}

export async function inviteOrganizationMember(input: unknown) {
  const data = z.object({ clubId: id, identifierTypeId: z.string().min(1).max(100), identifier: z.string().min(1).max(128), invitedName: z.string().trim().min(1).max(200), invitedYear: z.enum(["2025", "2026", "2027", "2028", "2029", "2030"]).nullable(), requestedRole: z.enum(organizationRoles) }).strict().parse(input);
  return createClubIdentityInvitation(data);
}

export async function manageOrganizationInvitation(input: unknown) {
  const data = z.object({ clubId: id, invitationId: id, action: z.enum(["REVOKE", "RESEND"]) }).strict().parse(input);
  if (data.action === "RESEND") return resendOrganizationInvitation(data.clubId, data.invitationId);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const actor = await actorFor(tx, data.clubId, user.id);
    const invitation = await tx.clubInvitation.findFirst({ where: { id: data.invitationId, clubId: data.clubId } });
    if (!invitation || invitation.status !== "PENDING" || invitation.acceptedAt || invitation.declinedAt || invitation.revokedAt || !canManageOrganizationInvitation(actor, invitation)) throw new Error("Invitation unavailable or above your authority.");
    if (data.action === "REVOKE") {
      await tx.invitationDelivery.updateMany({ where: { invitationId: invitation.id, status: "QUEUED" }, data: { status: "CANCELLED" } });
      await tx.clubInvitation.update({ where: { id: invitation.id }, data: { status: "REVOKED", revokedAt: new Date() } });
    }
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: invitation.id, action: data.action === "REVOKE" ? "club.invite.revoke" : "club.invite.resend.request" } });
    return { queued: data.action === "RESEND", reused: false };
  });
}
