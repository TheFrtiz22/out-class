export const clubPermissions = [
  "club.settings",
  "members.manage",
  "meetings.manage",
  "meetings.attendance",
  "tasks.manage",
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
export type ClubAccess = { isOwner?: boolean; permissions?: readonly string[]; status?: string; interviewOffices?: readonly string[] }
export function isActiveMembership(member: ClubAccess | null | undefined) {
  return !!member && (!member.status || member.status === "ACTIVE")
}
export function hasPermission(member: ClubAccess | null | undefined, permission: ClubPermission) {
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
