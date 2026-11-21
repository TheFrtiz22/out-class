/**
 * Availability, as the web keeps it (lib/availability.ts, lib/scheduling-config.ts). The schedule is
 * local clock time in Eastern Time: a recurring week (seven lists of [start, end) minutes) plus
 * date-specific changes that replace a day. Older schedules saved in another zone keep their zone;
 * the editor reads them in Eastern Time and saves edits as date changes in their own zone, exactly
 * as the web does, so the server's checks (validateAvailabilityEdit) accept the same edits.
 */
export const SCHEDULING_TIMEZONE = "America/New_York";
export const SCHEDULING_TIMEZONE_LABEL = "Eastern Time";
export const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const AVAILABILITY_FIRST_SLOT = (8 * 60) / 15;
export const AVAILABILITY_END_SLOT = (21 * 60) / 15;
export const AVAILABILITY_SLOTS = Array.from({ length: AVAILABILITY_END_SLOT - AVAILABILITY_FIRST_SLOT }, (_, i) => AVAILABILITY_FIRST_SLOT + i);

export type MinuteRange = [number, number];
export type AvailabilitySchedule = { timezone: string; weekly: MinuteRange[][]; weeklySubmitted: boolean; exceptions: Record<string, MinuteRange[]> };
export type AvailabilityDocument = { schedule: AvailabilitySchedule; revision: number; accountId?: string };
export type AvailabilityResponse = "NOT_REQUESTED" | "AWAITING" | "SUBMITTED" | "DECLINED";
export type AvailabilityRound = { id: string; clubId: string; clubName: string; name: string; confirmed: boolean; response: AvailabilityResponse; requested: boolean };
/** `availability.mine` (actions/availability.ts getMyAvailability). */
export type MyAvailability = { document: AvailabilityDocument; rounds: AvailabilityRound[] };
/** `availability.round` (getMyRoundAvailability): this club and round's own copy, prefilled from the global schedule. */
export type RoundAvailability = { preferredWeek?: string; document: AvailabilityDocument; global: AvailabilitySchedule; confirmed: boolean; declined: boolean; name: string };
export const responseLabels: Record<AvailabilityResponse, string> = { NOT_REQUESTED: "Not requested", AWAITING: "Awaiting response", SUBMITTED: "Submitted", DECLINED: "Declined participation" };

