"use server";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { hasPermission } from "@/lib/permissions";
import { RANKED_REVIEW_NO_CYCLE, rankedBandsSchema, rankedCycleKeySchema, rankedScopeSetting, readRankedReviewSettings, withRankedScope } from "@/lib/ranked-review";

const uuid = z.string().uuid();

/**
 * Discussion-band settings for one round. Readable by anyone who can open the
 * applicant pipeline (same gate as getClubPipeline); scores and identities are
 * never read here. Cycle names are returned so reviewers can choose a scope.
 */
export async function getRankedReviewSettings(clubId: string, roundId: string) {
  uuid.parse(clubId); uuid.parse(roundId);
  const { user } = await requireClubPermission(clubId, [], { allowSuspendedRead: true });
  return prisma.$transaction(async tx => {
    const membership = await authorizeClubTransaction(tx, clubId, user.id, [], { readOnly: true, allowSuspendedRead: true });
    if (!hasPermission(membership, "applicants.identify") && !hasPermission(membership, "applications.review")) throw new Error("Applicant access denied.");
    const round = await tx.pipelineRound.findFirst({ where: { id: roundId, clubId, archivedAt: null }, select: { id: true, configuration: true, anonymousReview: true } });
    if (!round) throw new Error("Round unavailable.");
    // Same rule as the pipeline: without applicants.identify a reviewer works only in anonymous rounds,
    // and anonymous rounds expose no cycle membership.
    const identify = hasPermission(membership, "applicants.identify");
    if (!identify && !round.anonymousReview) throw new Error("Applicant access denied.");
    const cycles = round.anonymousReview ? [] : await tx.recruitmentCycle.findMany({ where: { clubId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, name: true } });
    return { roundId: round.id, scopes: readRankedReviewSettings(round.configuration), cycles, canManage: hasPermission(membership, "recruitment.manage") };
  });
}

const saveSchema = z.object({
  clubId: uuid, roundId: uuid, cycleKey: rankedCycleKeySchema,
  expectedRevision: z.number().int().min(0),
  bands: rankedBandsSchema.nullable(),
}).strict();

/**
 * Leaders with recruitment.manage set boundaries per club + cycle + round. The
 * club row lock serializes with savePipelineSettings (which merges and keeps
 * this namespaced key); a per-scope revision rejects stale editors. No
 * applicant is advanced, rejected or notified.
 */
export async function saveRankedReviewBands(input: unknown) {
  const data = saveSchema.parse(input);
  const { user } = await requireClubPermission(data.clubId, ["recruitment.manage"]);
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, data.clubId, user.id, ["recruitment.manage"]);
    const round = await tx.pipelineRound.findFirst({ where: { id: data.roundId, clubId: data.clubId, archivedAt: null }, select: { id: true, configuration: true } });
    if (!round) throw new Error("Round unavailable.");
    if (data.cycleKey !== RANKED_REVIEW_NO_CYCLE && !await tx.recruitmentCycle.findFirst({ where: { id: data.cycleKey, clubId: data.clubId }, select: { id: true } }))
      throw new Error("Cycle unavailable.");
    const current = rankedScopeSetting(round.configuration, data.cycleKey);
    if (current.revision !== data.expectedRevision) throw new Error("Discussion bands changed. Reload before saving.");
    const revision = current.revision + 1;
    await tx.pipelineRound.update({ where: { id: round.id }, data: { configuration: withRankedScope(round.configuration, data.cycleKey, data.bands, revision) } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "round.ranked-review-bands.configure", targetId: round.id, clubId: data.clubId, details: { cycleKey: data.cycleKey, bands: data.bands, revision } } });
    return { revision, bands: data.bands };
  });
}
