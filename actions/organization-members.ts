"use server";
import { revokeClubInvitations } from "@/utils/revoke-club-invitations";
import { memberAcademicProfile } from "@/lib/recruitment-profile";

import { lockOperationalClub } from "@/lib/club-suspension";
import { interviewCapabilities, interviewOfficesSchema, interviewScopeSchema } from "@/lib/interview-access";

import { clubPermissions, hasPermission } from "@/lib/permissions";
import { canControlOrganizationAccess } from "@/lib/organization-authorization";
import { enqueueInvitationEmails } from "@/utils/invitation-delivery";
import { invitationEmailConfig } from "@/utils/email";
import { scheduleInvitationDelivery } from "@/utils/invitation-background";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resendOrganizationInvitation } from "@/actions/invitation-emails";
import type { AppTransactionClient } from "@/utils/prisma";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { canChangeOrganizationRole, canRemoveOrganizationMember, canManageOrganizationInvitation, organizationCapabilities, organizationRoles, organizationRolePermissions } from "@/lib/organization-authorization";
import { createClubIdentityInvitation } from "@/actions/club-onboarding";

const id = z.string().uuid();

/** Explicit attestation by an active owner, never inferred from an access-role template. */
export async function setMemberInterviewOffices(input: unknown) {
  const data = z.object({ clubId: id, memberId: id, offices: interviewOfficesSchema }).strict().parse(input);
  const { user } = await requireAuth({ verifyEmail: true });
  return prisma.$transaction(async tx => {
    const actor = await actorFor(tx, data.clubId, user.id);
    if (!interviewCapabilities(actor).manageGrants) throw new Error("Only an active owner can attest interview offices.");
    const target = await tx.clubMember.findFirst({ where: { id: data.memberId, clubId: data.clubId, status: "ACTIVE", user: { disabledAt: null } } });
    if (!target) throw new Error("Active member required.");
    await tx.clubMember.update({ where: { id: target.id }, data: { interviewOffices: data.offices } });
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: target.id, action: "interview.offices.change", details: { before: target.interviewOffices, after: data.offices } } });
    return { memberId: target.id, offices: data.offices };
  });
}

export async function setInterviewPanelAssignment(input: unknown) {
  const data = interviewScopeSchema.extend({ memberId: id, assigned: z.boolean() }).strict().parse(input);
  const { user } = await requireAuth({ verifyEmail: true });
  return prisma.$transaction(async tx => {
    const actor = await actorFor(tx, data.clubId, user.id);
    // Assignment conveys private evidence access; ordinary schedulers cannot self-grant.
    if (!interviewCapabilities(actor).manageGrants) throw new Error("Only an active owner can grant panel access.");
    const target = await tx.clubMember.findFirst({ where: { id: data.memberId, clubId: data.clubId }, include: { user: { select: { disabledAt: true } } } });
    const app = await tx.application.findFirst({ where: { id: data.applicationId, clubId: data.clubId, status: { not: "DRAFTING" } } });
    const round = await tx.pipelineRound.findFirst({ where: { id: data.roundId, clubId: data.clubId } });
    if (!target || !app || !round || app.studentId === target.userId) throw new Error("Panel scope unavailable.");
    if (data.assigned && (target.user.disabledAt || !interviewCapabilities(target).participate || app.roundId !== round.id || round.anonymousReview)) throw new Error("Active identified reviewer and current round required.");
    const key = { applicationId: app.id, roundId: round.id, memberId: target.id };
    if (data.assigned) await tx.interviewPanelAssignment.upsert({ where: { applicationId_roundId_memberId: key }, create: { ...key, grantedBy: user.id }, update: { revokedAt: null, grantedBy: user.id, grantedAt: new Date(), bookingManaged: false, bookingId: null } });
    else await tx.interviewPanelAssignment.updateMany({ where: key, data: { revokedAt: new Date(), bookingManaged: false, bookingId: null } });
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: target.id, action: "interview.panel.change", details: { ...key, assigned: data.assigned } } });
    return { ...key, assigned: data.assigned };
  });
}
async function actorFor(tx: AppTransactionClient, clubId: string, userId: string, lock = true) {
  if (lock) {
    await lockOperationalClub(tx, clubId);
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  }
  const account = await tx.user.findUnique({ where: { id: userId }, select: { disabledAt: true } });
  const actor = await tx.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } } });
  const caps = organizationCapabilities(actor);
  if (!account || account.disabledAt || (!caps.canManageMembers && !caps.canChangeRoles)) throw new Error("Member management access denied.");
  return actor!;
}

async function revokePendingGrants(tx: AppTransactionClient, clubId: string, userId: string, actorId: string) {
  const person = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  await tx.invitationDelivery.updateMany({ where: { status: "QUEUED", invitation: { clubId, status: "PENDING", OR: [{ email: person.email.toLowerCase() }, { schoolIdentity: { userId } }] } }, data: { status: "CANCELLED" } });
  await revokeClubInvitations(tx, { clubId, status: "PENDING", OR: [{ email: person.email.toLowerCase() }, { schoolIdentity: { userId } }] }, actorId, "organization-members.revocation");
}