export function minuteLabel(minute: number) {
  const hour = Math.floor(minute / 60) % 24;
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}
/** "8 AM" for a whole hour, the grid's row label. */
export function hourLabel(minute: number) {
  const hour = Math.floor(minute / 60) % 24;
  return `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
}

export function emptySchedule(timezone = SCHEDULING_TIMEZONE): AvailabilitySchedule {
  return { timezone, weekly: Array.from({ length: 7 }, () => []), weeklySubmitted: false, exceptions: {} };
}

function validRanges(value: unknown): MinuteRange[] {
  if (!Array.isArray(value)) return [];
  return mergeRanges(value.filter((range): range is MinuteRange => Array.isArray(range) && range.length === 2 && range.every(n => Number.isInteger(n)) && range[0] >= 0 && range[1] <= 1440 && range[1] > range[0]).map(([a, b]) => [a, b] as MinuteRange));
}
/** The schedule a server answer holds, defensively read (a malformed answer becomes an empty, unsubmitted week). */
export function readSchedule(value: unknown): AvailabilitySchedule {
  const raw = value && typeof value === "object" ? value as Partial<AvailabilitySchedule> : {};
  const weekly = Array.isArray(raw.weekly) && raw.weekly.length === 7 ? raw.weekly.map(validRanges) : emptySchedule().weekly;
  const exceptions: Record<string, MinuteRange[]> = {};
  if (raw.exceptions && typeof raw.exceptions === "object") for (const [date, ranges] of Object.entries(raw.exceptions)) if (validDate(date)) exceptions[date] = validRanges(ranges);
  return { timezone: typeof raw.timezone === "string" && raw.timezone ? raw.timezone : SCHEDULING_TIMEZONE, weekly, weeklySubmitted: raw.weeklySubmitted === true, exceptions };
}
export function readDocument(value: unknown): AvailabilityDocument {
  const raw = value && typeof value === "object" ? value as Partial<AvailabilityDocument> : {};
  return { schedule: readSchedule(raw.schedule), revision: typeof raw.revision === "number" ? raw.revision : 0, ...(typeof raw.accountId === "string" ? { accountId: raw.accountId } : {}) };
}

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1900-01-01" && value <= "2200-12-31" && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function mergeRanges(ranges: MinuteRange[]): MinuteRange[] {
  const result: MinuteRange[] = [];
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = result[result.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else result.push([start, end]);
  }
  return result;
}
export function addDays(date: string, days: number) { return new Date(+new Date(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10); }
export function dayIndex(date: string) { return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; }
export function monday(date: string) { return addDays(date, -dayIndex(date)); }
export function dayRanges(schedule: AvailabilitySchedule, date: string): MinuteRange[] { return schedule.exceptions[date] ?? (schedule.weeklySubmitted ? schedule.weekly[dayIndex(date)] : []); }
export function dayKnown(schedule: AvailabilitySchedule, date: string) { return Object.hasOwn(schedule.exceptions, date) || schedule.weeklySubmitted; }
export function rangesToCells(ranges: MinuteRange[]) { return Array.from({ length: 96 }, (_, i) => ranges.some(([a, b]) => i * 15 >= a && i * 15 < b)); }
export function cellsToRanges(cells: boolean[]): MinuteRange[] { return mergeRanges(cells.flatMap((on, i) => on ? [[i * 15, (i + 1) * 15] as MinuteRange] : [])); }

/** Editing, copying and clearing only replace the visible 8 AM–9 PM cells, keeping hidden history. */
export function replaceVisibleCells(ranges: MinuteRange[], cells: boolean[]) {
  return cellsToRanges(rangesToCells(ranges).map((old, i) => i >= AVAILABILITY_FIRST_SLOT && i < AVAILABILITY_END_SLOT ? cells[i] : old));
}
export function restoreVisibleRecurring(schedule: AvailabilitySchedule, date: string): AvailabilitySchedule {
  const recurring = schedule.weeklySubmitted ? schedule.weekly[dayIndex(date)] : [];
  const restored = replaceVisibleCells(dayRanges(schedule, date), rangesToCells(recurring));
  const exceptions = { ...schedule.exceptions };
  if (JSON.stringify(restored) === JSON.stringify(recurring)) delete exceptions[date];
  else exceptions[date] = restored;
  return { ...schedule, exceptions };
}

// One formatter per zone: building Intl formatters is slow on Hermes.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string) {
  let result = formatters.get(zone);
  if (!result) {
    result = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    if (formatters.size >= 32) formatters.clear();
    formatters.set(zone, result);
  }
  return result;
}
export function localParts(instant: number | Date, zone: string) {
  const p = Object.fromEntries(formatter(zone).formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  // Some engines write midnight as "24" with hour12: false.
  return { date: `${p.year}-${p.month}-${p.day}`, minute: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}
export function today(zone = SCHEDULING_TIMEZONE) { return localParts(new Date(), zone).date; }

export type WeekCell = { date: string; minute: number; start: number | null; end: number | null };
/** One wall-clock cell per quarter hour in `zone`; daylight-saving gaps and folds are explicit (null), never guessed. */
export function weekCells(week: string, zone: string): WeekCell[][] {
  return Array.from({ length: 7 }, (_, day) => {
    const date = addDays(week, day), base = +new Date(`${date}T00:00:00Z`);
    const offsets = new Set([-86400000, 43200000, 172800000].map(delta => {
      const instant = base + delta, p = localParts(instant, zone);
      return +new Date(`${p.date}T00:00:00Z`) + p.minute * 60000 - instant;
    }));
    return Array.from({ length: 96 }, (_, i) => {
      const minute = i * 15;
      const candidates = [...offsets].map(offset => base + minute * 60000 - offset).filter(time => { const p = localParts(time, zone); return p.date === date && p.minute === minute; });
      const start = candidates.length === 1 ? candidates[0] : null;
      return { date, minute, start, end: start === null ? null : start + 900000 };
    });
  });
}
type AvailabilityState = "available" | "unavailable" | "unknown";
/** Every minute and both boundaries: partial coverage never reads as available. */
export function intervalAvailability(schedule: AvailabilitySchedule | null, start: number, end: number): AvailabilityState {
  if (!schedule || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 7 * 86400000) return "unknown";
  let unknown = false;
  for (let time = start; time < end; time = Math.min(end, Math.floor(time / 60000) * 60000 + 60000)) {
    const p = localParts(time, schedule.timezone);
    if (!dayKnown(schedule, p.date)) unknown = true;
    else if (!dayRanges(schedule, p.date).some(([a, b]) => p.minute >= a && p.minute < b)) return "unavailable";
  }
  return unknown ? "unknown" : "available";
}

/** The seven days of cells the editor shows for `week` (the recurring week when `recurring`). */
export function availabilityEditorDays(schedule: AvailabilitySchedule, week: string, recurring: boolean) {
  if (schedule.timezone === SCHEDULING_TIMEZONE) return Array.from({ length: 7 }, (_, i) => rangesToCells(recurring ? schedule.weekly[i] : dayRanges(schedule, addDays(week, i))));
  const source = recurring ? { ...schedule, weeklySubmitted: true, exceptions: {} } : schedule;
  return weekCells(week, SCHEDULING_TIMEZONE).map(day => day.map(c => c.start !== null && intervalAvailability(source, c.start, c.end!) === "available"));
}
/** Which of the week's days have submitted availability (a day that isn't is "unknown", not "unavailable"). */
export function availabilityEditorKnownDays(schedule: AvailabilitySchedule, week: string) {
  if (schedule.timezone === SCHEDULING_TIMEZONE) return Array.from({ length: 7 }, (_, i) => dayKnown(schedule, addDays(week, i)));
  return weekCells(week, SCHEDULING_TIMEZONE).map(day => AVAILABILITY_SLOTS.every(slot => {
    const instant = day[slot].start;
    return instant !== null && dayKnown(schedule, localParts(instant, schedule.timezone).date);
  }));
}
/** Applies edited days: Eastern schedules change the recurring week or add date changes; legacy zones get native date changes. */
export function editAvailabilityDays(schedule: AvailabilitySchedule, week: string, recurring: boolean, days: boolean[][], changedDays: number[]): AvailabilitySchedule {
  if (schedule.timezone === SCHEDULING_TIMEZONE) {
    if (recurring) return { ...schedule, weeklySubmitted: true, weekly: schedule.weekly.map((ranges, i) => changedDays.includes(i) ? replaceVisibleCells(ranges, days[i]) : ranges) };
    return { ...schedule, exceptions: { ...schedule.exceptions, ...Object.fromEntries(changedDays.map(i => { const date = addDays(week, i); return [date, replaceVisibleCells(dayRanges(schedule, date), days[i])]; })) } };
  }
  const exceptions = { ...schedule.exceptions }, cells = weekCells(week, SCHEDULING_TIMEZONE);
  for (const day of changedDays) for (const slot of AVAILABILITY_SLOTS) {
    const instant = cells[day][slot].start;
    if (instant === null) continue;
    const p = localParts(instant, schedule.timezone), native = rangesToCells(exceptions[p.date] ?? dayRanges(schedule, p.date));
    native[p.minute / 15] = days[day][slot];
    exceptions[p.date] = cellsToRanges(native);
  }
  return { ...schedule, exceptions };
}

/** The slots from `from` to `to` (either order) of one day set to `on`. */
export function paintSlots(cells: boolean[], from: number, to: number, on: boolean) {
  const low = Math.min(from, to), high = Math.max(from, to);
  return cells.map((value, slot) => slot >= low && slot <= high ? on : value);
}
export const sameSchedule = (a: AvailabilitySchedule, b: AvailabilitySchedule) => JSON.stringify(a) === JSON.stringify(b);
/** Hours a day's visible cells cover, for the day picker ("3.5 h"). */
export function visibleHours(cells: boolean[]) {
  return AVAILABILITY_SLOTS.filter(slot => cells[slot]).length / 4;
}
