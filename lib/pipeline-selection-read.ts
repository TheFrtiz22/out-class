import type { Prisma } from "@prisma/client"
import type { AppTransactionClient } from "@/utils/prisma"
import type { ClubAccess } from "@/lib/permissions"
import { completePipelineSelection, type PipelinePageQuery } from "@/lib/pipeline-page"
import { pipelineSummaryProjection, pipelineSummarySelect } from "@/lib/pipeline-summary"
import { pipelinePageMetadataSelect, requiresCompleteReviewMetadata } from "@/lib/pipeline-page-read"

// Selection also runs inside voting snapshots whose caller has no complete
// round-privacy map. Retain its independent canonical relation projection.
const selectionMetadataSelect = { ...pipelinePageMetadataSelect, round: pipelineSummarySelect.round }

/** Caller owns fresh authority and the snapshot. No identities leave selection. */
export async function readPipelineSelection(tx: AppTransactionClient, where: Prisma.ApplicationWhereInput,
  membership: ClubAccess & { id: string; userId: string }, query: PipelinePageQuery, rounds: Parameters<typeof completePipelineSelection>[0]["rounds"]) {
  const rows = requiresCompleteReviewMetadata(query)
    ? await tx.application.findMany({ where, select: pipelineSummarySelect })
    : (await tx.application.findMany({ where, select: selectionMetadataSelect }))
      .map(app => ({ ...app, evaluations: [], interviewAssignments: [] }))
  return completePipelineSelection({ rounds, genderCounts: null,
    applications: rows.map(app => pipelineSummaryProjection(app, membership)) }, query, membership.id, membership.userId)
}
