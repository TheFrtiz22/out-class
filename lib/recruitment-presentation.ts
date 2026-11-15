import { SCHEDULING_TIMEZONE_LABEL, schedulingDateTime } from "@/lib/scheduling-config"
/** Public recruitment facts; an unknown deadline never implies urgency or availability. */
export function recruitmentDeadline(value?: Date | string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(+date) ? date : null
}
/**
 * A club that no longer takes applications: intake switched off, or the deadline has passed. A draft there cannot
 * be submitted, so it is never promoted as "Continue draft" or "finish your application".
 */
export function applicationIntakeClosed(club: { applicationOpen?: boolean | null; applicationDeadline?: Date | string | null }, now: number = Date.now(), deadline?: Date | string | null) {
  const due = recruitmentDeadline(deadline || club.applicationDeadline)
  return club.applicationOpen === false || !!due && +due <= now
}
export function recruitmentDate(value: Date | string) {
  return `${schedulingDateTime(value)} · ${SCHEDULING_TIMEZONE_LABEL}`
}
export function clubRecruitment(club: {
  source?: string; claimed?: boolean; applicationAvailable?: boolean; applicationDeadline?: Date | string | null;
}, now = Date.now()) {
  const deadline = recruitmentDeadline(club.applicationDeadline)
  const expired = !!deadline && +deadline <= now
  const available = club.source !== "preview" && club.applicationAvailable === true && !expired
  const closingSoon = available && !!deadline && +deadline - now <= 7 * 86400000
  const label = club.source === "preview" ? "Sample club" : club.claimed === false ? "Unclaimed" : expired ? "Deadline passed" : available ? "Applications open" : club.applicationAvailable === false ? "Applications unavailable" : "Recruitment not published"
  return { deadline, expired, available, closingSoon, label }
}
