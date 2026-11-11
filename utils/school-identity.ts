import type { AppTransactionClient } from "@/utils/prisma";
import { normalizeSchoolIdentifier } from "@/lib/club-onboarding";
import { hasConfirmedUniversityEmail, requireVerifiedEmailPolicy, UniversityVerificationError } from "@/utils/verified-email-policy";

type VerifiedAccount = {
  user: { id: string; email: string };
  supabaseUser: { id: string; email?: string; email_confirmed_at?: string | null; confirmation_sent_at?: string | null; app_metadata?: Record<string, unknown> };
};

// Per-account object preparation, never a global user/email cache. All public
// actions obtain this object from requireAuth, never from client input.
const prepared = new WeakSet<VerifiedAccount>();
export async function prepareVerifiedSchoolAccount(account: VerifiedAccount) {
  if (!hasConfirmedUniversityEmail(account)) throw new UniversityVerificationError("UNIVERSITY_VERIFICATION_REQUIRED");
  await requireVerifiedEmailPolicy();
  prepared.add(account);
}

async function emailIdentifierTypes(db: Pick<AppTransactionClient, "schoolIdentifierType">, address: string) {
  const [local, domain] = address.trim().toLowerCase().split("@");
  const configs = await db.schoolIdentifierType.findMany({
    where: { verification: "EMAIL_LOCAL_PART", emailDomain: domain, school: { active: true } },
  });
  return { local, configs };
}

/** Caller supplies requireAuth({verifyEmail:true}) output, never browser identity claims.
 * Prepare before acquisition; the compatibility fallback remains fail-closed.
 */
export async function verifiedSchoolIdentities(tx: AppTransactionClient, account: VerifiedAccount) {
  if (!prepared.has(account)) await prepareVerifiedSchoolAccount(account);
  if (!hasConfirmedUniversityEmail(account)) throw new UniversityVerificationError("UNIVERSITY_VERIFICATION_REQUIRED");
  const { user, supabaseUser } = account;
  // Keep account disable/email change authoritative at transaction time.
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR SHARE`;
  const currentAccount = await tx.user.findUnique({ where: { id: user.id }, select: { disabledAt: true, email: true } });
  if (!currentAccount || currentAccount.disabledAt || currentAccount.email.toLowerCase() !== user.email.toLowerCase()) throw new Error("University identity account unavailable.");
  const { local, configs } = await emailIdentifierTypes(tx, supabaseUser.email!);
  const currentIdentityIds: string[] = [];
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
    currentIdentityIds.push(current.id);
  }
  // Historical email bindings are retained for audit, but are not proof of current
  // mailbox control after an Auth email change. Future SSO needs its own verifier.
  return tx.schoolIdentity.findMany({ where: { id: { in: currentIdentityIds }, userId: user.id, verifiedAt: { not: null }, school: { active: true } } });
}

/** Read-only counterpart for page renders: the identities verifiedSchoolIdentities
 * would return, without creating, binding or auditing anything. A not-yet-bound
 * identity derived from the verified email is included so the recipient can see the
 * invitation; the explicit accept/decline actions bind it inside their own transaction.
 */
export async function previewVerifiedSchoolIdentities(db: Pick<AppTransactionClient, "user" | "schoolIdentifierType" | "schoolIdentity">, account: VerifiedAccount) {
  if (!prepared.has(account)) await prepareVerifiedSchoolAccount(account);
  if (!hasConfirmedUniversityEmail(account)) throw new UniversityVerificationError("UNIVERSITY_VERIFICATION_REQUIRED");
  const { user, supabaseUser } = account;
  const currentAccount = await db.user.findUnique({ where: { id: user.id }, select: { disabledAt: true, email: true } });
  if (!currentAccount || currentAccount.disabledAt || currentAccount.email.toLowerCase() !== user.email.toLowerCase()) throw new Error("University identity account unavailable.");
  const { local, configs } = await emailIdentifierTypes(db, supabaseUser.email!);
  if (!configs.length) return [];
  const identities = await db.schoolIdentity.findMany({
    where: {
      OR: configs.map(config => ({ schoolId: config.schoolId, identifierTypeId: config.id, normalizedIdentifier: normalizeSchoolIdentifier(local, config) })),
      school: { active: true },
    },
  });
  if (identities.some(identity => identity.userId && identity.userId !== user.id)) throw new Error("University identity requires manual review.");
  return identities.filter(identity => !identity.userId || identity.verifiedAt);
}
