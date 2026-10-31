import type { AppTransactionClient } from "@/utils/prisma";
import type { ClubAccess } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";
import { genderVisibility } from "@/lib/recruitment-profile";
import { readPipelineSelection } from "@/lib/pipeline-selection-read";
import type { PipelinePageQuery } from "@/lib/pipeline-page";
import type { PipelineRound } from "@prisma/client";
export async function readVotingCandidateSelection(tx: AppTransactionClient, clubId: string,
  m: ClubAccess & { id: string; userId: string }, rounds: PipelineRound[], query: PipelinePageQuery | undefined, roundPrivacy: ReadonlyMap<string, boolean>) {
    const selectedRound = rounds.find(r => r.id === query?.roundId);
    if (query?.gender && (!selectedRound || !genderVisibility(selectedRound.applicantDisplay)
      || (!selectedRound.anonymousReview && !hasPermission(m, "applicants.identify")))) throw Error("Gender visibility must be explicitly enabled for this round.");
    return query && hasPermission(m, "decisions.manage") ? await readPipelineSelection(tx, {
      clubId, status: { not: "DRAFTING" },
      ...(query.roundId ? { roundId: query.roundId } : {}),
      ...(query.gender ? { student: { studentProfile: { gender: query.gender } } } : {}),
      ...(hasPermission(m, "applicants.identify") ? {} : { round: { anonymousReview: true } }),
    }, m, query, rounds.map(r => ({ ...r, genderVisible: hasPermission(m, "applications.review") && genderVisibility(r.applicantDisplay) })), roundPrivacy) : null;
}
