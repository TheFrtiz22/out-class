import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"
import type { Prisma } from "@prisma/client";
export const EVENT_TIMEZONE = SCHEDULING_TIMEZONE;
export const eventCategories = [
  "Academic",
  "Professional",
  "Social",
  "Sports",
  "Arts",
  "Service",
  "Other",
] as const;
export const flyerTemplates = ["academic", "orange", "navy", "sage"] as const;
export const publicationStatuses = [
  "DRAFT",
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "CANCELLED",
  "ARCHIVED",
] as const;
// Validation schemas live in "@/lib/campus-event-schemas" so client modules that only need labels
// and helpers from this file do not ship zod.
export type { EventFilters } from "@/lib/campus-event-schemas";
export type CampusEvent = {
  id: string;
  clubId: string;
  clubName: string;
  title: string;
  description: string;
  allDay?: boolean;
  date: string;
  endDate: string;
  location: string;
  category: string;
  contact: string;
  rsvpEnabled: boolean;
  rsvpRequired: boolean;
  capacity: number | null;
  rsvpDeadline: string | null;
  template: string;
  flyerUrl: string | null;
  rsvpCount: number;
  revision: number;
};
export type ManagedCampusEvent = CampusEvent & {
  status: string;
  submittedAt: string | null;
  rejectionReason: string | null;
  reviewedAt?: string | null;
  publishedAt?: string | null;
};
const parts = (d: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: EVENT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
export function nyDate(d: Date = new Date()) {
  const p = parts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
/** Wall-time conversion: rejects spring DST gaps; fall ambiguity uses the earlier occurrence. */
export function newYorkInstant(wall: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall))
    throw Error("Enter a date and time.");
  const [y, m, d, h, min] = wall.match(/\d+/g)!.map(Number),
    expected = Date.UTC(y, m - 1, d, h, min);
  if (new Date(expected).toISOString().slice(0, 16) !== wall)
    throw Error("Enter a valid date and time.");
  // Derive candidate offsets from the configured zone on both sides of a transition.
  const offsets = new Set([-36, 0, 36].map(hours => {
    const reference = new Date(expected + hours * 3600000), p = parts(reference);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - +reference;
  }));
  const guesses = [...offsets]
    .map((offset) => new Date(expected - offset))
    .filter((value) => {
      const p = parts(value);
      return (
        p.year === y &&
        p.month === m &&
        p.day === d &&
        p.hour === h &&
        p.minute === min
      );
    });
  if (!guesses.length)
    throw Error(
      "This time does not exist due to daylight saving time. Choose another time.",
    );
  return guesses.sort((a, b) => +a - +b)[0];
}
export function newYorkInput(instant: string) {
  const p = parts(new Date(instant));
  return `${nyDate(new Date(instant))}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
export const eventDay = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export function eventDateWindow(
  period: string,
  date = "",
  now = new Date(),
): { start: Date; end: Date } | null {
  const today = nyDate(now);
  let start = date || today,
    end = eventDay(start, 1);
  if (date) {
    newYorkInstant(`${date}T00:00`);
  } else if (period === "All") return null;
  else if (period === "This Week") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    start = eventDay(today, -((weekday + 6) % 7));
    end = eventDay(start, 7);
  } else if (period === "Weekend") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    start = eventDay(today, weekday === 0 ? -1 : weekday === 6 ? 0 : 6 - weekday);
    end = eventDay(start, 2);
  }
  return {
    start: newYorkInstant(`${start}T00:00`),
    end: newYorkInstant(`${end}T00:00`),
  };
}
export const eventDateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
export const eventTimeLabel = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(value));
/** Ordinary legacy meetings remain visible. Moderated events require published approval. */
export const publicMeetingVisibility = {
  club: { is: { suspendedAt: null } },
  audience: "RECRUITMENT",
  isPublic: true,
  OR: [
    { publication: { is: null } },
    { publication: { is: { status: "PUBLISHED" } } },
  ],
} satisfies Prisma.MeetingWhereInput;
export function eventIsPublished(event: {
  club?: { suspendedAt?: Date | string | null };
  isPublic: boolean;
  audience: string;
  revision: number;
  publication: { status: string; approvedRevision: number | null } | null;
}) {
  return (
    !event.club?.suspendedAt &&
    event.isPublic &&
    event.audience === "RECRUITMENT" &&
    event.publication?.status === "PUBLISHED" &&
    event.publication.approvedRevision === event.revision
  );
}

export function managedEventStatus(event: ManagedCampusEvent) {
  return ({ DRAFT: event.submittedAt ? "Changes require approval" : "Draft", PENDING: "Pending approval", PUBLISHED: "Published", REJECTED: "Rejected", CANCELLED: "Cancelled", ARCHIVED: "Archived" } as Record<string, string>)[event.status] || "Unavailable";
}
export function eventRsvpSummary(count: number, capacity: number | null) {
  return capacity === null ? `${count} RSVPs · Unlimited capacity` : `${count} / ${capacity} RSVPs · ${count >= capacity ? "Event Full" : `${capacity - count} ${capacity - count === 1 ? "spot" : "spots"} remaining`}`;
}

/** Canonical timestamps remain the source of dates; all-day ends are exclusive. */
export function eventScheduleLabel(event: Pick<CampusEvent, "date" | "endDate" | "allDay">) {
  if (event.allDay) {
    const last = newYorkInstant(`${eventDay(nyDate(new Date(event.endDate)), -1)}T00:00`).toISOString();
    return `${eventDateLabel(event.date)}${nyDate(new Date(last)) === nyDate(new Date(event.date)) ? "" : ` – ${eventDateLabel(last)}`} · All day`;
  }
  return `${eventDateLabel(event.date)} · ${eventTimeLabel(event.date)} – ${nyDate(new Date(event.date)) === nyDate(new Date(event.endDate)) ? "" : `${eventDateLabel(event.endDate)} · `}${eventTimeLabel(event.endDate)}`;
}
export const eventDurations = [15, 30, 45, 60, 90, 120, 180] as const;
export function eventSchedule(start: string, customEnd: string, duration: string, allDay: boolean, lastDay: string, existing?: Pick<CampusEvent, "date" | "endDate" | "allDay">) {
  if (!allDay && duration !== "custom" && !eventDurations.some(value => String(value) === duration)) throw Error("Choose a valid duration.");
  const date = !allDay && existing && !existing.allDay && newYorkInput(existing.date) === start ? new Date(existing.date) : newYorkInstant(allDay ? `${start.slice(0, 10)}T00:00` : start);
  const endDate = allDay ? newYorkInstant(`${eventDay(lastDay || start.slice(0, 10), 1)}T00:00`)
    : duration === "custom" ? (existing && !existing.allDay && newYorkInput(existing.endDate) === customEnd ? new Date(existing.endDate) : newYorkInstant(customEnd)) : new Date(+date + Number(duration) * 60000);
  if (!Number.isFinite(+endDate) || endDate <= date) throw Error(allDay ? "End Date must be on or after Start Date." : "End Time must be after Start Time.");
  return { date, endDate };
}
