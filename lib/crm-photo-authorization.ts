import type { AppTransactionClient } from "@/utils/prisma";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { profilePhotoSource } from "@/lib/profile-photo";
import { normalizeProfileFieldVisibility, ProfileFieldHiddenError } from "@/lib/profile-field-visibility";

/** Equivalent to the identified CRM photo projection, without loading the pipeline. */
export async function authorizeCrmPhoto(tx: AppTransactionClient, userId: string, clubId: string, applicationId: string, path: string) {
  await authorizeClubTransaction(tx, clubId, userId, ["applicants.identify"], { allowSuspendedRead: true, readOnly: true });
  const app = await tx.application.findFirst({
    where: { id: applicationId, clubId, status: { not: "DRAFTING" }, round: { anonymousReview: false } },
    select: { id: true, clubId: true, status: true, club: { select: { profileFieldVisibility: true } }, round: { select: { anonymousReview: true } }, student: { select: { studentProfile: { select: { headshotUrl: true } } } } },
  });
  // A club that hides applicant photos does not serve them to leaders (a student's own photo is handled before this).
  if (app && !normalizeProfileFieldVisibility(app.club?.profileFieldVisibility).photo) throw new ProfileFieldHiddenError();
  const scope = { clubId, applicationId, mode: "crm" as const };
  return !!app && app.id === applicationId && app.clubId === clubId && app.status !== "DRAFTING" && !app.round.anonymousReview
    && !!profilePhotoSource(path, scope) && profilePhotoSource(app.student.studentProfile?.headshotUrl, scope) === profilePhotoSource(path, scope);
}
