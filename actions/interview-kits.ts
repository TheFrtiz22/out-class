"use server";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { hasPermission } from "@/lib/permissions";
import {
  kitSchema,
  interviewDraftSchema,
  emptyInterviewDraft,
  validateQuestionNotes,
  type InterviewSessionData,
} from "@/lib/interview-kits";
import type { Prisma, InterviewRecord } from "@prisma/client";

const scope = z.object({
  clubId: z.string().uuid(),
  applicationId: z.string().uuid(),
  roundId: z.string().uuid(),
});
function present(record: InterviewRecord): InterviewSessionData {
  return {
    id: record.id,
    revision: record.revision,
    questions: kitSchema.parse(record.questions),
    draft: interviewDraftSchema.parse(record.draft),
    completedAt: record.completedAt?.toISOString() || null,
  };
}
export async function getInterviewKit(clubId: string, roundId: string) {
  await requireClubPermission(clubId, ["interviews.manage"]);
  const round = await prisma.pipelineRound.findFirst({
    where: { id: roundId, clubId },
  });
  if (!round) throw new Error("Round unavailable.");
  return {
    questions: kitSchema.parse(round.interviewKit),
    version: round.kitVersion,
  };
}
export async function saveInterviewKit(
  clubId: string,
  roundId: string,
  version: number,
  questions: unknown,
) {
  const parsed = kitSchema.parse(questions);
  z.number().int().min(0).parse(version);
  const { user } = await requireClubPermission(clubId, ["interviews.manage"]);
  return prisma.$transaction(async (tx) => {
    const result = await tx.pipelineRound.updateMany({
      where: { id: roundId, clubId, kitVersion: version },
      data: { interviewKit: parsed, kitVersion: { increment: 1 } },
    });
    if (result.count !== 1)
      throw new Error("Kit changed or is unavailable. Reload before editing.");
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "interview.kit.update",
        targetId: roundId,
        clubId,
        details: { questionCount: parsed.length, version: version + 1 },
      },
    });
    return { questions: parsed, version: version + 1 };
  });
}
async function authorize(
  tx: Prisma.TransactionClient,
  input: z.infer<typeof scope>,
  membershipId: string,
) {
  // Serialize against round changes; reload membership and privacy inside the transaction.
  await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${input.applicationId} FOR UPDATE`;
  const membership = await tx.clubMember.findFirst({
    where: { id: membershipId, clubId: input.clubId },
  });
  if (!hasPermission(membership, "applications.review"))
    throw new Error("Review access unavailable.");
  const app = await tx.application.findFirst({
    where: {
      id: input.applicationId,
      clubId: input.clubId,
      roundId: input.roundId,
      status: { not: "DRAFTING" },
    },
    include: { round: true },
  });
  if (!app)
    throw new Error("Applicant or round changed. Reload the workspace.");
  if (
    !app.round.anonymousReview &&
    !hasPermission(membership, "applicants.identify")
  )
    throw new Error("Identified review access required.");
  return app.round;
}
export async function openInterviewSession(
  input: z.infer<typeof scope>,
): Promise<InterviewSessionData> {
  const parsed = scope.parse(input);
  const { membership } = await requireClubPermission(parsed.clubId, [
    "applications.review",
  ]);
  return prisma.$transaction(async (tx) => {
    const round = await authorize(tx, parsed, membership.id);
    const where = {
      applicationId_interviewerId_roundId: {
        applicationId: parsed.applicationId,
        interviewerId: membership.id,
        roundId: parsed.roundId,
      },
    };
    const record = await tx.interviewRecord.upsert({
      where,
      update: {},
      create: {
        ...where.applicationId_interviewerId_roundId,
        questions: kitSchema.parse(round.interviewKit),
        draft: emptyInterviewDraft,
        anonymousReview: round.anonymousReview,
      },
    });
    if (record.anonymousReview !== round.anonymousReview)
      throw new Error(
        "This interview was recorded under different privacy settings. Its notes remain protected; restore the original round privacy to access it.",
      );
    return present(record);
  });
}
export async function saveInterviewSession(
  input: z.infer<typeof scope> & {
    revision: number;
    draft: unknown;
    complete?: boolean;
  },
) {
  const parsed = scope
    .extend({
      revision: z.number().int().min(0),
      draft: interviewDraftSchema,
      complete: z.boolean().default(false),
    })
    .parse(input);
  const { user, membership } = await requireClubPermission(parsed.clubId, [
    "applications.review",
  ]);
  return prisma.$transaction(async (tx) => {
    const round = await authorize(tx, parsed, membership.id);
    const record = await tx.interviewRecord.findUnique({
      where: {
        applicationId_interviewerId_roundId: {
          applicationId: parsed.applicationId,
          interviewerId: membership.id,
          roundId: parsed.roundId,
        },
      },
    });
    if (!record || record.anonymousReview !== round.anonymousReview)
      throw new Error(
        "Interview unavailable under the current privacy settings.",
      );
    if (record.completedAt)
      throw new Error("This interview is already completed.");
    validateQuestionNotes(kitSchema.parse(record.questions), parsed.draft);
    if (parsed.complete && parsed.draft.score === null)
      throw new Error("Choose an overall score from 1 to 10.");
    const changed = await tx.interviewRecord.updateMany({
      where: { id: record.id, revision: parsed.revision, completedAt: null },
      data: {
        draft: parsed.draft,
        revision: { increment: 1 },
        completedAt: parsed.complete ? new Date() : null,
      },
    });
    if (changed.count !== 1)
      throw new Error(
        "A newer draft exists. Reload before saving; your current text has not been overwritten.",
      );
    let evaluation = null;
    if (parsed.complete) {
      evaluation = await tx.evaluation.upsert({
        where: {
          applicationId_interviewerId_round: {
            applicationId: parsed.applicationId,
            interviewerId: membership.id,
            round: round.name,
          },
        },
        create: {
          applicationId: parsed.applicationId,
          interviewerId: membership.id,
          round: round.name,
          score: parsed.draft.score!,
          notes: parsed.draft.overallReview,
        },
        update: {
          score: parsed.draft.score!,
          notes: parsed.draft.overallReview,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "interview.complete",
          targetId: record.id,
          clubId: parsed.clubId,
        },
      });
    }
    return {
      session: present(
        (await tx.interviewRecord.findUnique({ where: { id: record.id } }))!,
      ),
      evaluation:
        evaluation && round.anonymousReview
          ? { ...evaluation, notes: null, createdAt: new Date(0) }
          : evaluation,
    };
  });
}
export async function getInterviewRounds(clubId: string) {
  await requireClubPermission(clubId, ["interviews.manage"]);
  return prisma.pipelineRound.findMany({
    where: { clubId },
    select: { id: true, name: true },
    orderBy: { order: "asc" },
  });
}
