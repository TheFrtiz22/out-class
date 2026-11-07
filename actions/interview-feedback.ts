"use server";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { interviewActor, interviewTransactionOptions, isInterviewAccessDenial } from "@/utils/interview-access";
import { votingInterviewEvidence } from "@/utils/voting-room-presentation";
import type { InterviewFeedbackResult } from "@/lib/interview-feedback";

const feedbackInput = z.object({ clubId: z.string().uuid(), applicationId: z.string().uuid(), roundId: z.string().uuid().optional() }).strict();

/** Read-only Interview feedback for one applicant and one round in the leader review dialog.
 * Reuses the voting evidence gate (authorizedInterviewRounds). Individual peer scores are
 * shown only to viewers with explicit leadership review access (readClosing); a panelist
 * who has submitted sees finalized summaries but not each peer's score. Ordinary denial
 * returns `unavailable` with no identifying data rather than throwing. */
export async function getInterviewFeedback(input: z.infer<typeof feedbackInput>): Promise<InterviewFeedbackResult> {
  const data = feedbackInput.parse(input);
  const { user } = await requireAuth();
  try {
    return await prisma.$transaction(async tx => {
      const { caps } = await interviewActor(tx, data.clubId, user.id);
      const app = await tx.application.findFirst({ where: { id: data.applicationId, clubId: data.clubId, status: { not: "DRAFTING" } }, select: { roundId: true } });
      if (!app) return { status: "unavailable" } as const;
      const evidence = await votingInterviewEvidence(tx, data.clubId, data.applicationId, user.id, { score: caps.readClosing, thoughts: true, feedback: true, currentRoundId: data.roundId ?? app.roundId });
      return evidence.authorized ? { status: "ready", feedback: evidence.feedback } as const : { status: "unavailable" } as const;
    }, interviewTransactionOptions);
  } catch (error) {
    if (isInterviewAccessDenial(error)) return { status: "unavailable" };
    throw error;
  }
}
