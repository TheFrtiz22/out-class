"use server";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const evaluateSchema = z.object({
  clubId: z.string().uuid(),
  applicationId: z.string().uuid(),
  roundName: z.string().min(1),
  score: z.number().min(1).max(10), // Assuming a 1-10 scoring system
  notes: z.string().optional(),
});

export async function submitEvaluation(data: z.infer<typeof evaluateSchema>) {
  const parsed = evaluateSchema.parse(data);

  // Any active member can submit an evaluation
  const { membership } = await requireClubPermission(parsed.clubId, [
    "applications.review",
  ]);

  const { evaluation, anonymous } = await prisma.$transaction(async (tx) => {
    // Stage names and privacy cannot change while a review is being saved.
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${parsed.clubId} FOR UPDATE`;
    const actor = await tx.clubMember.findFirst({
      where: {
        id: membership.id,
        clubId: parsed.clubId,
        status: "ACTIVE",
        user: { disabledAt: null },
      },
    });
    if (!hasPermission(actor, "applications.review"))
      throw new Error("Review access changed. Reload before saving.");
    const application = await tx.application.findFirst({
      where: {
        id: parsed.applicationId,
        clubId: parsed.clubId,
        status: { not: "DRAFTING" },
      },
    });
    if (!application)
      throw new Error("Application is not available for this club.");
    const round = await tx.pipelineRound.findFirst({
      where: {
        clubId: parsed.clubId,
        name: parsed.roundName,
        archivedAt: null,
      },
    });
    if (!round || round.id !== application.roundId)
      throw new Error("Round is not available for this application.");
    if (!round.anonymousReview && !hasPermission(actor, "applicants.identify"))
      throw new Error("Identified review access required.");
    const saved = await tx.evaluation.upsert({
      where: {
        applicationId_interviewerId_round: {
          applicationId: parsed.applicationId,
          interviewerId: membership.id,
          round: parsed.roundName,
        },
      },
      update: {
        score: parsed.score,
        notes:
          round.anonymousReview && !parsed.notes?.trim()
            ? undefined
            : parsed.notes,
      },
      create: {
        applicationId: parsed.applicationId,
        interviewerId: membership.id,
        round: parsed.roundName,
        score: parsed.score,
        notes: parsed.notes,
      },
    });

    return { evaluation: saved, anonymous: round.anonymousReview };
  });

  revalidatePath("/");
  revalidatePath(`/club-manager`);
  revalidatePath(`/interview-workspace/${parsed.applicationId}`);

  return {
    success: true,
    evaluation: anonymous
      ? { ...evaluation, notes: null, createdAt: new Date(0) }
      : evaluation,
  };
}

export async function getEvaluations(clubId: string, applicationId: string) {
  // Verifying access
  await requireClubPermission(clubId, [
    "applications.review",
    "applicants.identify",
  ]);

  const application = await prisma.application.findFirst({
    where: { id: applicationId, clubId, status: { not: "DRAFTING" } },
    include: { round: true },
  });
  if (!application || application.round.anonymousReview)
    return { evaluations: [] };
  const evaluations = await prisma.evaluation.findMany({
    where: {
      applicationId,
      application: { clubId, status: { not: "DRAFTING" } },
    },
    include: {
      interviewer: {
        select: {
          id: true,
          user: {
            select: {
              studentProfile: {
                select: { firstName: true, lastName: true, headshotUrl: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return { evaluations };
}
