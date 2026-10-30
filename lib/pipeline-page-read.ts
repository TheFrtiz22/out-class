import { pagePipeline, type PipelinePageQuery } from "@/lib/pipeline-page"
import { pipelineSummarySelect, pipelineSummaryProjection } from "@/lib/pipeline-summary"
import type { Prisma } from "@prisma/client"
import type { AppTransactionClient } from "@/utils/prisma"
import type { pipelineDetailProjection } from "@/lib/pipeline-detail"
import type { ClubAccess } from "@/lib/permissions"

// Ranking does not need review/assignment collections unless the requested
// filter or sort observes them. Keep canonical JS collation/privacy semantics.
const { round: _round, ...reviewMetadataSelect } = pipelineSummarySelect
export const pipelinePageReviewMetadataSelect = reviewMetadataSelect
const { evaluations: _evaluations, interviewAssignments: _assignments, ...metadataSelect } = reviewMetadataSelect
export const pipelinePageMetadataSelect = metadataSelect
export function requiresCompleteReviewMetadata(query: PipelinePageQuery) {
  return query.review !== undefined || query.rating !== undefined || query.sort === "score"
}

type Member = ClubAccess & { id: string; userId: string }
type Rounds = ReturnType<typeof pagePipeline>["rounds"]
/** The caller supplies all club rounds from this same guarded snapshot. */
export async function readPipelineMetadata(tx: AppTransactionClient, where: Prisma.ApplicationWhereInput,
  member: Member, query: PipelinePageQuery, roundPrivacy: ReadonlyMap<string, boolean>) {
  const completeReviews = requiresCompleteReviewMetadata(query)
  const metadata = completeReviews
    ? await tx.application.findMany({ where, select: pipelinePageReviewMetadataSelect })
    : (await tx.application.findMany({ where, select: pipelinePageMetadataSelect }))
      .map(app => ({ ...app, evaluations: [], interviewAssignments: [] }))
  return metadata.map(app => {
    // Reuse the club's round read from this same snapshot, including archived
    // rounds. An absent round must never make anonymous applicants identified.
    const anonymousReview = roundPrivacy.get(app.roundId)
    if (anonymousReview === undefined) throw new Error("Applicant round unavailable. Reload applicants.")
    return pipelineSummaryProjection({ ...app, round: { anonymousReview } }, member)
  })
}

export async function readPipelinePage(tx: AppTransactionClient, where: Prisma.ApplicationWhereInput,
  member: Member, rounds: Rounds, query: PipelinePageQuery, scope: string,
  hydrate: (ids: string[]) => Promise<ReturnType<typeof pipelineDetailProjection>[]>,
  roundPrivacy: ReadonlyMap<string, boolean>) {
  const ranked = await readPipelineMetadata(tx, where, member, query, roundPrivacy)
  const page = pagePipeline({ rounds, genderCounts: null, applications: ranked }, query, member.id, member.userId, scope)
  const ids = page.applications.map(app => app.id)
  // The visible page is the unit of hydration. Reuse its canonical detail
  // fields on opening; do not add a second detail request after this guard.
  const details = ids.length ? await hydrate(ids) : []
  const byId = new Map(details.map(app => [app.id, app]))
  const applications = ids.map(id => {
    const app = byId.get(id)
    if (!app) throw new Error("Applicant page changed. Reload applicants.")
    return app
  })
  return { ...page, applications,
    coverage: { mode: query.mode ?? "applicants", complete: !query.roundId && !query.gender && !query.genderCounts && page.page.start === 0 && applications.length === page.page.baseTotal } }
}
