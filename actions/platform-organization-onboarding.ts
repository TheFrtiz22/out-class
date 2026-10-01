"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { onboardingRolePermissions } from "@/lib/club-onboarding";
import {
  organizationOnboardingSchema, organizationNameKey, onboardingIdentifierPattern,
  normalizePresidentIdentifier, type OrganizationOnboardingSchool, type OrganizationOnboardingResult,
} from "@/lib/platform-organization-onboarding";

class OnboardingConflict extends Error {}

export async function getOrganizationOnboardingSchools(): Promise<OrganizationOnboardingSchool[]> {
  const actor = await requirePlatformAdmin();
  const types = await prisma.schoolIdentifierType.findMany({
    where: { verification: "EMAIL_LOCAL_PART", emailDomain: { not: null }, school: { active: true } },
    include: { school: true }, orderBy: [{ school: { name: "asc" } }, { key: "asc" }], take: 100,
  });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.club.onboarding-schools.read", targetId: "schools" } });
  return types.map(type => ({
    identifierTypeId: type.id, schoolName: type.school.name, identifierLabel: type.label,
    normalization: type.normalization, validationRegex: onboardingIdentifierPattern(type),
  }));
}

/** One audited transaction; only a real platform administrator can initiate it. */
export async function createOrganizationAndInvitePresident(input: unknown): Promise<OrganizationOnboardingResult> {
  let actor;
  try {
    actor = await requirePlatformAdmin();
  } catch {
    return { ok: false, error: "Platform administrator access is required. Verify your sign-in and MFA, then retry." };
  }
  const parsed = organizationOnboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  try {
    return await prisma.$transaction(async tx => {
      let config = await tx.schoolIdentifierType.findUnique({ where: { id: data.identifierTypeId }, include: { school: true } });
      if (!config || !config.school.active || config.verification !== "EMAIL_LOCAL_PART" || !config.emailDomain) {
        throw new OnboardingConflict("This school is not configured for president invitations. Choose an available school.");
      }
      // Reload mapping/availability after the locks, so configuration changes cannot
      // race normalization or organization creation.
      await tx.$queryRaw`SELECT id FROM "School" WHERE id = ${config.schoolId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "SchoolIdentifierType" WHERE id = ${config.id} FOR UPDATE`;
      config = await tx.schoolIdentifierType.findUnique({ where: { id: data.identifierTypeId }, include: { school: true } });
      if (!config || !config.school.active || config.verification !== "EMAIL_LOCAL_PART" || !config.emailDomain) {
        throw new OnboardingConflict("This school's invitation configuration changed. Reload the form and try again.");
      }
      let identifier;
      try {
        identifier = normalizePresidentIdentifier(data.presidentIdentifier, { ...config, validationRegex: onboardingIdentifierPattern(config) });
      } catch {
        return { ok: false as const, error: "Enter a valid university identifier.", fieldErrors: { presidentIdentifier: [`Enter a valid ${config.label}.`] } };
      }
      const email = `${identifier}@${config.emailDomain}`;
      if (!z.string().email().safeParse(email).success) throw new OnboardingConflict("This school's email mapping needs administrator review.");

      // Serialize the new creation workflow within a school. Global slug uniqueness
      // remains the database safeguard against conflicting creation through other tools.
      const fingerprint = createHash("sha256").update(JSON.stringify({ ...data, presidentIdentifier: identifier })).digest("hex");
      const prior = await tx.auditLog.findFirst({
        where: { actorId: actor.id, action: "platform.club.onboard", details: { path: ["requestId"], equals: data.requestId } },
      });
      if (prior) {
        const details = prior.details as Record<string, unknown> | null;
        if (details?.fingerprint !== fingerprint || typeof details.invitationId !== "string") {
          throw new OnboardingConflict("This submission was already used with different details. Start a new organization form.");
        }
        const organization = await tx.club.findUniqueOrThrow({ where: { id: prior.targetId }, select: { id: true, name: true } });
        const invitation = await tx.clubInvitation.findUniqueOrThrow({ where: { id: details.invitationId } });
        return {
          ok: true as const, organization,
          invitation: { id: invitation.id, state: invitation.status, identifier, email: invitation.email, expiresAt: invitation.expiresAt.toISOString(), url: `/invitations/${invitation.id}` },
          accountMatch: details.matchedUserId ? "EXISTING" as const : "NEW" as const,
          reused: true, emailDelivery: "NOT_SENT" as const,
        };
      }
      const clubs = await tx.club.findMany({ where: { schoolId: config.schoolId }, select: { id: true, name: true } });
      if (clubs.some(club => organizationNameKey(club.name) === organizationNameKey(data.organizationName))) {
        throw new OnboardingConflict("An organization with this name already exists at this school. Inspect it under Clubs before inviting an owner.");
      }
      const baseSlug = data.organizationName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const nameSlug = baseSlug || `organization-${createHash("sha256").update(data.organizationName).digest("hex").slice(0, 16)}`;
      const slug = config.school.key === "uva" ? nameSlug : `${config.school.key.replace(/[^a-z0-9-]/g, "-")}-${nameSlug}`;
      if (await tx.club.findUnique({ where: { slug }, select: { id: true } })) {
        throw new OnboardingConflict("An organization with the same URL already exists. Inspect it under Clubs or use a distinct organization name.");
      }

      const identity = await tx.schoolIdentity.upsert({
        where: { schoolId_identifierTypeId_normalizedIdentifier: { schoolId: config.schoolId, identifierTypeId: config.id, normalizedIdentifier: identifier } },
        create: { schoolId: config.schoolId, identifierTypeId: config.id, identifier, normalizedIdentifier: identifier }, update: {},
      });
      const candidates = identity.userId
        ? [await tx.user.findUnique({ where: { id: identity.userId }, select: { id: true, email: true, disabledAt: true } })].filter(user => user !== null)
        : await tx.user.findMany({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, email: true, disabledAt: true }, take: 2 });
      if (candidates.length > 1) throw new OnboardingConflict("Multiple accounts match this university address. Review the identities before designating an owner.");
      const matchedUser = candidates[0];
      if (matchedUser?.disabledAt) throw new OnboardingConflict("The president's existing account is suspended. Resolve the account before designating an owner.");
      // An email match is advisory. Only verified sign-in can bind a previously
      // unclaimed SchoolIdentity; claimedUserId remains null until acceptance.
      const organization = await tx.club.create({ data: {
        schoolId: config.schoolId, campusKey: config.school.key, name: data.organizationName, slug,
        tagline: "", description: "", color: "#17233b", category: "Other",
      }, select: { id: true, name: true } });
      const invitation = await tx.clubInvitation.create({ data: {
        clubId: organization.id, schoolId: config.schoolId, schoolIdentityId: identity.id,
        invitedBy: actor.id, email, invitedName: data.presidentName, invitedYear: data.presidentYear,
        requestedRole: "OWNER", purpose: "OWNER_DESIGNATION", authoritySource: "PLATFORM_ADMIN",
        permissions: onboardingRolePermissions.OWNER, expiresAt: new Date(Date.now() + 7 * 86400000),
      } });
      await tx.auditLog.create({ data: {
        actorId: actor.id, action: "platform.club.onboard", targetId: organization.id, clubId: organization.id, reason: data.reason,
        details: { requestId: data.requestId, fingerprint, invitationId: invitation.id, schoolIdentityId: identity.id, schoolId: config.schoolId, matchedUserId: matchedUser?.id ?? null },
      } });
      await tx.auditLog.create({ data: {
        actorId: actor.id, action: "club.identity-invite.create", targetId: invitation.id, clubId: organization.id,
        reason: data.reason, details: { requestedRole: "OWNER", schoolIdentityId: identity.id },
      } });
      // Email integration point: enqueue InvitationDelivery using invitation.id
      // after this transaction commits. Creation does not claim that mail was sent.
      return {
        ok: true as const, organization,
        invitation: { id: invitation.id, state: invitation.status, identifier, email: invitation.email, expiresAt: invitation.expiresAt.toISOString(), url: `/invitations/${invitation.id}` },
        accountMatch: matchedUser ? "EXISTING" as const : "NEW" as const,
        reused: false, emailDelivery: "NOT_SENT" as const,
      };
    }, { timeout: 10000 });
  } catch (error) {
    if (error instanceof OnboardingConflict) return { ok: false, error: error.message };
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { ok: false, error: "The organization or its owner invitation already exists. Inspect Clubs before submitting another request." };
    }
    return { ok: false, error: "Could not create the organization. Retry this submission; a completed request will not be duplicated." };
  }
}
