import { hasPermission, type ClubAccess, type ClubPermission } from "@/lib/permissions"

export const clubExportKinds = ["applicants", "roster", "attendance", "rsvps"] as const
export type ClubExportKind = (typeof clubExportKinds)[number]

/** Every permission listed is required. Applicant exports need identified access,
 * the same pair that lets a leader move identified applicants between rounds.
 * Attendance and RSVPs use the capability that opens those lists on screen
 * (`meetingAttendance`, `getCampusEventRsvpDashboard`). */
export const clubExportPermissions: Record<ClubExportKind, ClubPermission[]> = {
  applicants: ["recruitment.manage", "applicants.identify"],
  roster: ["members.manage"],
  attendance: ["meetings.attendance"],
  rsvps: ["meetings.attendance"],
}

/** Optional narrowing filter each kind accepts: a recruiting round for applicants,
 * one meeting or event for attendance and RSVPs. Always combined with the club id. */
export const clubExportFilter: Record<ClubExportKind, "roundId" | "eventId" | null> = {
  applicants: "roundId",
  roster: null,
  attendance: "eventId",
  rsvps: "eventId",
}

export function canExport(member: ClubAccess | null | undefined, kind: ClubExportKind) {
  return clubExportPermissions[kind].every(permission => hasPermission(member, permission))
}

export function clubExportHref(clubId: string, kind: ClubExportKind, filter?: string | null) {
  const query = new URLSearchParams({ clubId, kind })
  const key = clubExportFilter[kind]
  if (key && filter) query.set(key, filter)
  return `/api/club-exports?${query.toString()}`
}
