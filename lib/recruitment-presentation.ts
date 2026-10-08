/** Public recruitment facts; an unknown deadline never implies urgency or availability. */
export function recruitmentDeadline(value?: Date | string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(+date) ? date : null
}
export function recruitmentDate(value: Date | string) {
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  })
}
export function clubRecruitment(club: {
  source?: string; claimed?: boolean; applicationAvailable?: boolean; applicationDeadline?: Date | string | null;
}, now = Date.now()) {
  const deadline = recruitmentDeadline(club.applicationDeadline)
  const expired = !!deadline && +deadline <= now
  const available = club.source !== "preview" && club.applicationAvailable === true && !expired
  const closingSoon = available && !!deadline && +deadline - now <= 7 * 86400000
  const label = club.source === "preview" ? "Sample club" : club.claimed === false ? "Unclaimed profile" : expired ? "Deadline passed" : available ? "Applications open" : club.applicationAvailable === false ? "Applications unavailable" : "Recruitment not published"
  return { deadline, expired, available, closingSoon, label }
}
