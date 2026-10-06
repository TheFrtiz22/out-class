import type { AppTransactionClient } from "@/utils/prisma";
import { interviewActor } from "@/utils/interview-access";
import { hasPermission } from "@/lib/permissions";
import { isPrivateResume } from "@/lib/student-profile";
export async function authorizeRecruitingResume(tx: AppTransactionClient, clubId: string, applicationId: string, userId: string) {
  const { member } = await interviewActor(tx, clubId, userId);
  if (!hasPermission(member, "applications.review") || !hasPermission(member, "applicants.identify")) throw Error("Unavailable");
  await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${applicationId} FOR SHARE`;
  const app = await tx.application.findFirst({ where: { id: applicationId, clubId, status: { not: "DRAFTING" } }, include: { round: true } });
  if (!app || app.round.anonymousReview) throw Error("Unavailable");
  await tx.$queryRaw`SELECT id FROM "PipelineRound" WHERE id = ${app.roundId} FOR SHARE`;
  const round = await tx.pipelineRound.findFirst({ where: { id: app.roundId, clubId } });
  if (!round || round.anonymousReview) throw Error("Unavailable");
  const profile = await tx.studentProfile.findUnique({ where: { userId: app.studentId }, select: { resumeUrl: true } });
  if (!profile?.resumeUrl || !isPrivateResume(profile.resumeUrl) || !profile.resumeUrl.startsWith(`${app.studentId}/`)) throw Error("Unavailable");
  return profile.resumeUrl;
}
