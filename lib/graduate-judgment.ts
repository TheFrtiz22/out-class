import type { AppTransactionClient } from "@/utils/prisma"
import { ActionError } from "@/lib/action-result"
import { ALUMNI_REFUSALS, ALUMNI_REFUSED, isAlumniProfile, RECRUITING_JUDGMENT_PERMISSIONS, requiresRecruitingJudgment } from "@/lib/graduation"

/**
 * Recruiting judgment (lib/graduation.ts RECRUITING_JUDGMENT_PERMISSIONS) is refused to a graduate
 * whose membership is still current because the graduation job kept them as the club's owner. Other
 * permissions, including the hand-over ones, are unaffected. Called by the shared permission checks
 * only when the requested permissions include a judgment permission, so other checks add no query.
 * Reads the caller's own graduation date only.
 */
export async function assertGraduateMayJudge(db: Pick<AppTransactionClient, "$queryRaw">, userId: string, permissions: readonly string[] = RECRUITING_JUDGMENT_PERMISSIONS, now = new Date()) {
  if (!requiresRecruitingJudgment(permissions)) return
  const rows = await db.$queryRaw<{ graduatedAt: Date | null }[]>`SELECT "graduatedAt" FROM "StudentProfile" WHERE "userId" = ${userId}`
  if (isAlumniProfile(rows[0], now)) throw new ActionError(ALUMNI_REFUSALS.review, ALUMNI_REFUSED)
}
