import { hasPermission, type ClubAccess, type ClubPermission } from "@/lib/permissions"

export const clubExportKinds = ["applicants", "roster", "attendance"] as const
export type ClubExportKind = (typeof clubExportKinds)[number]

/** Every permission listed is required. Applicant exports need identified access,
 * the same pair that lets a leader move identified applicants between rounds. */
export const clubExportPermissions: Record<ClubExportKind, ClubPermission[]> = {
  applicants: ["recruitment.manage", "applicants.identify"],
  roster: ["members.manage"],
  attendance: ["meetings.attendance"],
}

export function canExport(member: ClubAccess | null | undefined, kind: ClubExportKind) {
  return clubExportPermissions[kind].every(permission => hasPermission(member, permission))
}
