import type { Prisma } from "@prisma/client"
import type { AppTransactionClient } from "@/utils/prisma"
import { hasPermission, type ClubAccess } from "@/lib/permissions"

/** One earlier application. `status` is null unless the viewer may already see decisions. */
export type PriorApplication = { cycleName: string | null; submittedAt: Date | null; status: string | null }

type Viewer = ClubAccess & { id: string; userId: string }

/** The link between two applications is itself identifying, so history follows
 * the anonymous-review rule exactly: identified viewers on identified rounds only.
 * It is never shown about the viewer's own application or to a recused reviewer. */
export function mayShowPriorApplications(viewer: Viewer, app: { studentId: string; round: { anonymousReview: boolean } }, recused: boolean) {
  return !recused && app.studentId !== viewer.userId && !app.round.anonymousReview && hasPermission(viewer, "applicants.identify")
}

/** An earlier outcome is a decision: shown only to members who already see decisions. */
export function mayShowPriorOutcome(viewer: ClubAccess) {
  return hasPermission(viewer, "decisions.manage") || hasPermission(viewer, "decisions.publish") || hasPermission(viewer, "decisions.view")
}

/** Ids, cycle name and dates only; the status is added only when the outcome may be shown. */
const priorHistorySelect = { id: true, studentId: true, submittedAt: true, recruitmentCycle: { select: { name: true } } } satisfies Prisma.ApplicationSelect
const priorHistoryWithOutcomeSelect = { ...priorHistorySelect, status: true } satisfies Prisma.ApplicationSelect

/** Earlier submitted applications by the same students to the same club, in one
 * query for the whole list. Selects only ids, cycle names and dates; the status
 * only when `outcome` is true. Callers filter with mayShowPriorApplications first. */
export async function loadPriorApplications(
  tx: Pick<AppTransactionClient, "application">,
  clubId: string,
  apps: readonly { id: string; studentId: string; submittedAt: Date | null }[],
  { outcome = false }: { outcome?: boolean } = {},
): Promise<Map<string, PriorApplication[]>> {
  const result = new Map<string, PriorApplication[]>()
  if (!apps.length) return result
  const where = { clubId, studentId: { in: [...new Set(apps.map(app => app.studentId))] }, status: { not: "DRAFTING" as const } } satisfies Prisma.ApplicationWhereInput
  const history = outcome
    ? await tx.application.findMany({ where, select: priorHistoryWithOutcomeSelect })
    : await tx.application.findMany({ where, select: priorHistorySelect })
  for (const app of apps) result.set(app.id, priorApplicationsFor(app, history))
  return result
}

export function priorApplicationsFor(
  app: { id: string; studentId: string; submittedAt: Date | null },
  history: readonly { id: string; studentId: string; status?: string | null; submittedAt: Date | null; recruitmentCycle: { name: string } | null }[],
): PriorApplication[] {
  return history
    .filter(other => other.id !== app.id && other.studentId === app.studentId &&
      (app.submittedAt == null || (other.submittedAt != null && other.submittedAt < app.submittedAt)))
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))
    .map(other => ({ cycleName: other.recruitmentCycle?.name ?? null, submittedAt: other.submittedAt, status: other.status ?? null }))
}
