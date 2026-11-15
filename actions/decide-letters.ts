"use server";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { votingReadLimits } from "@/lib/voting-transaction-limits";
import { hasPermission } from "@/lib/permissions";
import { decideAccess } from "@/lib/product-navigation";
import { decisionTypes } from "@/lib/decision-letters";
import { decisionEventKey, roundLetterCounts } from "@/lib/decide";

const input = z.object({ clubId: z.string().uuid(), roundId: z.string().uuid(), cycleId: z.string().uuid().optional() }).strict();

/**
 * Decide → Overview "Decision letters": for one round, applicants whose current decision is ready to send and
 * those already sent. Counts only, each applicant once. "Sent" is the canonical delivery marker every send path
 * writes (the `decision:<application>:<version>` notification), so a changed decision counts as ready again.
 * Access: any Decide access (vote or send); identified rounds also need applicants.identify, like the round totals.
 */
export async function getRoundLetterCounts(raw: unknown) {
  const d = input.parse(raw), { user } = await requireClubPermission(d.clubId, []);
  return prisma.$transaction(async tx => {
    const m = await authorizeClubTransaction(tx, d.clubId, user.id, [], { readOnly: true });
    const access = decideAccess(m);
    if (!access.canVote && !access.canSend) throw Error("Decision letters unavailable.");
    const round = await tx.pipelineRound.findFirst({ where: { id: d.roundId, clubId: d.clubId, archivedAt: null }, select: { anonymousReview: true } });
    if (!round) throw Error("Round unavailable.");
    if (!round.anonymousReview && !hasPermission(m, "applicants.identify")) throw Error("Applicant access denied.");
    const apps = await tx.application.findMany({
      where: { clubId: d.clubId, roundId: d.roundId, status: { in: [...decisionTypes] }, ...(d.cycleId ? { recruitmentCycleId: d.cycleId } : {}) },
      select: { id: true, decisionVersion: true },
    });
    const sent = apps.length ? await tx.userNotification.findMany({
      where: { clubId: d.clubId, eventKey: { in: apps.map(decisionEventKey) } }, select: { eventKey: true },
    }) : [];
    return roundLetterCounts(apps, sent.map(n => n.eventKey));
  }, votingReadLimits);
}