async function protectLastOwner(tx: AppTransactionClient, clubId: string, target: { id: string; isOwner: boolean; status: string }) {
  if (target.isOwner && target.status === "ACTIVE" && await tx.clubMember.count({ where: { clubId, id: { not: target.id }, isOwner: true, status: "ACTIVE", user: { disabledAt: null } } }) === 0)
    throw new Error("Assign another active owner before removing the last owner.");
}

export async function getOrganizationMemberManagement(clubId: string) {
  id.parse(clubId);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const actor = await actorFor(tx, clubId, user.id, false);
    const club = await tx.club.findUniqueOrThrow({ where: { id: clubId }, select: { schoolId: true } });
    const [members, invitations, identifierTypes] = await Promise.all([
      tx.clubMember.findMany({ where: { clubId }, include: { user: { select: { email: true, disabledAt: true, studentProfile: { select: { firstName: true, lastName: true, major: true, gradYear: true, transferStudent: true } } } } }, orderBy: { joinedAt: "asc" } }),
      tx.clubInvitation.findMany({ where: { clubId }, select: { id: true, email: true, invitedName: true, invitedYear: true, requestedRole: true, permissions: true, status: true, expiresAt: true, schoolIdentity: { select: { normalizedIdentifier: true } }, deliveries: { select: { status: true, createdAt: true, failureCode: true }, orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" } }),
      tx.schoolIdentifierType.findMany({ where: { schoolId: club.schoolId, school: { active: true }, verification: "EMAIL_LOCAL_PART" }, select: { id: true, label: true }, orderBy: { id: "asc" } }),
    ]);
    return { actor, members: members.map(m => ({ ...m, user: { ...m.user, studentProfile: m.user.studentProfile ? memberAcademicProfile(m.user.studentProfile) : null } })), invitations, identifierTypes };
  });
}

export async function changeOrganizationMemberRole(input: unknown) {
  const data = z.object({ clubId: id, memberId: id, role: z.enum(organizationRoles) }).strict().parse(input);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const actor = await actorFor(tx, data.clubId, user.id);
    const target = await tx.clubMember.findFirst({ where: { id: data.memberId, clubId: data.clubId }, include: { user: { select: { disabledAt: true } } } });
    if (!target || (!actor.isOwner && target.interviewOffices?.length) || !canChangeOrganizationRole(actor, target, data.role)) throw new Error("You cannot change this member's role.");
    if (target.user.disabledAt) throw new Error("Role changes require an active account.");
    if (data.role !== "OWNER") await protectLastOwner(tx, data.clubId, target);
    await tx.clubMember.update({ where: { id: target.id }, data: { accessRole: data.role, isOwner: data.role === "OWNER", permissions: organizationRolePermissions[data.role] } });
    await revokePendingGrants(tx, data.clubId, target.userId, user.id);
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: target.id, action: "club.member.role", details: { before: { role: target.accessRole, permissions: target.permissions, isOwner: target.isOwner }, after: { role: data.role, permissions: organizationRolePermissions[data.role], isOwner: data.role === "OWNER" } } } });
  });
}

export async function removeOrganizationMember(input: unknown) {
  const data = z.object({ clubId: id, memberId: id }).strict().parse(input);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const actor = await actorFor(tx, data.clubId, user.id);
    const target = await tx.clubMember.findFirst({ where: { id: data.memberId, clubId: data.clubId } });
    if (!target || (!actor.isOwner && target.interviewOffices?.length) || !canRemoveOrganizationMember(actor, target)) throw new Error("You cannot remove this member.");
    await protectLastOwner(tx, data.clubId, target);
    await tx.clubMember.update({ where: { id: target.id }, data: { status: "LEFT", accessRole: "MEMBER", isOwner: false, permissions: [] } });
    await revokePendingGrants(tx, data.clubId, target.userId, user.id);
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
    await revokePendingGrants(tx, data.clubId, target.userId, user.id);
    await revokePendingGrants(tx, data.clubId, actor.userId, user.id);
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
      await revokeClubInvitations(tx, { id: invitation.id, clubId: data.clubId, status: "PENDING" }, user.id, "organization.invitation.revoke");
    }
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: invitation.id, action: data.action === "REVOKE" ? "club.invite.revoke" : "club.invite.resend.request" } });
    return { queued: data.action === "RESEND", reused: false };
  });
}

