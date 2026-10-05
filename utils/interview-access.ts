import type { AppTransactionClient } from "@/utils/prisma";
import { interviewCapabilities, type InterviewScope } from "@/lib/interview-access";

export async function interviewActor(tx: AppTransactionClient, clubId: string, userId: string) {
  // Membership management serializes on Club. Hold this through authorization and mutation.
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "ClubMember" WHERE "userId" = ${userId} AND "clubId" = ${clubId} FOR SHARE`;
  const member = await tx.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } }, include: { user: { select: { disabledAt: true } } } });
  if (!member || member.status !== "ACTIVE" || member.user.disabledAt) throw new Error("Interview access unavailable.");
  return { member, caps: interviewCapabilities(member) };
}

export async function authorizeInterview(tx: AppTransactionClient, scope: InterviewScope, userId: string, mode: "panel" | "resume" | "closing" = "panel") {
  const actor = await interviewActor(tx, scope.clubId, userId);
  await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${scope.applicationId} FOR UPDATE`;
  const app = await tx.application.findFirst({ where: { id: scope.applicationId, clubId: scope.clubId, status: { not: "DRAFTING" } }, include: { round: true } });
  await tx.$queryRaw`SELECT id FROM "PipelineRound" WHERE id = ${scope.roundId} OR id = ${app?.roundId || scope.roundId} FOR SHARE`;
  const round = await tx.pipelineRound.findFirst({ where: { id: scope.roundId, clubId: scope.clubId } });
  const currentRound = app?.roundId === scope.roundId ? round : await tx.pipelineRound.findFirst({ where: { id: app?.roundId || scope.roundId, clubId: scope.clubId } });
  // A student who is also a club member never sees their own interview evidence.
  if (!app || !round || !currentRound || app.studentId === userId || round.anonymousReview || currentRound.anonymousReview)
    throw new Error("Identified interview unavailable under current privacy settings.");
  const assignment = await tx.interviewPanelAssignment.findUnique({ where: { applicationId_roundId_memberId: { applicationId: app.id, roundId: round.id, memberId: actor.member.id } } });
  const panel = actor.caps.participate && !!assignment && !assignment.revokedAt;
  if (!(panel || (mode === "resume" && actor.caps.moderateResume) || (mode === "closing" && actor.caps.readClosing)))
    throw new Error("Current panel assignment or explicit leadership permission required.");
  return { ...actor, app, round, panel };
}

export async function authorizeQuestionBank(tx: AppTransactionClient, clubId: string, roundId: string, userId: string, edit = false) {
  const actor = await interviewActor(tx, clubId, userId);
  if (edit) await tx.$queryRaw`SELECT id FROM "PipelineRound" WHERE id = ${roundId} FOR UPDATE`;
  else await tx.$queryRaw`SELECT id FROM "PipelineRound" WHERE id = ${roundId} FOR SHARE`;
  const round = await tx.pipelineRound.findFirst({ where: { id: roundId, clubId } });
  if (!round) throw new Error("Round unavailable.");
  if (edit ? !actor.caps.editKit : !actor.caps.editKit && !(actor.caps.participate && await tx.interviewPanelAssignment.findFirst({ where: { memberId: actor.member.id, roundId, revokedAt: null, application: { clubId, studentId: { not: userId }, status: { not: "DRAFTING" } } } })))
    throw new Error("Question bank access denied.");
  return { ...actor, round };
}
