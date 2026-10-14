/** Shared wall-clock policy. Persisted instants remain UTC; Intl handles EST/EDT. */
export const SCHEDULING_TIMEZONE = "America/New_York"
export const SCHEDULING_TIMEZONE_LABEL = "Eastern Time"
export const AVAILABILITY_INTERVAL_MINUTES = 15
export const AVAILABILITY_START_MINUTE = 8 * 60
export const AVAILABILITY_END_MINUTE = 21 * 60
export const AVAILABILITY_FIRST_SLOT = AVAILABILITY_START_MINUTE / AVAILABILITY_INTERVAL_MINUTES
export const AVAILABILITY_END_SLOT = AVAILABILITY_END_MINUTE / AVAILABILITY_INTERVAL_MINUTES
export const AVAILABILITY_SLOTS = Array.from({ length: AVAILABILITY_END_SLOT - AVAILABILITY_FIRST_SLOT }, (_, i) => AVAILABILITY_FIRST_SLOT + i)

export function minuteLabel(minute: number) {
  const hour = Math.floor(minute / 60) % 24
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`
}
export function schedulingDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: SCHEDULING_TIMEZONE, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value))
}
