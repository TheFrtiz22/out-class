import { pagePipeline, type PipelinePageQuery } from "@/lib/pipeline-page"
import { pipelineSummarySelect, pipelineSummaryProjection } from "@/lib/pipeline-summary"
import { readPipelineMetadata } from "@/lib/pipeline-metadata-read"
export { pipelinePageMetadataSelect } from "@/lib/pipeline-metadata-read"
import type { Prisma } from "@prisma/client"
import type { AppTransactionClient } from "@/utils/prisma"
import type { ClubAccess } from "@/lib/permissions"

// Ranking does not need review/assignment collections unless the requested
// filter or sort observes them. Keep canonical JS collation/privacy semantics.
export function requiresCompleteReviewMetadata(query: PipelinePageQuery) {
  return query.review !== undefined || query.rating !== undefined || query.sort === "score"
}

type Member = ClubAccess & { id: string; userId: string }
type Rounds = ReturnType<typeof pagePipeline>["rounds"]
export async function readPipelinePage(tx: AppTransactionClient, where: Prisma.ApplicationWhereInput,
  member: Member, rounds: Rounds, query: PipelinePageQuery, scope: string) {
  const project = (app: Parameters<typeof pipelineSummaryProjection>[0]) => pipelineSummaryProjection(app, member)
  if (requiresCompleteReviewMetadata(query)) {
    const all = await tx.application.findMany({ where, select: pipelineSummarySelect })
    return pagePipeline({ rounds, genderCounts: null, applications: all.map(project) }, query, member.id, member.userId, scope)
  }
  const metadata = await readPipelineMetadata(tx, where)
  // Empty review collections are internal ranking placeholders only. This path
  // is never used for a review/score-dependent selector or returned as content.
  const ranked = metadata.map(app => project({ ...app, evaluations: [], interviewAssignments: [] }))
  const page = pagePipeline({ rounds, genderCounts: null, applications: ranked }, query, member.id, member.userId, scope)
  if (!page.applications.length) return page
  const ids = page.applications.map(app => app.id)
  // Scalar metadata is already part of this same Repeatable Read snapshot.
  // Read only the selected applicants' dependent collections, retaining the
  // complete application predicate on each relation query as defense in depth.
  const evaluations = await tx.evaluation.findMany({
    where: { applicationId: { in: ids }, application: where, submittedAt: { not: null } },
    select: { applicationId: true, ...pipelineSummarySelect.evaluations.select },
  })
  const assignments = await tx.interviewPanelAssignment.findMany({
    where: { applicationId: { in: ids }, application: where, revokedAt: null },
    select: { applicationId: true, ...pipelineSummarySelect.interviewAssignments.select },
  })
  function group<T extends { applicationId: string }>(records: T[]) {
    const grouped = new Map<string, T[]>()
    for (const record of records) {
      const list = grouped.get(record.applicationId)
      if (list) list.push(record); else grouped.set(record.applicationId, [record])
    }
    return grouped
  }
  const reviewsById = group(evaluations), assignmentsById = group(assignments)
  const metadataById = new Map(metadata.map(app => [app.id, app]))
  return { ...page, applications: ids.map(id => project({ ...metadataById.get(id)!,
    evaluations: reviewsById.get(id) ?? [], interviewAssignments: assignmentsById.get(id) ?? [],
  })) }
}