/** One atomic mutation: authorization and sole-owner checks cover the complete selection. */
export async function bulkOrganizationMembers(input: unknown) {
  const data = z.object({ clubId: id, targets: z.array(z.object({ id, updatedAt: z.coerce.date() }).strict()).min(1).max(100), action: z.enum(["ROLE", "PERMISSIONS", "REMOVE"]), role: z.enum(organizationRoles).optional(), permissions: z.array(z.enum(clubPermissions)).max(clubPermissions.length).optional() }).strict().parse(input);
  if (new Set(data.targets.map(t => t.id)).size !== data.targets.length) throw new Error("Duplicate members in selection.");
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const actor = await actorFor(tx, data.clubId, user.id);
    const targets = await tx.clubMember.findMany({ where: { clubId: data.clubId, id: { in: data.targets.map(t => t.id) } }, include: { user: { select: { disabledAt: true, email: true } } } });
    if (targets.length !== data.targets.length || targets.some(t => t.status !== "ACTIVE" || t.user.disabledAt || +t.updatedAt !== +data.targets.find(x => x.id === t.id)!.updatedAt)) throw new Error("Selected memberships changed. Refresh before trying again.");
    if (data.action === "ROLE" && (!data.role || targets.some(t => !canChangeOrganizationRole(actor, t, data.role!)))) throw new Error("You cannot grant this role to the complete selection.");
    if (data.action === "REMOVE" && targets.some(t => !canRemoveOrganizationMember(actor, t))) throw new Error("You cannot remove the complete selection.");
    if (data.action === "PERMISSIONS" && (!data.permissions || !hasPermission(actor, "leaders.manage") || targets.some(t => t.isOwner || !canControlOrganizationAccess(actor, t)) || data.permissions.some(p => !hasPermission(actor, p)))) throw new Error("These permissions exceed your authority, or the selection contains an owner.");
    const ids = targets.map(t => t.id);
    if ((data.action === "REMOVE" || data.action === "ROLE" && data.role !== "OWNER") && targets.some(t => t.isOwner) && !await tx.clubMember.count({ where: { clubId: data.clubId, isOwner: true, status: "ACTIVE", id: { notIn: ids }, user: { disabledAt: null } } })) throw new Error("Assign another active owner before changing all selected owners.");
    const fields = data.action === "REMOVE" ? { status: "LEFT" as const, accessRole: "MEMBER" as const, isOwner: false, permissions: [] } : data.action === "ROLE" ? { accessRole: data.role!, isOwner: data.role === "OWNER", permissions: organizationRolePermissions[data.role!] } : { permissions: [...new Set(data.permissions!)] };
    await tx.clubMember.updateMany({ where: { clubId: data.clubId, id: { in: ids } }, data: fields });
    const grants = { clubId: data.clubId, status: "PENDING" as const, OR: [{ email: { in: targets.map(t => t.user.email.toLowerCase()), mode: "insensitive" as const } }, { schoolIdentity: { userId: { in: targets.map(t => t.userId) } } }] };
    await tx.invitationDelivery.updateMany({ where: { status: "QUEUED", invitation: grants }, data: { status: "CANCELLED" } });
    await revokeClubInvitations(tx, grants, user.id, "organization-members.revocation");
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: data.clubId, action: `club.members.bulk.${data.action.toLowerCase()}`, details: { before: targets.map(t => ({ id: t.id, role: t.accessRole, isOwner: t.isOwner, permissions: t.permissions, status: t.status })), after: fields } } });
    return { count: targets.length };
  });
}
export async function bulkOrganizationInvitations(input: unknown) {
  const data = z.object({ clubId: id, invitationIds: z.array(id).min(1).max(100), action: z.enum(["REVOKE", "RESEND"]) }).strict().parse(input);
  if (new Set(data.invitationIds).size !== data.invitationIds.length) throw new Error("Duplicate invitations in selection.");
  const { user } = await requireAuth();
  if (data.action === "RESEND") invitationEmailConfig();
  const result = await prisma.$transaction(async tx => {
    const actor = await actorFor(tx, data.clubId, user.id);
    const invitations = await tx.clubInvitation.findMany({ where: { id: { in: data.invitationIds }, clubId: data.clubId } });
    if (invitations.length !== data.invitationIds.length || invitations.some(i => i.status !== "PENDING" || i.revokedAt || i.acceptedAt || i.declinedAt || !canManageOrganizationInvitation(actor, i))) throw new Error("Selection contains unavailable invitations or grants above your authority.");
    let queued = 0;
    if (data.action === "REVOKE") {
      await tx.invitationDelivery.updateMany({ where: { invitationId: { in: data.invitationIds }, status: "QUEUED" }, data: { status: "CANCELLED" } });
      await revokeClubInvitations(tx, { clubId: data.clubId, id: { in: data.invitationIds } }, user.id, "organization-members.revocation");
    } else {
      // Cooldown, grant scope, and send limits are enforced by the shared outbox.
      queued = (await enqueueInvitationEmails(tx, data.clubId, user.id, invitations.map(i => ({ invitationId: i.id, key: randomUUID() })))).queued;
    }
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: data.clubId, action: `club.invites.bulk.${data.action.toLowerCase()}`, details: { invitationIds: data.invitationIds, queued } } });
    return { count: invitations.length, queued };
  }, { timeout: 30000 });
  if (result.queued) scheduleInvitationDelivery(data.clubId);
  return result;
}
