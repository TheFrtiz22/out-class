"use server";
import { profilePhotoSource } from "@/lib/profile-photo";
import { z } from "zod";
import { boundedParse } from "@/lib/bounded-input";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { authorizeInterview, interviewActor } from "@/utils/interview-access";
import { hasPermission } from "@/lib/permissions";
import { assertNotRecused } from "@/lib/recusal";
import { interviewScoreSchema } from "@/lib/interview-access";
import { openInterviewSession, saveInterviewSession } from "@/actions/interview-kits";
import { canonicalEvaluationScore, normalizeReviewRubric, rubricScoresSchema, validateRubricScores, type RubricScores } from "@/lib/review-rubric";
import type { AppTransactionClient } from "@/utils/prisma";

const evaluateSchema = z.object({ clubId: z.string().uuid(), applicationId: z.string().uuid(), roundId: z.string().uuid().optional(), roundName: z.string().min(1), score: interviewScoreSchema, notes: z.string().max(20000).optional(), rubricScores: rubricScoresSchema.optional() });
/** Category scores must match the club's current categories and the canonical (half-point) score. */
async function checkedRubric(tx: AppTransactionClient, clubId: string, score: number, value: RubricScores | undefined) {
  if (!value) return undefined;
  const club = await tx.club.findUniqueOrThrow({ where: { id: clubId }, select: { reviewRubric: true } });
  validateRubricScores(value, normalizeReviewRubric(club.reviewRubric));
  if (canonicalEvaluationScore(value.overall) !== score) throw new Error("The score does not match the overall grade.");
  return value;
}
/** Compatibility endpoint uses the same session finalization; it cannot overwrite finals. */
export async function submitEvaluation(data: z.infer<typeof evaluateSchema>) {
  const input = boundedParse(evaluateSchema, data); const { user } = await requireAuth();
  const anonymousResult = await prisma.$transaction(async tx => {
    const { member } = await interviewActor(tx, input.clubId, user.id);
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${input.applicationId} FOR UPDATE`;
    const app = await tx.application.findFirst({ where: { id: input.applicationId, clubId: input.clubId, status: { not: "DRAFTING" } }, include: { round: true } });
    if (!app || app.studentId === user.id) throw new Error("Application unavailable.");
    if (!app.round.anonymousReview) return null;
    await assertNotRecused(tx, app.id, member.id);
    if (!hasPermission(member, "applications.review") || (input.roundId ? input.roundId !== app.roundId : input.roundName !== app.round.name)) throw new Error("Anonymous review unavailable.");
    if (await tx.evaluation.findFirst({ where: { applicationId: app.id, interviewerId: member.id, OR: [{ roundId: null }, { roundId: app.roundId, submittedAt: { not: null } }] } })) throw new Error("Evaluation already submitted or requires historical reconciliation.");
    const key = { applicationId: app.id, interviewerId: member.id, roundId: app.roundId };
    const rubricScores = await checkedRubric(tx, input.clubId, input.score, input.rubricScores);
    const value = await tx.evaluation.upsert({ where: { applicationId_interviewerId_roundId: key }, create: { ...key, round: app.round.name, score: input.score, notes: input.notes, submittedAt: new Date(), ...(rubricScores ? { rubricScores } : {}) }, update: { score: input.score, notes: input.notes?.trim() ? input.notes : undefined, submittedAt: new Date(), ...(rubricScores ? { rubricScores } : {}) } });
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, targetId: value.id, action: "evaluation.submit" } });
    return { ...value, notes: null, applicantQuestions: null, submittedAt: null, createdAt: new Date(0) };
  });
  if (anonymousResult) return { success: true, evaluation: anonymousResult };
  const roundId = await prisma.$transaction(async tx => {
    const app = await tx.application.findFirst({ where: { id: input.applicationId, clubId: input.clubId }, select: { roundId: true } });
    if (!app) throw new Error("Application unavailable.");
    const scope = { ...input, roundId: input.roundId || app.roundId };
    const { round } = await authorizeInterview(tx, scope, user.id);
    if (!input.roundId && round.name !== input.roundName) throw new Error("Provide the stable round ID.");
    await checkedRubric(tx, input.clubId, input.score, input.rubricScores);
    return round.id;
  });
  const scope = { clubId: input.clubId, applicationId: input.applicationId, roundId };
  const session = await openInterviewSession(scope);
  if (session.completedAt) throw new Error("Submitted evaluation is immutable.");
  const result = await saveInterviewSession({ ...scope, revision: session.revision, draft: { ...session.draft, score: input.score, ...(input.rubricScores ? { rubricScores: input.rubricScores } : {}), additionalNotes: input.notes ?? session.draft.additionalNotes ?? session.draft.overallReview, overallReview: input.notes ?? session.draft.overallReview }, complete: true });
  return { success: true, evaluation: result.evaluation! };
}
export async function getEvaluations(clubId: string, applicationId: string) {
  z.string().uuid().parse(clubId); z.string().uuid().parse(applicationId);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const app = await tx.application.findFirst({ where: { id: applicationId, clubId }, select: { roundId: true } });
    if (!app) throw new Error("Application unavailable.");
    const { member, caps, panel } = await authorizeInterview(tx, { clubId, applicationId, roundId: app.roundId }, user.id, "closing");
    const own = await tx.evaluation.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId, interviewerId: member.id, roundId: app.roundId } } });
    const leadership = caps.readClosing && (!panel || !!own?.submittedAt);
    const evaluations = await tx.evaluation.findMany({ where: { applicationId, roundId: { not: null }, stableRound: { clubId, anonymousReview: false }, submittedAt: { not: null }, ...(!leadership ? { interviewerId: member.id, stableRound: { clubId, anonymousReview: false, interviewAssignments: { some: { applicationId, memberId: member.id, revokedAt: null } } } } : {}) },
      include: { interviewer: { select: { id: true, user: { select: { studentProfile: { select: { firstName: true, lastName: true, headshotUrl: true } } } } } } }, orderBy: [{ submittedAt: "desc" }, { id: "desc" }] });
    return { evaluations: evaluations.map(e => ({ ...e, interviewer: { ...e.interviewer, user: { ...e.interviewer.user, studentProfile: e.interviewer.user.studentProfile ? { ...e.interviewer.user.studentProfile, headshotUrl: profilePhotoSource(e.interviewer.user.studentProfile.headshotUrl, { clubId, applicationId, mode: "evaluation" }) ?? null } : null } } })) };
  });
}
