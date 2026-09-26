"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { clubPermissions, hasPermission } from "@/lib/permissions";
import { isUvaEmail } from "@/lib/auth";

const permissionsSchema = z
  .array(z.enum(clubPermissions))
  .max(clubPermissions.length);
const invitationSchema = z.object({
  clubId: z.string().uuid(),
  email: z.string().trim().toLowerCase().refine(isUvaEmail, "Use a UVA email."),
  permissions: permissionsSchema,
});

export async function getClubAccess(clubId: string) {
  await requireClubPermission(clubId, ["leaders.manage"]);
  return {
    members: await prisma.clubMember.findMany({
      where: { clubId },
      include: { user: { select: { email: true } } },
    }),
    invitations: await prisma.clubInvitation.findMany({
      where: {
        clubId,
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
  };
}

export async function inviteClubManager(
  input: z.infer<typeof invitationSchema>,
) {
  const data = invitationSchema.parse(input);
  const { user } = await requireAuth();
  return prisma.$transaction(async (tx) => {
    // Serialize grants/revocations/ownership changes on the club, including last-owner checks.
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${data.clubId} FOR UPDATE`;
    const actor = await tx.clubMember.findUnique({
      where: { userId_clubId: { userId: user.id, clubId: data.clubId } },
    });
    if (
      !hasPermission(actor, "leaders.manage") ||
      !actor ||
      data.permissions.some((p) => !hasPermission(actor, p))
    )
      throw new Error("You cannot grant these permissions.");
    const invitation = await tx.clubInvitation.create({
      data: {
        ...data,
        id: randomUUID(),
        invitedBy: user.id,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.invite",
        targetId: invitation.id,
        clubId: data.clubId,
        details: { permissions: data.permissions },
      },
    });
    return { id: invitation.id };
  });
}

export async function acceptClubInvitation(invitationId: string) {
  const id = z.string().uuid().parse(invitationId);
  const { user, supabaseUser } = await requireAuth();
  if (!supabaseUser.email_confirmed_at || supabaseUser.app_metadata?.email_verification_skipped === true) throw new Error("Verify your UVA email before accepting an invitation.");
  return prisma.$transaction(async (tx) => {
    const hint = await tx.clubInvitation.findUnique({ where: { id } });
    if (!hint) throw new Error("Invitation unavailable.");
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${hint.clubId} FOR UPDATE`;
    const invitation = await tx.clubInvitation.findUnique({ where: { id } });
    if (
      !invitation ||
      invitation.email.toLowerCase() !== user.email.toLowerCase() ||
      invitation.declinedAt ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    )
      throw new Error("Invitation unavailable or expired.");
    const inviter = await tx.clubMember.findUnique({
      where: {
        userId_clubId: {
          userId: invitation.invitedBy,
          clubId: invitation.clubId,
        },
      },
    });
    const inviterAccount = await tx.user.findUnique({ where: { id: invitation.invitedBy }, select: { disabledAt: true } });
    if (
      !inviterAccount || inviterAccount.disabledAt ||
      !hasPermission(inviter, "leaders.manage") ||
      invitation.permissions.some(
        (p) => !hasPermission(inviter, p as (typeof clubPermissions)[number]),
      )
    )
      throw new Error(
        "The inviter no longer has permission to grant this access.",
      );
    const existing = await tx.clubMember.findUnique({
      where: { userId_clubId: { userId: user.id, clubId: invitation.clubId } },
    });
    // Accepting an invite adds access; it never strips existing ownership or capabilities.
    const permissions = Array.from(
      new Set([...(existing?.permissions || []), ...invitation.permissions]),
    );
    await tx.clubMember.upsert({
      where: { userId_clubId: { userId: user.id, clubId: invitation.clubId } },
      create: { userId: user.id, clubId: invitation.clubId, permissions },
      update: { permissions },
    });
    await tx.clubInvitation.update({
      where: { id },
      data: { acceptedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.invite.accept",
        targetId: id,
        clubId: invitation.clubId,
      },
    });
    return { clubId: invitation.clubId };
  });
}

export async function updateClubAccess(input: {
  clubId: string;
  memberId: string;
  permissions: string[];
  isOwner: boolean;
}) {
  const data = z
    .object({
      clubId: z.string().uuid(),
      memberId: z.string().uuid(),
      permissions: permissionsSchema,
      isOwner: z.boolean(),
    })
    .parse(input);
  const { user } = await requireAuth();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${data.clubId} FOR UPDATE`;
    const actor = await tx.clubMember.findUnique({
      where: { userId_clubId: { userId: user.id, clubId: data.clubId } },
    });
    const target = await tx.clubMember.findFirst({
      where: { id: data.memberId, clubId: data.clubId },
    });
    if (!actor || !target || !hasPermission(actor, "leaders.manage"))
      throw new Error("Access denied.");
    if (
      !actor.isOwner &&
      (target.isOwner ||
        data.isOwner ||
        data.permissions.some((p) => !hasPermission(actor, p)) ||
        target.permissions.some(
          (p) => !hasPermission(actor, p as (typeof clubPermissions)[number]),
        ))
    )
      throw new Error("Only an owner can change higher-authority access.");
    const targetAccount = await tx.user.findUnique({ where: { id: target.userId }, select: { disabledAt: true } });
    if (data.isOwner && (!targetAccount || targetAccount.disabledAt)) throw new Error("Ownership requires an active account.");
    if (
      target.isOwner &&
      !data.isOwner &&
      (await tx.clubMember.count({
        where: { clubId: data.clubId, isOwner: true, user: { disabledAt: null } },
      })) <= 1
    )
      throw new Error("Assign another owner before removing the last owner.");
    await tx.clubMember.update({
      where: { id: target.id },
      data: { permissions: data.permissions, isOwner: data.isOwner },
    });
    const person = await tx.user.findUnique({
      where: { id: target.userId },
      select: { email: true },
    });
    if (person)
      await tx.clubInvitation.updateMany({
        where: {
          clubId: data.clubId,
          email: person.email.toLowerCase(),
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.access.update",
        targetId: target.id,
        clubId: data.clubId,
        details: {
          before: { permissions: target.permissions, isOwner: target.isOwner },
          after: { permissions: data.permissions, isOwner: data.isOwner },
        },
      },
    });
    return { success: true };
  });
}

export async function revokeClubInvitation(
  clubId: string,
  invitationId: string,
) {
  const { user } = await requireAuth();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
    const actor = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
    if (!hasPermission(actor, "leaders.manage")) throw new Error("Access denied.");
    const result = await tx.clubInvitation.updateMany({
      where: { id: invitationId, clubId, acceptedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1) throw new Error("Invitation unavailable.");
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.invite.revoke",
        targetId: invitationId,
        clubId,
      },
    });
  });
}

export async function getClubMembers(clubId: string) {
  await requireClubPermission(clubId, ["members.manage"]);
  return prisma.clubMember.findMany({
    where: { clubId },
    include: { user: { select: { email: true } } },
    orderBy: { id: "asc" },
  });
}
export async function addClubMember(clubId: string, email: string) {
  const parsed = z
    .object({
      clubId: z.string().uuid(),
      email: z.string().trim().toLowerCase().refine(isUvaEmail),
    })
    .parse({ clubId, email });
  const { user } = await requireClubPermission(parsed.clubId, [
    "members.manage",
  ]);
  return prisma.$transaction(async (tx) => {
    const person = await tx.user.findUnique({ where: { email: parsed.email } });
    if (!person || person.disabledAt)
      throw new Error("An active OutClass account is required.");
    const member = await tx.clubMember.upsert({
      where: { userId_clubId: { userId: person.id, clubId: parsed.clubId } },
      create: { userId: person.id, clubId: parsed.clubId },
      update: {},
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.member.add",
        targetId: member.id,
        clubId: parsed.clubId,
      },
    });
    return { success: true };
  });
}
export async function removeClubMember(clubId: string, memberId: string) {
  const { user } = await requireAuth();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
    const actor = await tx.clubMember.findUnique({
      where: { userId_clubId: { userId: user.id, clubId } },
    });
    const target = await tx.clubMember.findFirst({
      where: { id: memberId, clubId },
    });
    if (!hasPermission(actor, "members.manage") || !target)
      throw new Error("Access denied.");
    // Preserve reviewer references: revoke capabilities instead of deleting evaluation history.
    if (
      target.isOwner ||
      target.permissions.length ||
      (await tx.evaluation.count({ where: { interviewerId: target.id } })) ||
      (await tx.interviewRecord.count({ where: { interviewerId: target.id } }))
    )
      throw new Error(
        "Revoke leadership access first. Memberships with evaluation or interview history must be retained.",
      );
    const person = await tx.user.findUnique({ where: { id: target.userId }, select: { email: true } });
    if (person) await tx.clubInvitation.updateMany({ where: { clubId, email: person.email.toLowerCase(), acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.clubMember.delete({ where: { id: target.id } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.member.remove",
        targetId: target.id,
        clubId,
      },
    });
  });
}

export async function declineClubInvitation(invitationId: string) {
  const id = z.string().uuid().parse(invitationId);
  const { user } = await requireAuth();
  return prisma.$transaction(async (tx) => {
    const hint = await tx.clubInvitation.findUnique({ where: { id } });
    if (!hint) throw new Error("Invitation unavailable.");
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${hint.clubId} FOR UPDATE`;
    const result = await tx.clubInvitation.updateMany({
      where: {
        id,
        email: user.email.toLowerCase(),
        acceptedAt: null,
        revokedAt: null,
        declinedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { declinedAt: new Date() },
    });
    if (result.count !== 1)
      throw new Error("Invitation unavailable or expired.");
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.invite.decline",
        targetId: id,
        clubId: hint.clubId,
      },
    });
  });
}
