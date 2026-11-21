import * as Calendar from "expo-calendar/legacy";
import { haptics } from "~/lib/haptics";

/**
 * Eastern-time display, as the web's scheduling surfaces use (lib/scheduling-config.ts): meetings,
 * interviews and events read the same on every device, whatever its own time zone.
 */
export const EASTERN = "America/New_York";

/** The instant a server value names, or null for a missing or unreadable one (Intl throws on an invalid date). */
export function toInstant(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
/** One formatter per option set: building Intl formatters is slow on Hermes, and lists format many dates. */
function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let found = formatters.get(key);
  if (!found) { found = new Intl.DateTimeFormat("en-US", options); formatters.set(key, found); }
  return found;
}
/** An Eastern-time label for an instant; "" for a missing or unreadable value rather than a crash. */
const eastern = (options: Intl.DateTimeFormatOptions) => (value: Date | string | null | undefined) => {
  const date = toInstant(value);
  return date ? formatter({ timeZone: EASTERN, ...options }).format(date) : "";
};

/** "YYYY-MM-DD" for an instant in Eastern time (the web's `localParts(...).date`); "" for an unreadable value. */
export function easternDateKey(value: Date | string | number = Date.now()): string {
  const date = toInstant(value);
  if (!date) return "";
  const parts = formatter({ timeZone: EASTERN, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const pick = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
function keyParts(key: string): [number, number, number] | null {
  const match = KEY.exec(key);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** Calendar-date arithmetic on a "YYYY-MM-DD" key (no clock involved, so DST-safe). An unreadable key is returned as is. */
export function addDays(key: string, days: number): string {
  const parts = keyParts(key);
  if (!parts || !Number.isFinite(days)) return key;
  const [year, month, day] = parts;
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Formats a "YYYY-MM-DD" key as a calendar date (not an instant). An unreadable key is returned as is. */
export function formatDateKey(key: string, options: Intl.DateTimeFormatOptions): string {
  const parts = keyParts(key);
  if (!parts) return key;
  const [year, month, day] = parts;
  return formatter({ ...options, timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export const easternTime = eastern({ hour: "numeric", minute: "2-digit", hour12: true });
/** "Wed, Nov 18, 5:00 PM" in Eastern time (the web's `meetingDate`). */
export const easternDateTime = eastern({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
/** "Nov 18, 5:00 PM" in Eastern time (the web's `taskDate`). */
export const easternShortDateTime = eastern({ month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
export const easternLongDate = eastern({ dateStyle: "long" });
/** "Wed, Nov 18, 5:00 PM – 6:00 PM": the end's date is shown only when it falls on another Eastern day. */
export function easternRange(start: Date | string, end?: Date | string | null) {
  if (!end || !toInstant(end)) return easternDateTime(start);
  return `${easternDateTime(start)} – ${easternDateKey(start) === easternDateKey(end) ? easternTime(end) : easternDateTime(end)}`;
}

export type CalendarEntry = { title: string; start: Date | string; end?: Date | string | null; allDay?: boolean; location?: string | null; notes?: string | null };

/**
 * "Add to Calendar": the system's own new-event sheet, prefilled. The instant is passed through
 * unchanged with the Eastern zone attached, so the entry lands at the same moment the site shows.
 * The system sheet needs no calendar permission; if the device has no calendar it stays calm and
 * reports false so the screen can say so.
 */
export async function addToCalendar(entry: CalendarEntry): Promise<"saved" | "canceled" | "unavailable"> {
  const start = toInstant(entry.start);
  if (!start) return "unavailable";
  const end = toInstant(entry.end) ?? new Date(start.getTime() + 60 * 60_000);
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
