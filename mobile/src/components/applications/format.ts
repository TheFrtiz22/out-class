/** Interview and recruitment times display in Eastern time, as on the web (lib/scheduling-config.ts). */
export const ZONE = "America/New_York";
export const ZONE_LABEL = "Eastern Time";

export function schedulingDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: ZONE, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
}
export const applicantDate = (value: string | Date) => `${schedulingDateTime(value)} · ${ZONE_LABEL}`;
export function slotTime(value: string | Date) {
  return new Date(value).toLocaleTimeString("en-US", { timeZone: ZONE, hour: "numeric", minute: "2-digit", hour12: true });
}
/** The Eastern calendar day of an instant, as YYYY-MM-DD. */
export function dayKey(value: string | Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
/** A YYYY-MM-DD day key formatted without shifting it into another zone. */
export function formatDay(key: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}
export function shortDay(value: string | Date) {
  return new Date(value).toLocaleDateString("en-US", { timeZone: ZONE, weekday: "short", month: "short", day: "numeric" });
}
/** A plain date ("11/25/2026"), where the web uses toLocaleDateString(). */
export function plainDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-US", { timeZone: ZONE });
}
