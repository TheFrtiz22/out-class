import type { AppTransactionClient } from "@/utils/prisma"
import { ActionError } from "@/lib/action-result"

export const RECUSED_MESSAGE = "You've stepped out of reviewing this applicant because you know them. A recruitment lead can undo this."

/** A refusal the reviewer can act on (ask a recruitment lead), so it is an ActionError: converted actions return it
 *  as a result with its message, instead of a thrown error that production shows as a generic failure. */
export class RecusedError extends ActionError {
  constructor() { super(RECUSED_MESSAGE, "RECUSED"); this.name = "RecusedError" }
}

/** Active (not lifted) recusal for this member and application, read in the
 * caller's transaction so it is consistent with the review or ballot it guards. */
export async function isRecused(tx: Pick<AppTransactionClient, "applicantRecusal">, applicationId: string, memberId: string) {
  return !!await tx.applicantRecusal.findFirst({ where: { applicationId, memberId, liftedAt: null }, select: { id: true } })
}

export async function assertNotRecused(tx: Pick<AppTransactionClient, "applicantRecusal">, applicationId: string, memberId: string) {
  if (await isRecused(tx, applicationId, memberId)) throw new RecusedError()
}

export const OWN_APPLICATION_DECISION_MESSAGE = "You can't decide your own application."

/** The checks every decision on an applicant needs, whichever path makes it (staged, direct,
 * round move, reconsideration, scheduled): never the decider's own application, and never an
 * applicant they stepped out of. Run inside the decision's transaction. Refusals are ActionErrors
 * so the leader sees why. */
export async function assertMayDecideApplicant(
  tx: Pick<AppTransactionClient, "applicantRecusal">,
  app: { id: string; studentId: string },
  actor: { userId: string; memberId: string },
) {
  if (app.studentId === actor.userId) throw new ActionError(OWN_APPLICATION_DECISION_MESSAGE, "FORBIDDEN")
  if (await isRecused(tx, app.id, actor.memberId)) throw new ActionError(RECUSED_MESSAGE, "RECUSED")
}
