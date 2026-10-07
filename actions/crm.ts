"use server";
import { genderValues } from "@/lib/student-profile";
import { genderVisibility } from "@/lib/recruitment-profile";

import { lockOperationalClub } from "@/lib/club-suspension";

import { testRequirements } from "@/lib/test-scores";
import {
  anonymousApplication,
  identifiedApplication,
  validateAnonymousText,
} from "@/lib/anonymous-review";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const pipelineFilter = z.object({ roundId: z.string().uuid().optional(), gender: z.enum(genderValues).optional(), genderCounts: z.boolean().optional() }).strict();
export async function getClubPipeline(clubId: string, input: z.infer<typeof pipelineFilter> = {}) {
  const filter = pipelineFilter.parse(input);
  // Only members can view the pipeline
  const { membership } = await requireClubPermission(clubId, [], { allowSuspendedRead: true });
  if (
    !hasPermission(membership, "applicants.identify") &&
    !hasPermission(membership, "applications.review")
  )
    throw new Error("Applicant access denied.");

  return prisma.$transaction(async tx => {
    const rounds = await tx.pipelineRound.findMany({
      where: { clubId, archivedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true, anonymousReview: true, applicantDisplay: true },
    });
    const selectedRound = rounds.find(r => r.id === filter.roundId);
    if (filter.gender || filter.genderCounts) {
      if (!selectedRound || !genderVisibility(selectedRound.applicantDisplay) || !hasPermission(membership, "applications.review")) throw new Error("Gender visibility must be explicitly enabled for this round.");
      if (!selectedRound.anonymousReview && !hasPermission(membership, "applicants.identify")) throw new Error("Applicant access denied.");
    }
    const where = { clubId, status: { not: "DRAFTING" as const }, ...(filter.roundId ? { roundId: filter.roundId } : {}), ...(hasPermission(membership, "applicants.identify") ? {} : { round: { anonymousReview: true } }) };
    const applications = await tx.application.findMany({
      where: {
        ...where,
        ...(filter.gender ? { student: { studentProfile: { gender: filter.gender } } } : {}),
      },
      include: {
        round: true,
        student: {
          include: { studentProfile: { include: { experiences: true } } },
        },
        evaluations: { omit: { notes: true, applicantQuestions: true } },
        answers: { include: { question: true } },
        bookings: { include: { slot: true } },
      },
    });
    const counts = filter.genderCounts ? await tx.application.groupBy({ by: ["studentId"], where }) : [];
    const profiles = filter.genderCounts ? await tx.studentProfile.groupBy({ by: ["gender"], where: { userId: { in: counts.map(c => c.studentId) } }, _count: true }) : [];

    return {
      rounds: rounds.map(r => ({ id: r.id, name: r.name, order: r.order, anonymousReview: r.anonymousReview, genderVisible: hasPermission(membership, "applications.review") && genderVisibility(r.applicantDisplay) })),
      genderCounts: filter.genderCounts ? genderValues.map(gender => ({ gender, count: profiles.find(p => p.gender === gender)?._count ?? 0 })) : null,
      applications: applications.map(raw => {
        const app = { ...raw, evaluations: raw.evaluations.map(e => ({ ...e, notes: null, applicantQuestions: null })) };
        return !hasPermission(membership, "applicants.identify") || app.round.anonymousReview ? anonymousApplication(app, hasPermission(membership, "applications.review") && genderVisibility(app.round.applicantDisplay)) : identifiedApplication(app, hasPermission(membership, "applications.review") && genderVisibility(app.round.applicantDisplay), "crm");
      }),
    };
  }, { isolationLevel: "RepeatableRead" });
}

const moveApplicantSchema = z.object({
  clubId: z.string().uuid(),
  applicationId: z.string().uuid(),
  newRoundId: z.string().uuid(),
  expectedRoundId: z.string().uuid().optional(),
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
    // Serialize progression with pipeline reordering/archive.
    await lockOperationalClub(tx, parsed.clubId);
    const round = await tx.pipelineRound.findFirst({
      where: { id: parsed.newRoundId, clubId: parsed.clubId, archivedAt: null },
    });
    if (!round) throw new Error("Round is not available for this club.");
    const result = await tx.application.updateMany({
      where: {
        id: parsed.applicationId,
        clubId: parsed.clubId,
        status: { not: "DRAFTING" },
        ...(parsed.expectedRoundId ? { roundId: parsed.expectedRoundId } : {}),
      },
      data: { roundId: parsed.newRoundId },
    });
    if (result.count !== 1)
      throw new Error("Application changed or is not available for this club. Refresh before moving rounds.");
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
    await lockOperationalClub(tx, parsed.clubId);
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
  const { user, membership } = await requireClubPermission(clubId, ["applicants.identify"], { allowSuspendedRead: true });
  return prisma.$transaction(async (tx) => {
    const application = await tx.application.findFirst({
      where: { id: applicationId, clubId, status: { not: "DRAFTING" } },
      include: {
        round: true,
        student: {
          include: { studentProfile: { include: { experiences: true } } },
        },
        evaluations: { omit: { notes: true, applicantQuestions: true } },
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
    return identifiedApplication({ ...application, evaluations: application.evaluations.map(e => ({ ...e, notes: null, applicantQuestions: null })) }, hasPermission(membership, "applications.review") && genderVisibility(application.round?.applicantDisplay));
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
    await lockOperationalClub(tx, clubId);
    const result = await tx.pipelineRound.updateMany({
      where: { id: roundId, clubId, archivedAt: null },
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
    await lockOperationalClub(tx, clubId);
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
    await lockOperationalClub(tx, clubId);
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
