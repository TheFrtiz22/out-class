"use server";

import { lockOperationalClub } from "@/lib/club-suspension";

import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { verifiedSchoolIdentities } from "@/utils/school-identity";
import { canGrantOnboardingRole } from "@/lib/club-onboarding";
import { acceptIdentityInvitationInTransaction, recipientInvitation, createIdentityInvitationInTransaction } from "@/utils/club-onboarding";
import { hasPermission, type ClubPermission } from "@/lib/permissions";

const id = z.string().uuid();
const invitationInput = z.object({
  clubId: id,
  identifierTypeId: z.string().min(1).max(100),
  identifier: z.string().min(1).max(128),
  invitedName: z.string().trim().max(200).nullable().default(null),
  invitedYear: z.string().trim().max(80).nullable().default(null),
  requestedRole: z.enum(["OWNER", "ADMIN", "RECRUITING_ADMIN", "INTERVIEWER", "MEMBER"]).default("MEMBER"),
  deliveryEmail: z.string().trim().toLowerCase().email().max(254).optional(),
  platformDesignation: z.boolean().default(false),
}).strict();

/** Creates identity-bound invitations only; no User is created for the recipient. */
export async function createClubIdentityInvitation(input: unknown) {
  const data = invitationInput.parse(input);
  const actor = data.platformDesignation ? await requirePlatformAdmin() : (await requireAuth()).user;
  return prisma.$transaction(async tx => {
    return createIdentityInvitationInTransaction(tx, data, actor);
  });
}

export async function getOrganizationInvitations(includeDismissed = false) {
  z.boolean().parse(includeDismissed);
  const account = await requireAuth({ verifyEmail: true });
  return prisma.$transaction(async tx => {
    const identities = await verifiedSchoolIdentities(tx, account);
    return tx.clubInvitation.findMany({
      where: { schoolIdentityId: { in: identities.map(i => i.id) }, status: "PENDING", expiresAt: { gt: new Date() }, ...(includeDismissed ? {} : { dismissedAt: null }) },
      select: { id: true, invitedName: true, invitedYear: true, requestedRole: true, permissions: true, expiresAt: true, dismissedAt: true, club: { select: { id: true, name: true, logoUrl: true, color: true } } },
      orderBy: { createdAt: "desc" }, ...(includeDismissed ? {} : { take: 100 }),
    });
  });
}

export async function acceptIdentityClubInvitation(invitationId: string) {
  id.parse(invitationId);
  const account = await requireAuth({ verifyEmail: true });
  return prisma.$transaction(tx => acceptIdentityInvitationInTransaction(tx, invitationId, account));
}

/** Dismissal is reversible and never changes invitation status or membership. */
export async function setOrganizationInvitationDismissed(invitationId: string, dismissed: boolean) {
  id.parse(invitationId); z.boolean().parse(dismissed);
  const account = await requireAuth({ verifyEmail: true });
  return prisma.$transaction(async tx => {
    const invitation = await recipientInvitation(tx, invitationId, account);
    await tx.clubInvitation.update({ where: { id: invitation.id }, data: { dismissedAt: dismissed ? new Date() : null } });
    await tx.auditLog.create({ data: { actorId: account.user.id, action: dismissed ? "club.invite.dismiss" : "club.invite.restore", targetId: invitation.id, clubId: invitation.clubId } });
  });
}

export async function declineIdentityClubInvitation(invitationId: string) {
  id.parse(invitationId);
  const account = await requireAuth({ verifyEmail: true });
  return prisma.$transaction(async tx => {
    const invitation = await recipientInvitation(tx, invitationId, account);
    await tx.clubInvitation.update({ where: { id: invitation.id }, data: { status: "DECLINED", declinedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: account.user.id, action: "club.invite.decline", targetId: invitation.id, clubId: invitation.clubId } });
  });
}

export async function revokeIdentityClubInvitation(invitationId: string, platformOperation = false) {
  id.parse(invitationId); z.boolean().parse(platformOperation);
  const user = platformOperation ? await requirePlatformAdmin() : (await requireAuth()).user;
  return prisma.$transaction(async tx => {
    const hint = await tx.clubInvitation.findUnique({ where: { id: invitationId } });
    if (!hint) throw new Error("Invitation unavailable.");
    await lockOperationalClub(tx, hint.clubId);
    const invitation = await tx.clubInvitation.findUniqueOrThrow({ where: { id: invitationId } });
    const member = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId: invitation.clubId } } });
    if (!platformOperation && (!canGrantOnboardingRole(member, invitation.requestedRole) || invitation.permissions.some(p => !hasPermission(member, p as ClubPermission)))) {
      throw new Error("You cannot revoke this invitation's grant.");
    }
    if (!invitation.schoolIdentityId || invitation.status !== "PENDING") throw new Error("Invitation unavailable.");
    await tx.clubInvitation.update({ where: { id: invitation.id }, data: { status: "REVOKED", revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "club.invite.revoke", targetId: invitation.id, clubId: invitation.clubId } });
  });
}

/** Audit foundation only: CSV parsing/confirmation and invitation processing come later. */
export async function recordRosterImport(input: unknown) {
  const data = z.object({
    clubId: id, filename: z.string().trim().min(1).max(255), idempotencyKey: z.string().min(1).max(100),
    rows: z.array(z.record(z.string().max(2000))).max(10000),
  }).strict().parse(input);
  const serialized = JSON.stringify(data.rows);
  if (Buffer.byteLength(serialized) > 1024 * 1024) throw new Error("Roster audit payload exceeds 1 MB.");
  const { user } = await requireClubPermission(data.clubId, ["members.manage"]);
  return prisma.$transaction(async tx => {
    await lockOperationalClub(tx, data.clubId);
    const manager = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId: data.clubId } } });
    if (!hasPermission(manager, "members.manage")) throw new Error("Roster upload access denied.");
    const fileHash = createHash("sha256").update(serialized).digest("hex");
    const existing = await tx.rosterImport.findUnique({ where: { clubId_idempotencyKey: { clubId: data.clubId, idempotencyKey: data.idempotencyKey } } });
    if (existing) {
      if (existing.fileHash !== fileHash || existing.filename !== data.filename) throw new Error("Import key was already used for another upload.");
      return { id: existing.id, reused: true };
    }
    const record = await tx.rosterImport.create({ data: {
      clubId: data.clubId, uploadedById: user.id, filename: data.filename, fileHash, idempotencyKey: data.idempotencyKey,
      status: "PROCESSING", rowCount: data.rows.length,
      rows: { create: data.rows.map((row, index) => ({ rowNumber: index + 1, input: row,
        invitedName: row.name?.slice(0, 200) || null, invitedYear: row.year?.slice(0, 80) || null, identifier: row.computing_id?.slice(0, 128) || null,
      })) },
    } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "club.roster.upload", targetId: record.id, clubId: data.clubId, details: { rowCount: data.rows.length } } });
    return { id: record.id, reused: false };
  });
}

export async function getRosterImport(importId: string) {
  id.parse(importId);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const hint = await tx.rosterImport.findUniqueOrThrow({ where: { id: importId } });
    await lockOperationalClub(tx, hint.clubId);
    const member = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId: hint.clubId } } });
    if (!hasPermission(member, "members.manage")) throw new Error("Roster access denied.");
    return tx.rosterImport.findUniqueOrThrow({ where: { id: importId }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  });
}
