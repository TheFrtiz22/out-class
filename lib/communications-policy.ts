import type { Prisma } from "@prisma/client";
import type { AppTransactionClient } from "@/utils/prisma";
import { hasPermission, type ClubAccess } from "@/lib/permissions";

export const communicationManager = { status: "ACTIVE" as const, user: { disabledAt: null }, OR: [{ isOwner: true }, { permissions: { has: "meetings.manage" } }] };
export const identifiableApplication = { submittedAt: { not: null }, status: { not: "DRAFTING" as const }, round: { anonymousReview: false, archivedAt: null } };
export function eligibleStudentWhere(clubId?: string): Prisma.UserWhereInput {
  return { disabledAt: null, OR: [
    { memberships: { some: { ...(clubId ? { clubId } : {}), status: "ACTIVE", club: { suspendedAt: null } } } },
    { applications: { some: { ...(clubId ? { clubId } : {}), ...identifiableApplication, club: { suspendedAt: null } } } },
  ] };
}
export async function requireCommunicationAccess(tx: AppTransactionClient, clubId: string, studentId: string, actorId: string) {
  const [club, student, member, studentMember] = await Promise.all([
    tx.club.findUnique({ where: { id: clubId }, select: { suspendedAt: true } }),
    tx.user.findFirst({ where: { id: studentId, ...eligibleStudentWhere(clubId) }, select: { id: true } }),
    tx.clubMember.findUnique({ where: { userId_clubId: { clubId, userId: actorId } } }),
    tx.clubMember.findUnique({ where: { userId_clubId: { clubId, userId: studentId } }, select: { status: true } }),
  ]);
  if (!club || club.suspendedAt || !student) throw new Error("This conversation is unavailable with your current access.");
  if (actorId === studentId) return "STUDENT" as const;
  if (!hasPermission(member, "meetings.manage") || studentMember?.status !== "ACTIVE" && !(hasPermission(member, "applicants.identify") && hasPermission(member, "applications.review"))) throw new Error("This conversation is unavailable with your current access.");
  return "CLUB" as const;
}
export function conversationWhere(userId: string, clubId?: string): Prisma.ClubConversationWhereInput {
  const team: Prisma.ClubMemberWhereInput = { userId, ...communicationManager };
  // Coarse candidate lookup only. Call requireCommunicationAccess for each row
  // before returning it; eligibility must be checked against that row's club.
  return { ...(clubId ? { clubId } : {}), club: { suspendedAt: null }, OR: [
    ...(!clubId ? [{ studentId: userId }] : []),
    { club: { members: { some: team } } },
  ] };
}
export function canIdentifyRecipients(member: ClubAccess) { return hasPermission(member, "applicants.identify") && hasPermission(member, "applications.review"); }

export const notificationDefaults = {
  emailAnnouncements: true, emailMessages: true, emailApplications: true, emailInterviews: true,
  emailInvitations: true, emailTasks: true, emailPlatform: false, emailFrequency: "INSTANT",
};
export const emailCategory = { ANNOUNCEMENT: "emailAnnouncements", MESSAGE: "emailMessages", APPLICATION: "emailApplications", INTERVIEW: "emailInterviews", INVITATION: "emailInvitations", TASK: "emailTasks", PLATFORM: "emailPlatform" } as const;
export function optionalEmailAllowed(preference: typeof notificationDefaults | null, type: string) {
  const pref = preference ?? notificationDefaults;
  const key = emailCategory[type as keyof typeof emailCategory];
  return !!key && pref.emailFrequency !== "OFF" && pref[key];
}
export function nextDigestAt(createdAt: Date) {
  return new Date(Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate() + 1));
}
