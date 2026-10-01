import type { AppTransactionClient } from "@/utils/prisma";
import { normalizeSchoolIdentifier } from "@/lib/club-onboarding";

type VerifiedAccount = {
  user: { id: string; email: string };
  supabaseUser: { id: string; email?: string; email_confirmed_at?: string | null; app_metadata?: Record<string, unknown> };
};

/** Caller supplies requireAuth({verifyEmail:true}) output, never browser identity claims. */
export async function verifiedSchoolIdentities(tx: AppTransactionClient, account: VerifiedAccount) {
  const { user, supabaseUser } = account;
  if (supabaseUser.id !== user.id || !supabaseUser.email_confirmed_at || supabaseUser.app_metadata?.email_verification_skipped === true ||
      supabaseUser.email?.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    throw new Error("Verify your university identity before responding to invitations.");
  }
  const email = supabaseUser.email!.trim().toLowerCase();
  const [local, domain] = email.split("@");
  const configs = await tx.schoolIdentifierType.findMany({
    where: { verification: "EMAIL_LOCAL_PART", emailDomain: domain, school: { active: true } },
  });
  for (const config of configs) {
    const normalized = normalizeSchoolIdentifier(local, config);
    const identity = await tx.schoolIdentity.upsert({
      where: { schoolId_identifierTypeId_normalizedIdentifier: { schoolId: config.schoolId, identifierTypeId: config.id, normalizedIdentifier: normalized } },
      create: { schoolId: config.schoolId, identifierTypeId: config.id, identifier: local, normalizedIdentifier: normalized },
      update: {},
    });
    await tx.$queryRaw`SELECT id FROM "SchoolIdentity" WHERE id = ${identity.id} FOR UPDATE`;
    const current = await tx.schoolIdentity.findUniqueOrThrow({ where: { id: identity.id } });
    if (current.userId && current.userId !== user.id) throw new Error("University identity requires manual review.");
    if (!current.userId) {
      await tx.schoolIdentity.update({ where: { id: identity.id }, data: { userId: user.id, verifiedAt: new Date(), verificationMethod: "EMAIL_LOCAL_PART" } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "school.identity.verify", targetId: identity.id } });
    }
  }
  // Future institutional SSO adapters can bind identities server-side. No client claims.
  return tx.schoolIdentity.findMany({ where: { userId: user.id, verifiedAt: { not: null }, school: { active: true } } });
}
