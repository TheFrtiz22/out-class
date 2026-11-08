"use server";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { votingReadLimits } from "@/lib/voting-transaction-limits";
import { roomInclude } from "@/utils/voting-room";
import { projectRoundTargetSummary } from "@/lib/voting-room-projection";

const ROUND_SESSION_LIMIT = 50;
const roundSummaryInput = z.object({ clubId: z.string().uuid(), roundId: z.string().uuid(), cycleId: z.string().uuid().optional() }).strict();

/** Entire-round target and decision counts (counts only). Authorization mirrors the voting room, per session. */
export async function getRoundTargetSummary(input: unknown) {
  const d = roundSummaryInput.parse(input), { user } = await requireClubPermission(d.clubId, ["applications.review"]);
  return prisma.$transaction(async tx => {
    const m = await authorizeClubTransaction(tx, d.clubId, user.id, ["applications.review"], { readOnly: true });
    const round = await tx.pipelineRound.findFirst({ where: { id: d.roundId, clubId: d.clubId, archivedAt: null } });
    if (!round) throw Error("Round unavailable.");
    const later = await tx.pipelineRound.count({ where: { clubId: d.clubId, archivedAt: null, order: { gt: round.order } } });
    const rooms = await tx.votingSession.findMany({ where: { clubId: d.clubId, roundId: d.roundId, mode: "LIVE", ...(d.cycleId ? { cycleId: d.cycleId } : {}) }, include: roomInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: ROUND_SESSION_LIMIT + 1 });
    return projectRoundTargetSummary(rooms.slice(0, ROUND_SESSION_LIMIT), m, { name: round.name, final: later === 0, anonymousReview: round.anonymousReview }, rooms.length > ROUND_SESSION_LIMIT);
  }, votingReadLimits);
}
