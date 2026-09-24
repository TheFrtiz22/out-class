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
  "leaders.manage",
] as const
export type ClubPermission = (typeof clubPermissions)[number]
export type ClubAccess = { isOwner?: boolean; permissions?: readonly string[] }
export function hasPermission(member: ClubAccess | null | undefined, permission: ClubPermission) {
  return !!member && (member.isOwner === true || member.permissions?.includes(permission) === true)
}
export function hasWorkspace(member: ClubAccess) {
  return (
    member.isOwner === true ||
    clubPermissions.some((permission) => hasPermission(member, permission))
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
  "decisions.vote": "Vote (future ballot service)",
  "decisions.manage": "Manage application decisions",
  "leaders.manage": "Invite and manage workspace access",
}
