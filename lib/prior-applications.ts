import type { AppTransactionClient } from "@/utils/prisma"

export type PriorApplication = { cycleName: string | null; status: string }

/** Earlier submitted applications by the same student to the same club.
 * Only call for identified applicants: the link between two applications is
 * itself identifying, so anonymous review never receives it. */
export async function loadPriorApplications(
  tx: AppTransactionClient,
  clubId: string,
  apps: readonly { id: string; studentId: string; submittedAt: Date | null }[],
): Promise<Map<string, PriorApplication[]>> {
  const result = new Map<string, PriorApplication[]>()
  if (!apps.length) return result
  const history = await tx.application.findMany({
    where: { clubId, studentId: { in: [...new Set(apps.map(app => app.studentId))] }, status: { not: "DRAFTING" } },
    select: { id: true, studentId: true, status: true, submittedAt: true, recruitmentCycle: { select: { name: true } } },
  })
  for (const app of apps) result.set(app.id, priorApplicationsFor(app, history))
  return result
}

export function priorApplicationsFor(
  app: { id: string; studentId: string; submittedAt: Date | null },
  history: readonly { id: string; studentId: string; status: string; submittedAt: Date | null; recruitmentCycle: { name: string } | null }[],
): PriorApplication[] {
  return history
    .filter(other => other.id !== app.id && other.studentId === app.studentId &&
      (app.submittedAt == null || (other.submittedAt != null && other.submittedAt < app.submittedAt)))
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))
    .map(other => ({ cycleName: other.recruitmentCycle?.name ?? null, status: other.status }))
}
