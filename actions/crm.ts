"use server";

import { testRequirements } from "@/lib/test-scores";
import {
  anonymousApplication,
  validateAnonymousText,
} from "@/lib/anonymous-review";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export async function getClubPipeline(clubId: string) {
  // Only members can view the pipeline
  const { membership } = await requireClubPermission(clubId, []);
  if (
    !hasPermission(membership, "applicants.identify") &&
    !hasPermission(membership, "applications.review")
  )
    throw new Error("Applicant access denied.");

  const rounds = await prisma.pipelineRound.findMany({
    where: { clubId },
    orderBy: { order: "asc" },
  });

  const applications = await prisma.application.findMany({
    where: {
      clubId,
      status: { not: "DRAFTING" },
      ...(hasPermission(membership, "applicants.identify")
        ? {}
        : { round: { anonymousReview: true } }),
    },
    include: {
      round: true,
      student: {
        
        include: { studentProfile: { include: { experiences: true } } },
      },
      evaluations: true,
      answers: { include: { question: true } },
      bookings: { include: { slot: true } },
    },
  });

  return {
    rounds,
    applications: applications.map((app) =>
      !hasPermission(membership, "applicants.identify") || app.round.anonymousReview ? anonymousApplication(app) : app,
    ),
  };
}

const moveApplicantSchema = z.object({
  clubId: z.string().uuid(),
  applicationId: z.string().uuid(),
  newRoundId: z.string().uuid(),
});

export async function moveApplicantRound(
  data: z.infer<typeof moveApplicantSchema>,
) {
  const parsed = moveApplicantSchema.parse(data);

  // Recruitment access and identified-applicant access are independently required.
  const { user } = await requireClubPermission(parsed.clubId, [
    "recruitment.manage",
    "applicants.identify",
  ]);

  const application = await prisma.$transaction(async (tx) => {
    const round = await tx.pipelineRound.findFirst({
      where: { id: parsed.newRoundId, clubId: parsed.clubId },
    });
    if (!round) throw new Error("Round is not available for this club.");
    const result = await tx.application.updateMany({
      where: {
        id: parsed.applicationId,
        clubId: parsed.clubId,
        status: { not: "DRAFTING" },
      },
      data: { roundId: parsed.newRoundId },
    });
    if (result.count !== 1)
      throw new Error("Application is not available for this club.");
    const updated = await tx.application.findFirst({
      where: { id: parsed.applicationId, clubId: parsed.clubId },
      include: { round: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.round.move",
        targetId: parsed.applicationId,
        clubId: parsed.clubId,
        details: parsed,
      },
    });
    return updated?.round.anonymousReview
      ? { ...updated, studentId: `anonymous-${updated.id}`, submittedAt: null }
      : updated;
  });

  revalidatePath("/");
  revalidatePath(`/club-manager`);

  return { success: true, application };
}

const statusUpdateSchema = z.object({
  clubId: z.string().uuid(),
  applicationId: z.string().uuid(),
  status: z.enum([
    "IN_REVIEW",
    "INTERVIEWING",
    "ACCEPTED",
    "REJECTED",
    "WAITLISTED",
  ]),
  expectedStatus: z
    .enum([
      "SUBMITTED",
      "IN_REVIEW",
      "INTERVIEWING",
      "ACCEPTED",
      "REJECTED",
      "WAITLISTED",
    ])
    .optional(),
});

export async function setApplicationStatus(
  data: z.infer<typeof statusUpdateSchema>,
) {
  const parsed = statusUpdateSchema.parse(data);

  // Final decision capability is independent of a legacy club title.
  const { user } = await requireClubPermission(parsed.clubId, [
    "decisions.manage",
    "applicants.identify",
  ]);

  const application = await prisma.$transaction(async (tx) => {
    const result = await tx.application.updateMany({
      where: {
        id: parsed.applicationId,
        clubId: parsed.clubId,
        status: parsed.expectedStatus ?? { not: "DRAFTING" },
      },
      data: { status: parsed.status },
    });
    if (result.count !== 1)
      throw new Error("Application is not available for this club.");
    const updated = await tx.application.findFirst({
      where: { id: parsed.applicationId, clubId: parsed.clubId },
      include: { round: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.decision.update",
        targetId: parsed.applicationId,
        clubId: parsed.clubId,
        details: parsed,
      },
    });
    return updated?.round.anonymousReview
      ? { ...updated, studentId: `anonymous-${updated.id}`, submittedAt: null }
      : updated;
  });

  revalidatePath("/");
  revalidatePath(`/club-manager`);

  return { success: true, application };
}

