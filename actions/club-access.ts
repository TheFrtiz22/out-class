"use server";
import { clubWriteTransaction } from "@/utils/club-write-transaction";
import { prepareVerifiedSchoolAccount } from "@/utils/school-identity";
import { revokeClubInvitations } from "@/utils/revoke-club-invitations";
import { respondToRecruitmentOffer } from "@/utils/recruitment-offers";
import { memberAcademicProfile } from "@/lib/recruitment-profile";
import { rosterMembers } from "@/lib/profile-field-visibility";

import { lockOperationalClub } from "@/lib/club-suspension";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { clubPermissions, hasPermission } from "@/lib/permissions";
import { onboardingRolePermissions } from "@/lib/club-onboarding";
import { canControlOrganizationAccess, canManageOrganizationInvitation, organizationCapabilities } from "@/lib/organization-authorization";
import { isUvaEmail } from "@/lib/auth";
import { hasConfirmedUniversityEmail } from "@/utils/verified-email-policy";
import { isActiveMembership } from "@/lib/permissions";
import { boundedParse } from "@/lib/bounded-input";
import { ActionError, actionResult } from "@/lib/action-result";

const permissionsSchema = z
  .array(z.enum(clubPermissions))
  .max(clubPermissions.length);
const invitationSchema = z.object({
  clubId: z.string().uuid(),
  email: z.string().trim().toLowerCase().refine(isUvaEmail, "Use a UVA email."),
  permissions: permissionsSchema,
}).strict();

export async function getClubAccess(clubId: string) {
  await requireClubPermission(clubId, ["leaders.manage"]);
  return {
    members: rosterMembers((await prisma.clubMember.findMany({
      where: { clubId },
      include: { club: { select: { profileFieldVisibility: true } }, user: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true, major: true, gradYear: true, transferStudent: true } } } } },
    })).map(m => ({ ...m, user: { ...m.user, studentProfile: m.user.studentProfile ? memberAcademicProfile(m.user.studentProfile) : null } }))),
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

