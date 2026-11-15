import { PRIVACY_VERSION, TERMS_VERSION, type TermsAcceptanceSource } from "@/lib/legal-versions"

type AcceptanceDb = {
  termsAcceptance: {
    findFirst(args: { where: { userId: string; termsVersion: string; privacyVersion: string }; select: { id: true } }): Promise<{ id: string } | null>
    createMany(args: { data: { userId: string; termsVersion: string; privacyVersion: string; source: TermsAcceptanceSource }[]; skipDuplicates: true }): Promise<{ count: number }>
  }
}

/** True when this user has accepted the current Terms and Privacy versions. */
export async function hasCurrentTermsAcceptance(db: AcceptanceDb, userId: string) {
  return !!await db.termsAcceptance.findFirst({ where: { userId, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }, select: { id: true } })
}

/**
 * Records the user's own acceptance of the current versions. Insert-only (no UPDATE grant): a
 * repeat for the same versions keeps the first row and its time. Callers must have verified that
 * the request is the account holder's own session, never a support (view-as) session.
 */
export async function recordTermsAcceptance(db: AcceptanceDb, userId: string, source: TermsAcceptanceSource) {
  await db.termsAcceptance.createMany({ data: [{ userId, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, source }], skipDuplicates: true })
}
