import { createClient } from "@supabase/supabase-js";
import type { AppTransactionClient } from "@/utils/prisma";
import { prisma } from "@/utils/prisma";
import { interviewActor } from "@/utils/interview-access";
import { hasPermission } from "@/lib/permissions";
import { isPrivateResume, validateProfileFile } from "@/lib/student-profile";
import { normalizeProfileFieldVisibility, ProfileFieldHiddenError } from "@/lib/profile-field-visibility";
import { auditSupportAction } from "@/utils/support-audit";
export async function authorizeRecruitingResume(tx: AppTransactionClient, clubId: string, applicationId: string, userId: string) {
  const { member } = await interviewActor(tx, clubId, userId);
  if (!hasPermission(member, "applications.review") || !hasPermission(member, "applicants.identify")) throw Error("Unavailable");
  await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${applicationId} FOR SHARE`;
  const app = await tx.application.findFirst({ where: { id: applicationId, clubId, status: { not: "DRAFTING" } }, include: { round: true, club: { select: { profileFieldVisibility: true } } } });
  if (!app || app.round.anonymousReview) throw Error("Unavailable");
  // A club that hides résumés on applicant profiles does not serve them here either.
  if (!normalizeProfileFieldVisibility(app.club?.profileFieldVisibility).resume) throw new ProfileFieldHiddenError();
  await tx.$queryRaw`SELECT id FROM "PipelineRound" WHERE id = ${app.roundId} FOR SHARE`;
  const round = await tx.pipelineRound.findFirst({ where: { id: app.roundId, clubId } });
  if (!round || round.anonymousReview) throw Error("Unavailable");
  const profile = await tx.studentProfile.findUnique({ where: { userId: app.studentId }, select: { resumeUrl: true } });
  if (!profile?.resumeUrl || !isPrivateResume(profile.resumeUrl) || !profile.resumeUrl.startsWith(`${app.studentId}/`)) throw Error("Unavailable");
  return profile.resumeUrl;
}
/**
 * The private résumé bytes for a permitted reviewer: authorized, downloaded, validated as a PDF,
 * then authorized again so a replaced résumé or revoked access returns nothing. Shared by the
 * /api/recruiting-resumes proxy and the résumé summary. Throws on denial.
 */
export async function readRecruitingResume(clubId: string, applicationId: string, userId: string): Promise<{ ok: true; bytes: Uint8Array<ArrayBuffer>; studentId: string } | { ok: false; status: 503 | 404 }> {
  const authorize = () => prisma.$transaction(tx => authorizeRecruitingResume(tx, clubId, applicationId, userId));
  const path = await authorize();
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return { ok: false, status: 503 };
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  const bucket = await storage.getBucket("resumes");
  if (bucket.error || !bucket.data || bucket.data.public) return { ok: false, status: 503 };
  const result = await storage.from("resumes").download(path);
  if (result.error || !result.data) return { ok: false, status: 404 };
  const bytes = new Uint8Array(await result.data.arrayBuffer()); validateProfileFile(bytes, result.data.type, "resume");
  if (await authorize() !== path) throw Error("Unavailable");
  await auditSupportAction("platform.impersonation.resume-read", userId);
  // authorizeRecruitingResume only returns paths inside the applicant's own folder.
  return { ok: true, bytes, studentId: path.slice(0, path.indexOf("/")) };
}
