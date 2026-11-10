import type { AppTransactionClient } from "@/utils/prisma"

export const RECUSED_MESSAGE = "You've stepped out of reviewing this applicant because you know them. A recruitment lead can undo this."

export class RecusedError extends Error {
  constructor() { super(RECUSED_MESSAGE); this.name = "RecusedError" }
}

/** Active (not lifted) recusal for this member and application, read in the
 * caller's transaction so it is consistent with the review or ballot it guards. */
export async function isRecused(tx: Pick<AppTransactionClient, "applicantRecusal">, applicationId: string, memberId: string) {
  return !!await tx.applicantRecusal.findFirst({ where: { applicationId, memberId, liftedAt: null }, select: { id: true } })
}

export async function assertNotRecused(tx: Pick<AppTransactionClient, "applicantRecusal">, applicationId: string, memberId: string) {
  if (await isRecused(tx, applicationId, memberId)) throw new RecusedError()
}
