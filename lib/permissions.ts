export const clubPermissions = [
  "club.settings",
  "members.manage",
  "meetings.manage",
  "meetings.attendance",
  "tasks.manage",
  "application.manage",
  "recruitment.manage",
  "applications.review",
  "applicants.identify",
  "interviews.manage",
  "decisions.vote",
  "decisions.manage",
  "decisions.publish",
  "decisions.view",
  "decisions.start",
  "decisions.reopen",
  "decisions.finish",
  "leaders.manage",
] as const
export type ClubPermission = (typeof clubPermissions)[number]
/**
 * handOverOnly: set by the shared membership checks (lib/graduate-access.ts) on a graduate whose
 * membership is still current, usually an owner the graduation job kept so the club has one. Such a
 * member keeps only what handing the club over needs (HAND_OVER_PERMISSIONS, making someone owner).
 */
export type ClubAccess = { isOwner?: boolean; permissions?: readonly string[]; status?: string; interviewOffices?: readonly string[]; alumniSince?: Date | string | null; handOverOnly?: boolean }
/** The only permission a graduate kept as owner still holds: assigning a new owner (lib/graduation.ts). */
export const HAND_OVER_PERMISSIONS: readonly ClubPermission[] = ["leaders.manage"]
/** On the roster (ACTIVE), current member or alumni. Clubs can still remove alumni. */
export function isRosterMembership(member: ClubAccess | null | undefined) {
  return !!member && (!member.status || member.status === "ACTIVE")
}
export function isAlumniMembership(member: ClubAccess | null | undefined) {
  return isRosterMembership(member) && !!member?.alumniSince
}
/** A current member: on the roster and not alumni. Alumni hold no club capabilities (lib/graduation.ts). */
export function isActiveMembership(member: ClubAccess | null | undefined) {
  return isRosterMembership(member) && !member?.alumniSince
}
/** Prisma filter for current (non-alumni) members: counts, audiences, exports and member-only reads. */
export const activeMemberWhere = { status: "ACTIVE", alumniSince: null } as const
export function hasPermission(member: ClubAccess | null | undefined, permission: ClubPermission) {
  if (member?.handOverOnly && !HAND_OVER_PERMISSIONS.includes(permission)) return false
  return isActiveMembership(member) && (member?.isOwner === true || member?.permissions?.includes(permission) === true)
}
export function hasWorkspace(member: ClubAccess) {
  return (
    isActiveMembership(member) && (
      member.isOwner === true ||
      member.interviewOffices?.some(office => ["PRESIDENT", "VICE_PRESIDENT", "BOARD"].includes(office)) === true ||
      clubPermissions.some((permission) => hasPermission(member, permission))
    )
  )
}
export const permissionTemplates = {
  manager: [...clubPermissions],
  recruiter: [
    "application.manage",
  "recruitment.manage",
    "applications.review",
    "applicants.identify",
    "interviews.manage",
    "meetings.manage",
    "meetings.attendance",
  ] as ClubPermission[],
  reviewer: ["applications.review"] as ClubPermission[],
  member: [] as ClubPermission[],
}
export const permissionLabels: Record<ClubPermission, string> = {
  "club.settings": "Manage club profile and settings",
  "members.manage": "Manage members",
  "meetings.manage": "Manage meetings",
  "meetings.attendance": "View meeting attendance",
  "tasks.manage": "Manage tasks",
  "application.manage": "Manage application questions and availability",
  "recruitment.manage": "Manage recruitment rounds",
  "applications.review": "Review applications",
  "applicants.identify": "View identified applicants",
  "interviews.manage": "Manage interview slots",
  "decisions.vote": "Participate in recruitment voting",
  "decisions.manage": "Manage voting sessions and application decisions",
  "decisions.publish": "Publish voting outcomes",
  "decisions.view": "View recruitment voting sessions",
  "decisions.start": "Start, pause and complete voting passes",
  "decisions.reopen": "Reopen completed voting sessions",
  "decisions.finish": "Finish recruitment voting sessions",
  "leaders.manage": "Invite and manage workspace access",
}
