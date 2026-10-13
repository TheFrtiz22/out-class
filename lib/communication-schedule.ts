import { z } from "zod";
import { recipientAudienceSchema } from "@/lib/recipient-audience";

export const scheduleInput = z.object({
  id: z.string().uuid(), clubId: z.string().uuid(), revision: z.number().int().nonnegative().nullable(),
  title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(10000),
  audience: recipientAudienceSchema.refine(value=>![...value.include,...value.exclude].some(rule=>rule.source==="PEOPLE"), "Use a saved group to select individual recipients."), recipientMode: z.enum(["FIXED", "SEND_TIME"]),
  localTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  timeZone: z.string().min(1).max(100), occurrence: z.enum(["EARLIER", "LATER"]),
}).strict();

/** Resolve wall time in the explicit IANA zone, independent of browser/server zone.
 * Gaps are rejected. A repeated hour requires the caller's earlier/later choice.
 * Probe offsets on both sides of transitions, including half-hour DST changes. */
export function resolveScheduleTime(localTime: string, timeZone: string, occurrence: "EARLIER" | "LATER") {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const parts = (date: Date) => {
    const p = Object.fromEntries(format.formatToParts(date).map(v => [v.type, v.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  };
  const naive = Date.parse(localTime + ":00Z");
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0,16) !== localTime) throw Error("Invalid calendar date.");
  const offsets = new Set<number>();
  for (const hours of [-48,-24,-12,0,12,24,48]) {
    const instant = naive + hours * 3600000;
    offsets.add(Date.parse(parts(new Date(instant)) + ":00Z") - instant);
  }
  const matches = [...offsets].map(offset => naive-offset).filter(instant => parts(new Date(instant)) === localTime).sort((a,b)=>a-b);
  if (!matches.length) throw Error("This local time does not exist because the clocks change. Choose another time.");
  return new Date(matches[occurrence === "LATER" ? matches.length-1 : 0]);
}
export function requireFutureSchedule(date: Date, now = Date.now()) {
  if (date.getTime() < now + 60000) throw Error("Schedule at least one minute in the future.");
  if (date.getTime() > now + 366 * 86400000) throw Error("Schedule within the next year.");
}

/** Decision handlers publish status/version/optional immutable letter,
 * canonical notification and outbox intent inside this same transaction. Never
 * stage visible outcomes while preparing a schedule. Unsupported kinds fail closed. */
export type ScheduledPublicationKind = "ANNOUNCEMENT" | "DECISION";
