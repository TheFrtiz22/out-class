import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import { ZONE } from "./format";

export type CalendarResult = "added" | "denied" | "failed";

/**
 * "Add to Calendar": one event in the person's own calendar, at the same instant, labelled in
 * Eastern time as the web shows it. Asks only for permission to add events (write-only on iOS).
 * A refusal is not an error: the caller says so calmly and nothing else changes.
 */
export async function addToCalendar(event: { title: string; startTime: string; endTime: string; location?: string | null; notes?: string }): Promise<CalendarResult> {
  try {
    const permission = await Calendar.requestCalendarPermissions(true);
    if (!permission.granted) return "denied";
    const calendar = Platform.OS === "ios"
      ? Calendar.getDefaultCalendarSync()
      : await Calendar.getCalendars().then(calendars => calendars.find(item => item.allowsModifications && item.isPrimary) ?? calendars.find(item => item.allowsModifications));
    if (!calendar) return "failed";
    await calendar.createEvent({ title: event.title, startDate: new Date(event.startTime), endDate: new Date(event.endTime), timeZone: ZONE, location: event.location ?? undefined, notes: event.notes });
    return "added";
  } catch {
    return "failed";
  }
}
