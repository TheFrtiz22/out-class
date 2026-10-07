"use server";
import { profilePhotoSource } from "@/lib/profile-photo";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { authorizeInterview, interviewActor } from "@/utils/interview-access";
import { hasPermission } from "@/lib/permissions";
import { interviewScoreSchema } from "@/lib/interview-access";
import { openInterviewSession, saveInterviewSession } from "@/actions/interview-kits";

const evaluateSchema = z.object({ clubId: z.string().uuid(), applicationId: z.string().uuid(), roundId: z.string().uuid().optional(), roundName: z.string().min(1), score: interviewScoreSchema, notes: z.string().max(20000).optional() });
/** Compatibility endpoint uses the same session finalization; it cannot overwrite finals. */
export async function submitEvaluation(data: z.infer<typeof evaluateSchema>) {
  const input = evaluateSchema.parse(data); const { user } = await requireAuth();
  const anonymousResult = await prisma.$transaction(async tx => {
    const { member } = await interviewActor(tx, input.clubId, user.id);
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${input.applicationId} FOR UPDATE`;
    const app = await tx.application.findFirst({ where: { id: input.applicationId, clubId: input.clubId, status: { not: "DRAFTING" } }, include: { round: true } });
    if (!app || app.studentId === user.id) throw new Error("Application unavailable.");
    if (!app.round.anonymousReview) return null;
    if (!hasPermission(member, "applications.review") || (input.roundId ? input.roundId !== app.roundId : input.roundName !== app.round.name)) throw new Error("Anonymous review unavailable.");
    if (await tx.evaluation.findFirst({ where: { applicationId: app.id, interviewerId: member.id, OR: [{ roundId: null }, { roundId: app.roundId, submittedAt: { not: null } }] } })) throw new Error("Evaluation already submitted or requires historical reconciliation.");
    const key = { applicationId: app.id, interviewerId: member.id, roundId: app.roundId };
    const value = await tx.evaluation.upsert({ where: { applicationId_interviewerId_roundId: key }, create: { ...key, round: app.round.name, score: input.score, notes: input.notes, submittedAt: new Date() }, update: { score: input.score, notes: input.notes?.trim() ? input.notes : undefined, submittedAt: new Date() } });
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
    return round.id;
  });
  const scope = { clubId: input.clubId, applicationId: input.applicationId, roundId };
  const session = await openInterviewSession(scope);
  if (session.completedAt) throw new Error("Submitted evaluation is immutable.");
  const result = await saveInterviewSession({ ...scope, revision: session.revision, draft: { ...session.draft, score: input.score, additionalNotes: input.notes ?? session.draft.additionalNotes ?? session.draft.overallReview, overallReview: input.notes ?? session.draft.overallReview }, complete: true });
  return { success: true, evaluation: result.evaluation! };
}
export async function getEvaluations(clubId: string, applicationId: string) {
  z.string().uuid().parse(clubId); z.string().uuid().parse(applicationId);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const app = await tx.application.findFirst({ where: { id: applicationId, clubId }, select: { roundId: true } });
    if (!app) throw new Error("Application unavailable.");
    const { member, caps } = await authorizeInterview(tx, { clubId, applicationId, roundId: app.roundId }, user.id, "closing");
    const evaluations = await tx.evaluation.findMany({ where: { applicationId, roundId: { not: null }, stableRound: { clubId, anonymousReview: false }, submittedAt: { not: null }, ...(!caps.readClosing ? { interviewerId: member.id, stableRound: { clubId, anonymousReview: false, interviewAssignments: { some: { applicationId, memberId: member.id, revokedAt: null } } } } : {}) },
      include: { interviewer: { select: { id: true, user: { select: { studentProfile: { select: { firstName: true, lastName: true, headshotUrl: true } } } } } } }, orderBy: [{ submittedAt: "desc" }, { id: "desc" }] });
    return { evaluations: evaluations.map(e => ({ ...e, interviewer: { ...e.interviewer, user: { ...e.interviewer.user, studentProfile: e.interviewer.user.studentProfile ? { ...e.interviewer.user.studentProfile, headshotUrl: profilePhotoSource(e.interviewer.user.studentProfile.headshotUrl, { clubId, applicationId, mode: "evaluation" }) ?? null } : null } } })) };
  });
}