export async function revealApplicantIdentity(
  clubId: string,
  applicationId: string,
  reason: string,
) {
  z.string().uuid().parse(applicationId);
  const justification = z.string().trim().min(10).max(1000).parse(reason);
  const { user } = await requireClubPermission(clubId, ["applicants.identify"]);
  return prisma.$transaction(async (tx) => {
    const application = await tx.application.findFirst({
      where: { id: applicationId, clubId, status: { not: "DRAFTING" } },
      include: {
        student: {
          omit: { passwordHash: true },
          include: { studentProfile: { include: { experiences: true } } },
        },
        evaluations: true,
        answers: { include: { question: true } },
        bookings: { include: { slot: true } },
      },
    });
    if (!application) throw new Error("Application unavailable.");
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "applicant.identity.reveal",
        targetId: applicationId,
        clubId,
        reason: justification,
      },
    });
    return application;
  });
}
export async function setRoundAnonymousReview(
  clubId: string,
  roundId: string,
  enabled: boolean,
) {
  z.string().uuid().parse(roundId);
  z.boolean().parse(enabled);
  const { user } = await requireClubPermission(clubId, [
    "recruitment.manage",
    "applicants.identify",
  ]);
  return prisma.$transaction(async (tx) => {
    const result = await tx.pipelineRound.updateMany({
      where: { id: roundId, clubId },
      data: { anonymousReview: enabled },
    });
    if (result.count !== 1) throw new Error("Round unavailable.");
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "round.anonymous-review.change",
        targetId: roundId,
        clubId,
        details: { enabled },
      },
    });
    revalidatePath("/");
    return { success: true };
  });
}

export async function setClubTestRequirement(
  clubId: string,
  requirement: string,
) {
  const value = z.enum(testRequirements).parse(requirement);
  const { user } = await requireClubPermission(clubId, ["recruitment.manage"]);
  return prisma.$transaction(async (tx) => {
    await tx.club.update({
      where: { id: clubId },
      data: { testRequirement: value },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "club.test-requirement.change",
        targetId: clubId,
        clubId,
        details: { requirement: value },
      },
    });
    revalidatePath("/");
    return { success: true };
  });
}

export async function saveAnonymousReviewContent(
  clubId: string,
  applicationId: string,
  content: string,
  confirmed: boolean,
) {
  const text = z.string().trim().max(20000).parse(content);
  z.literal(true).parse(confirmed);
  const { user } = await requireClubPermission(clubId, [
    "recruitment.manage",
    "applicants.identify",
  ]);
  return prisma.$transaction(async (tx) => {
    const application = await tx.application.findFirst({
      where: { id: applicationId, clubId, status: { not: "DRAFTING" } },
      include: {
        student: {
          select: {
            email: true,
            studentProfile: {
              select: { firstName: true, lastName: true, computingId: true },
            },
          },
        },
      },
    });
    if (!application) throw new Error("Application unavailable.");
    if (
      !(await tx.auditLog.findFirst({
        where: {
          actorId: user.id,
          targetId: applicationId,
          clubId,
          action: "applicant.identity.reveal",
        },
      }))
    )
      throw new Error(
        "Explicitly reveal this applicant before preparing anonymous content.",
      );
    validateAnonymousText(text, application.student);
    await tx.application.update({
      where: { id: application.id },
      data: { anonymousReviewText: text || null },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "applicant.anonymous-content.publish",
        targetId: applicationId,
        clubId,
        details: { cleared: !text },
      },
    });
    revalidatePath("/");
    return { success: true };
  });
}
