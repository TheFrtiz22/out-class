import * as Calendar from "expo-calendar/legacy";
import { haptics } from "~/lib/haptics";

/**
 * Eastern-time display, as the web's scheduling surfaces use (lib/scheduling-config.ts): meetings,
 * interviews and events read the same on every device, whatever its own time zone.
 */
export const EASTERN = "America/New_York";

/** "YYYY-MM-DD" for an instant in Eastern time (the web's `localParts(...).date`). */
export function easternDateKey(value: Date | string | number = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const pick = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** Calendar-date arithmetic on a "YYYY-MM-DD" key (no clock involved, so DST-safe). */
export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

/** Formats a "YYYY-MM-DD" key as a calendar date (not an instant). */
export function formatDateKey(key: string, options: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}

export const easternTime = (value: Date | string) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
/** "Wed, Nov 18, 5:00 PM" in Eastern time (the web's `meetingDate`). */
export const easternDateTime = (value: Date | string) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
/** "Nov 18, 5:00 PM" in Eastern time (the web's `taskDate`). */
export const easternShortDateTime = (value: Date | string) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
export const easternLongDate = (value: Date | string) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, dateStyle: "long" }).format(new Date(value));

export type CalendarEntry = { title: string; start: Date | string; end?: Date | string | null; allDay?: boolean; location?: string | null; notes?: string | null };

/**
 * "Add to Calendar": the system's own new-event sheet, prefilled. The instant is passed through
 * unchanged with the Eastern zone attached, so the entry lands at the same moment the site shows.
 * The system sheet needs no calendar permission; if the device has no calendar it stays calm and
 * reports false so the screen can say so.
 */
export async function addToCalendar(entry: CalendarEntry): Promise<"saved" | "canceled" | "unavailable"> {
  const start = new Date(entry.start);
  if (!Number.isFinite(start.getTime())) return "unavailable";
  const end = entry.end ? new Date(entry.end) : new Date(start.getTime() + 60 * 60_000);
  try {
    const result = await Calendar.createEventInCalendarAsync({
      title: entry.title, startDate: start, endDate: end > start ? end : new Date(start.getTime() + 60 * 60_000), allDay: !!entry.allDay,
      location: entry.location ?? undefined, notes: entry.notes ?? undefined, timeZone: EASTERN,
    });
    if (result.action === "saved" || result.action === "done") { haptics.confirm(); return "saved"; }
    return "canceled";
  } catch {
    return "unavailable";
  }
}