async function inviteClubManagerCommand(
  input: z.infer<typeof invitationSchema>,
) {
  const data = boundedParse(invitationSchema, input);
  const { user } = await requireAuth();
  return prisma.$transaction(async (tx) => {
    // Serialize grants/revocations/ownership changes on the club, including last-owner checks.
    await lockOperationalClub(tx, data.clubId);
    const actor = await tx.clubMember.findUnique({
      where: { userId_clubId: { userId: user.id, clubId: data.clubId } },
    });
    if (
      !hasPermission(actor, "leaders.manage") ||
      !actor ||
      data.permissions.some((p) => !hasPermission(actor, p))
    )
      throw new ActionError("You cannot grant these permissions.");
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

async function acceptClubInvitationCommand(invitationId: string) {
  const id = z.string().uuid().parse(invitationId);
  const account = await requireAuth({ verifyEmail: true });
  const { user } = account;
  if (!hasConfirmedUniversityEmail(account)) throw new ActionError("Verify your UVA email before accepting an invitation.");
  await prepareVerifiedSchoolAccount(account);
  return clubWriteTransaction(async (tx) => {
    const hint = await tx.clubInvitation.findUnique({ where: { id } });
    if (!hint) throw new ActionError("Invitation unavailable.");
    if (hint.applicationId) return respondToRecruitmentOffer(tx, hint.applicationId, user.id, "ACCEPT");
    if (hint.schoolIdentityId) {
      const { acceptIdentityInvitationInTransaction } = await import("@/utils/club-onboarding");
      return acceptIdentityInvitationInTransaction(tx, id, account);
    }
    await lockOperationalClub(tx, hint.clubId);
    const invitation = await tx.clubInvitation.findUnique({ where: { id } });
    if (
      !invitation ||
      invitation.status !== "PENDING" ||
      invitation.email.toLowerCase() !== user.email.toLowerCase() ||
      invitation.declinedAt ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    )
      throw new ActionError("Invitation unavailable or expired.");
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
      throw new ActionError(
        "The inviter no longer has permission to grant this access.",
      );
    const existing = await tx.clubMember.findUnique({
      where: { userId_clubId: { userId: user.id, clubId: invitation.clubId } },
    });
    if (existing && !isActiveMembership(existing)) throw new ActionError("Membership is inactive. Request a new identity invitation.");
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
      data: { status: "ACCEPTED", acceptedAt: new Date(), claimedUserId: user.id },
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

async function updateClubAccessCommand(input: {
  clubId: string;
  memberId: string;
  permissions: string[];
  isOwner: boolean;
}) {
  const data = boundedParse(z
    .object({
      clubId: z.string().uuid(),
      memberId: z.string().uuid(),
      permissions: permissionsSchema,
      isOwner: z.boolean(),
    })
    .strict(), input);
  const { user } = await requireAuth();
  return prisma.$transaction(async (tx) => {
    await lockOperationalClub(tx, data.clubId);
    const actor = await tx.clubMember.findUnique({
      where: { userId_clubId: { userId: user.id, clubId: data.clubId } },
    });
    const target = await tx.clubMember.findFirst({
      where: { id: data.memberId, clubId: data.clubId },
    });
    if (!actor || !target || !organizationCapabilities(actor).canChangeRoles || (target.status && target.status !== "ACTIVE"))
      throw new ActionError("Access denied.");
    if (
      !actor.isOwner &&
      (!canControlOrganizationAccess(actor, target) || target.isOwner ||
        data.isOwner ||
        data.permissions.some((p) => !hasPermission(actor, p)) ||
        target.permissions.some(
          (p) => !hasPermission(actor, p as (typeof clubPermissions)[number]),
        ))
    )
      throw new ActionError("Only an owner can change higher-authority access.");
    const targetAccount = await tx.user.findUnique({ where: { id: target.userId }, select: { disabledAt: true } });
    if (data.isOwner && (!targetAccount || targetAccount.disabledAt)) throw new ActionError("Ownership requires an active account.");
    if (
      target.isOwner &&
      !data.isOwner &&
      (await tx.clubMember.count({
        where: { clubId: data.clubId, isOwner: true, status: "ACTIVE", user: { disabledAt: null } },
      })) <= 1
    )
      throw new ActionError("Assign another owner before removing the last owner.");
    const template = Object.entries(onboardingRolePermissions).find(([role, permissions]) => role !== "OWNER" && permissions.length === new Set(data.permissions).size && permissions.every(p => data.permissions.includes(p)))?.[0];
    const accessRole = data.isOwner ? "OWNER" : template || (target.isOwner ? "MEMBER" : target.accessRole || "MEMBER");
    await tx.clubMember.update({
      where: { id: target.id },
      data: { permissions: data.permissions, isOwner: data.isOwner, accessRole: accessRole as keyof typeof onboardingRolePermissions },
    });
    const person = await tx.user.findUnique({
      where: { id: target.userId },
      select: { email: true },
    });
    if (person)
      await revokeClubInvitations(tx, {
          clubId: data.clubId,
          status: "PENDING",
          OR: [{ email: person.email.toLowerCase() }, { schoolIdentity: { userId: target.userId } }],
          acceptedAt: null,
          revokedAt: null,
        }, user.id, "club-access.revocation");
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

async function revokeClubInvitationCommand(
  clubId: string,
  invitationId: string,
) {
  z.string().uuid().parse(clubId); z.string().uuid().parse(invitationId);
  const { user } = await requireAuth();
  return prisma.$transaction(async (tx) => {
    await lockOperationalClub(tx, clubId);
    const actor = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
    if (!hasPermission(actor, "leaders.manage")) throw new ActionError("Access denied.");
    const invitation = await tx.clubInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.clubId !== clubId || !canManageOrganizationInvitation(actor, invitation)) {
      throw new ActionError("Only an authorized owner can revoke higher-authority invitations.");
    }
    const result = await revokeClubInvitations(tx, { id: invitationId, clubId, status: "PENDING", acceptedAt: null }, user.id, "club-access.revocation");
    if (result.count !== 1) throw new ActionError("Invitation unavailable.");
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
  return rosterMembers((await prisma.clubMember.findMany({
    where: { clubId },
    include: { club: { select: { profileFieldVisibility: true } }, user: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true, major: true, gradYear: true, transferStudent: true } } } } },
    orderBy: { id: "asc" },
  })).map(m => ({ ...m, user: { ...m.user, studentProfile: m.user.studentProfile ? memberAcademicProfile(m.user.studentProfile) : null } })));
}
async function addClubMemberCommand(clubId: string, email: string) {
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
    await lockOperationalClub(tx, parsed.clubId);
    const actor = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId: parsed.clubId } } });
    if (!hasPermission(actor, "members.manage")) throw new ActionError("Access denied.");
    const person = await tx.user.findUnique({ where: { email: parsed.email } });
    if (!person || person.disabledAt)
      throw new ActionError("An active OutClass account is required.");
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
async function removeClubMemberCommand(clubId: string, memberId: string) {
  const { user } = await requireAuth();
  return prisma.$transaction(async (tx) => {
    await lockOperationalClub(tx, clubId);
    const actor = await tx.clubMember.findUnique({
      where: { userId_clubId: { userId: user.id, clubId } },
    });
    const target = await tx.clubMember.findFirst({
      where: { id: memberId, clubId },
    });
    if (!hasPermission(actor, "members.manage") || !target)
      throw new ActionError("Access denied.");
    // Preserve reviewer references: revoke capabilities instead of deleting evaluation history.
    if (
      target.isOwner || target.interviewOffices?.length ||
      target.permissions.length ||
      (await tx.evaluation.count({ where: { interviewerId: target.id } })) ||
      (await tx.interviewRecord.count({ where: { interviewerId: target.id } }))
    )
      throw new ActionError(
        "Revoke leadership access first. Memberships with evaluation or interview history must be retained.",
      );
    const person = await tx.user.findUnique({ where: { id: target.userId }, select: { email: true } });
    if (person) await revokeClubInvitations(tx, { clubId, status: "PENDING", OR: [{ email: person.email.toLowerCase() }, { schoolIdentity: { userId: target.userId } }], acceptedAt: null, revokedAt: null }, user.id, "club-access.revocation");
    await tx.clubMember.update({ where: { id: target.id }, data: { status: "LEFT", permissions: [], isOwner: false, accessRole: "MEMBER" } });
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

async function declineClubInvitationCommand(invitationId: string) {
  const id = z.string().uuid().parse(invitationId);
  const account = await requireAuth({ verifyEmail: true });
  const { user } = account;
  if (!hasConfirmedUniversityEmail(account)) throw new ActionError("Verify your UVA email before responding to an invitation.");
  await prepareVerifiedSchoolAccount(account);
  return clubWriteTransaction(async (tx) => {
    const hint = await tx.clubInvitation.findUnique({ where: { id } });
    if (!hint) throw new ActionError("Invitation unavailable.");
    if (hint.applicationId) { await respondToRecruitmentOffer(tx, hint.applicationId, user.id, "DECLINE"); return; }
    if (hint.schoolIdentityId) {
      const { recipientInvitation } = await import("@/utils/club-onboarding");
      const invitation = await recipientInvitation(tx, id, account);
      await tx.clubInvitation.update({ where: { id }, data: { status: "DECLINED", declinedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "club.invite.decline", targetId: id, clubId: invitation.clubId } });
      return;
    }
    await lockOperationalClub(tx, hint.clubId);
    const result = await tx.clubInvitation.updateMany({
      where: {
        id,
        status: "PENDING",
        email: user.email.toLowerCase(),
        acceptedAt: null,
        revokedAt: null,
        declinedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { status: "DECLINED", declinedAt: new Date() },
    });
    if (result.count !== 1)
      throw new ActionError("Invitation unavailable or expired.");
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

export async function addClubMember(...args: Parameters<typeof addClubMemberCommand>) {
  return actionResult(() => addClubMemberCommand(...args), "addClubMember")
}

export async function removeClubMember(...args: Parameters<typeof removeClubMemberCommand>) {
  return actionResult(() => removeClubMemberCommand(...args), "removeClubMember")
}

export async function updateClubAccess(...args: Parameters<typeof updateClubAccessCommand>) {
  return actionResult(() => updateClubAccessCommand(...args), "updateClubAccess")
}

export async function acceptClubInvitation(...args: Parameters<typeof acceptClubInvitationCommand>) {
  return actionResult(() => acceptClubInvitationCommand(...args), "acceptClubInvitation")
}

export async function declineClubInvitation(...args: Parameters<typeof declineClubInvitationCommand>) {
  return actionResult(() => declineClubInvitationCommand(...args), "declineClubInvitation")
}

export async function inviteClubManager(...args: Parameters<typeof inviteClubManagerCommand>) {
  return actionResult(() => inviteClubManagerCommand(...args), "inviteClubManager")
}

export async function revokeClubInvitation(...args: Parameters<typeof revokeClubInvitationCommand>) {
  return actionResult(() => revokeClubInvitationCommand(...args), "revokeClubInvitation")
}
