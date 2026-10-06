import { z } from "zod";
import type { Prisma } from "@prisma/client";
export const EVENT_TIMEZONE = "America/New_York";
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
export const eventEditorSchema = z
  .object({
    id: z.string().uuid().optional(),
    clubId: z.string().uuid(),
    revision: z.number().int().min(0).default(0),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10000),
    date: z.coerce.date(),
    endDate: z.coerce.date(),
    location: z.string().trim().min(1).max(500),
    category: z.enum(eventCategories),
    contact: z.string().trim().max(500).default(""),
    rsvpEnabled: z.boolean(),
    rsvpRequired: z.boolean(),
    capacity: z.number().int().min(1).max(100000).nullable(),
    rsvpDeadline: z.coerce.date().nullable(),
    template: z.enum(flyerTemplates),
    useTemplate: z.boolean().default(true),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (e.endDate <= e.date)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End time must follow the start.",
      });
    if (e.rsvpRequired && !e.rsvpEnabled)
      ctx.addIssue({
        code: "custom",
        path: ["rsvpRequired"],
        message: "Enable RSVP before requiring it.",
      });
    if (e.rsvpDeadline && e.rsvpDeadline > e.date)
      ctx.addIssue({
        code: "custom",
        path: ["rsvpDeadline"],
        message: "RSVP deadline must not follow event start.",
      });
  });
export const eventCommandSchema = z
  .object({
    eventId: z.string().uuid(),
    clubId: z.string().uuid(),
    revision: z.number().int().min(0),
    command: z.enum(["SUBMIT", "WITHDRAW", "CANCEL", "ARCHIVE"]),
  })
  .strict();
export const eventReviewSchema = z
  .object({
    eventId: z.string().uuid(),
    revision: z.number().int().min(0),
    approved: z.boolean(),
    reason: z.string().trim().max(1000).default(""),
  })
  .strict()
  .refine(
    (v) => v.approved || v.reason.length >= 5,
    "Provide a rejection reason (at least five characters).",
  );
export const eventFiltersSchema = z
  .object({
    query: z.string().trim().max(200).default(""),
    period: z.enum(["All", "Today", "This Week", "Weekend"]).default("All"),
    category: z.enum([...eventCategories, ""]).default(""),
    clubId: z.union([z.string().uuid(), z.literal("")]).default(""),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal(""))
      .default(""),
    location: z.string().trim().max(200).default(""),
    required: z.boolean().default(false),
    sort: z.enum(["soonest", "latest", "name"]).default("soonest"),
    page: z.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type EventFilters = z.input<typeof eventFiltersSchema>;
export type CampusEvent = {
  id: string;
  clubId: string;
  clubName: string;
  title: string;
  description: string;
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
    throw Error("Enter a date and time in Eastern Time.");
  const [y, m, d, h, min] = wall.match(/\d+/g)!.map(Number),
    expected = Date.UTC(y, m - 1, d, h, min);
  if (new Date(expected).toISOString().slice(0, 16) !== wall)
    throw Error("Enter a valid date and time.");
  const guesses = [4, 5]
    .map((offset) => new Date(expected + offset * 3600000))
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
      "This Eastern Time does not exist due to daylight saving time. Choose another time.",
    );
  return guesses.sort((a, b) => +a - +b)[0];
}
export function newYorkInput(instant: string) {
  const p = parts(new Date(instant));
  return `${nyDate(new Date(instant))}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
const day = (date: string, n: number) => {
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
    end = day(start, 1);
  if (date) {
    newYorkInstant(`${date}T00:00`);
  } else if (period === "All") return null;
  else if (period === "This Week") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    start = day(today, -((weekday + 6) % 7));
    end = day(start, 7);
  } else if (period === "Weekend") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    start = day(today, weekday === 0 ? -1 : weekday === 6 ? 0 : 6 - weekday);
    end = day(start, 2);
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
    timeZone: EVENT_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
/** Ordinary legacy meetings remain visible. Moderated events require published approval. */
export const publicMeetingVisibility = {
  audience: "RECRUITMENT",
  isPublic: true,
  OR: [
    { publication: { is: null } },
    { publication: { is: { status: "PUBLISHED" } } },
  ],
} satisfies Prisma.MeetingWhereInput;
export function eventIsPublished(event: {
  isPublic: boolean;
  audience: string;
  revision: number;
  publication: { status: string; approvedRevision: number | null } | null;
}) {
  return (
    event.isPublic &&
    event.audience === "RECRUITMENT" &&
    event.publication?.status === "PUBLISHED" &&
    event.publication.approvedRevision === event.revision
  );
}
