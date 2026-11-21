import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import { EASTERN, easternDate, eventSharePath, shiftDay } from "~/components/explore/directory";
import { config } from "~/lib/config";
import type { CampusEvent } from "~/lib/types";

export type CalendarOutcome = "added" | "denied" | "blocked" | "unavailable";

const localDay = (date: string, hour = 0) => { const [year, month, day] = date.split("-").map(Number); return new Date(year!, month! - 1, day!, hour); };
const utcDay = (date: string) => new Date(`${date}T00:00:00.000Z`);

/**
 * "Add to Calendar" for a campus event (the web downloads an .ics with the same fields, lib/ical.ts).
 *
 * Timed events keep the server's instants, so 6:00 PM Eastern is the same moment on a phone set to
 * any zone, and the entry is labelled Eastern. All-day events are stored as Eastern midnights with an
 * exclusive end; a calendar holds all-day events as calendar days, so they are written as the
 * Eastern dates themselves (first day to last day) and never shift a day on a phone in another zone.
 *
 * Asks for write-only access (enough to add an event; the app never reads the calendar). A refusal
 * is an outcome, not an error: "denied" can be asked again, "blocked" needs Settings.
 */
async function writeEvent(event: CampusEvent): Promise<CalendarOutcome> {
  let permission = await Calendar.getCalendarPermissions(true);
  if (!permission.granted && permission.canAskAgain) permission = await Calendar.requestCalendarPermissions(true);
  if (!permission.granted) return permission.canAskAgain ? "denied" : "blocked";

  const first = easternDate(event.date);
  const last = shiftDay(easternDate(event.endDate), -1);
  const android = Platform.OS === "android";
  const schedule = event.allDay
    // iOS reads an all-day event's days in the phone's zone (inclusive end); Android expects UTC midnights with an exclusive end.
    ? android ? { startDate: utcDay(first), endDate: utcDay(shiftDay(last, 1)), timeZone: "UTC", endTimeZone: "UTC" } : { startDate: localDay(first), endDate: localDay(last < first ? first : last, 12) }
    : { startDate: new Date(event.date), endDate: new Date(event.endDate), timeZone: EASTERN, ...(android ? { endTimeZone: EASTERN } : {}) };
  const details = {
    title: event.title,
    location: event.location,
    notes: `${event.description}\nHosted by ${event.clubName}`,
    allDay: !!event.allDay,
    ...schedule,
    ...(android ? {} : { url: new URL(eventSharePath(event.id), config.apiUrl).toString() }),
  };
  const calendar = android
    ? (await Calendar.getCalendars()).find(item => item.allowsModifications && item.isPrimary) ?? (await Calendar.getCalendars()).find(item => item.allowsModifications)
    : Calendar.getDefaultCalendarSync();
  if (!calendar) return "unavailable";
  await calendar.createEvent(details);
  return "added";
}

/**
 * Events added during this run of the app. The write goes straight into the calendar, so a second tap
 * would add a duplicate entry: an added event's button reads "Added" instead, and a tap while the first
 * write is still running shares its outcome.
 */
const added = new Set<string>();
const running = new Map<string, Promise<CalendarOutcome>>();
export const addedToCalendar = (eventId: string) => added.has(eventId);
export function addEventToCalendar(event: CampusEvent): Promise<CalendarOutcome> {
  if (added.has(event.id)) return Promise.resolve("added");
  const current = running.get(event.id);
  if (current) return current;
  const task = writeEvent(event)
    .then(outcome => { if (outcome === "added") added.add(event.id); return outcome; })
    .finally(() => { running.delete(event.id); });
  running.set(event.id, task);
  return task;
}

export const calendarMessages: Record<CalendarOutcome, string> = {
  added: "Added to your calendar.",
  denied: "Calendar access wasn’t allowed, so nothing was added.",
  blocked: "Calendar access is turned off for OutClass. You can turn it on in Settings.",
  unavailable: "This device has no calendar that events can be added to.",
};
