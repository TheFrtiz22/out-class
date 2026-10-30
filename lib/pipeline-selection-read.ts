import type { Prisma } from "@prisma/client"
import type { AppTransactionClient } from "@/utils/prisma"
import type { ClubAccess } from "@/lib/permissions"
import { completePipelineSelection, type PipelinePageQuery } from "@/lib/pipeline-page"
import { readPipelineMetadata } from "@/lib/pipeline-page-read"

/** Caller owns fresh authority and the snapshot. No identities leave selection. */
export async function readPipelineSelection(tx: AppTransactionClient, where: Prisma.ApplicationWhereInput,
  membership: ClubAccess & { id: string; userId: string }, query: PipelinePageQuery, rounds: Parameters<typeof completePipelineSelection>[0]["rounds"], roundPrivacy: ReadonlyMap<string, boolean>) {
  const applications = await readPipelineMetadata(tx, where, membership, query, roundPrivacy)
  return completePipelineSelection({ rounds, genderCounts: null,
    applications }, query, membership.id, membership.userId)
}
