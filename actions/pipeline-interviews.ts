"use server";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { interviewBookingCoverage } from "@/utils/interview-booking";
import { kitSchema } from "@/lib/interview-kits";
import { interviewSetupStatus, type InterviewSetupStatus } from "@/lib/interview-round-workflow";
export async function getPipelineInterviewStatus(clubId: string): Promise<InterviewSetupStatus[]> {
  z.string().uuid().parse(clubId);
  const { user } = await requireClubPermission(clubId, ["recruitment.manage"]);
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, clubId, user.id, ["recruitment.manage"]);
    const rounds = await tx.pipelineRound.findMany({ where: { clubId, archivedAt: null, type: { in: ["INTERVIEW", "GROUP_INTERVIEW"] } }, orderBy: [{ order: "asc" }, { id: "asc" }], select: { id: true, interviewKit: true, anonymousReview: true, bookingPublishedAt: true, bookingPaused: true, _count: { select: { interviewRooms: true } } } });
    const result: InterviewSetupStatus[] = [];
    for (const round of rounds) result.push(interviewSetupStatus({ roundId: round.id, questions: kitSchema.parse(round.interviewKit).length, rooms: round._count.interviewRooms, anonymous: round.anonymousReview, published: !!round.bookingPublishedAt, paused: round.bookingPaused, coverage: round._count.interviewRooms && (!round.bookingPublishedAt || round.bookingPaused) ? await interviewBookingCoverage(tx, clubId, round.id) : [] }));
    return result;
  }, { timeout: 60000 });
}
