import { assertNotRecused } from "@/lib/recusal";
import { assertClubOperational } from "@/lib/club-suspension";
import type { AppTransactionClient } from "@/utils/prisma";
import { ACCESS_REVOKED, ActionError, actionResult, type ActionResult } from "@/lib/action-result";
import { INTERVIEW_ACCESS_REVOKED_MESSAGE, interviewCapabilities, type InterviewScope } from "@/lib/interview-access";

export async function interviewActor(tx: AppTransactionClient, clubId: string, userId: string) {
  // Membership management serializes on Club. Hold this through authorization and mutation.
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR SHARE`;
  await assertClubOperational(tx, clubId);
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "ClubMember" WHERE "userId" = ${userId} AND "clubId" = ${clubId} FOR SHARE`;
  const member = await tx.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } }, include: { user: { select: { disabledAt: true } } } });
  if (!member || member.status !== "ACTIVE" || member.user.disabledAt) throw new Error("Interview access unavailable.");
  return { member, caps: interviewCapabilities(member) };
}

export const interviewTransactionOptions = { maxWait: 10000, timeout: 20000 };

/** The expected denials authorizeInterview raises for a viewer without current access. */
export function isInterviewAccessDenial(e: unknown) {
  return e instanceof Error && [/^Interview access unavailable/, /^Identified interview unavailable/, /^Current panel assignment or explicit leadership permission required/].some(p => p.test(e.message));
}

// Room-level denials from collaborationAccess: removed from a booked room's approved panel.
const roomAccessDenial = [/^Current room panel approval required/, /^Current room assignment required/];

/**
 * actionResult for interview-room actions. Any expected access denial (membership, privacy,
 * panel or booked-room assignment) becomes one uniform ACCESS_REVOKED refusal, so a viewer
 * removed while the room is open gets a typed result instead of a masked 500, and the message
 * does not reveal which check failed. The refusal carries no interview data. Every other
 * error is handled exactly as actionResult does.
 */
export function interviewActionResult<T>(work: () => Promise<T>, action: string): Promise<ActionResult<T>> {
  return actionResult(async () => {
    try { return await work(); }
    catch (error) {
      if (isInterviewAccessDenial(error) || (error instanceof Error && roomAccessDenial.some(p => p.test(error.message))))
        throw new ActionError(INTERVIEW_ACCESS_REVOKED_MESSAGE, ACCESS_REVOKED);
      throw error;
    }
  }, action);
}

export async function authorizeInterview(tx: AppTransactionClient, scope: InterviewScope, userId: string, mode: "panel" | "resume" | "closing" | "closingReview" = "panel", applicationLock: "share" | "update" = "update") {
  const actor = await interviewActor(tx, scope.clubId, userId);
  if (applicationLock === "share") await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${scope.applicationId} FOR SHARE`;
  else await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${scope.applicationId} FOR UPDATE`;
  const app = await tx.application.findFirst({ where: { id: scope.applicationId, clubId: scope.clubId, status: { not: "DRAFTING" } }, include: { round: true } });
  await tx.$queryRaw`SELECT id FROM "PipelineRound" WHERE id = ${scope.roundId} OR id = ${app?.roundId || scope.roundId} FOR SHARE`;
  const round = await tx.pipelineRound.findFirst({ where: { id: scope.roundId, clubId: scope.clubId } });
  const currentRound = app?.roundId === scope.roundId ? round : await tx.pipelineRound.findFirst({ where: { id: app?.roundId || scope.roundId, clubId: scope.clubId } });
  // A student who is also a club member never sees their own interview evidence.
  const anonymous = !!(round?.anonymousReview || currentRound?.anonymousReview);
  if (!app || !round || !currentRound || app.studentId === userId || (anonymous && !(mode === "closingReview" && actor.caps.readClosing)))
    throw new Error("Identified interview unavailable under current privacy settings.");
  // A member who stepped out because they know this applicant is out of every interview path for them.
  await assertNotRecused(tx, app.id, actor.member.id);
  const assignment = await tx.interviewPanelAssignment.findUnique({ where: { applicationId_roundId_memberId: { applicationId: app.id, roundId: round.id, memberId: actor.member.id } } });
  const panel = actor.caps.participate && !!assignment && !assignment.revokedAt;
  if (!(panel || (mode === "resume" && actor.caps.moderateResume) || ((mode === "closing" || mode === "closingReview") && actor.caps.readClosing)))
    throw new Error("Current panel assignment or explicit leadership permission required.");
  return { ...actor, app, round, panel, anonymous };
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
