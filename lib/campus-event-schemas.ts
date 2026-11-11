import { z } from "zod";
import { eventCategories, flyerTemplates, newYorkInstant, nyDate } from "@/lib/campus-events";

// Campus event input validation, used by server actions (actions/campus-events.ts). Kept apart from
// "@/lib/campus-events" so that client components importing its labels and helpers do not ship zod.
export const eventEditorSchema = z
  .object({
    id: z.string().uuid().optional(),
    clubId: z.string().uuid(),
    revision: z.number().int().min(0).default(0),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10000),
    allDay: z.boolean().default(false),
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
    useTemplate: z.boolean().default(false),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (e.allDay && (+newYorkInstant(`${nyDate(e.date)}T00:00`) !== +e.date || +newYorkInstant(`${nyDate(e.endDate)}T00:00`) !== +e.endDate))
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "All-day dates must start at local midnight with an exclusive end date." });
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
    savedOnly: z.boolean().default(false),
    sort: z.enum(["soonest", "latest", "name"]).default("soonest"),
    page: z.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type EventFilters = z.input<typeof eventFiltersSchema>;
