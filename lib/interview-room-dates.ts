import type { InterviewRoomEntry } from "@/lib/interview-entry";

const dayKey = (date: Date, timezone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
export function groupInterviewDates(rows: InterviewRoomEntry[]) {
  const groups = new Map<string, { day: string; label: string; timezone: string; entries: InterviewRoomEntry[] }>();
  for (const row of [...rows].sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime) || a.id.localeCompare(b.id))) {
    const at = new Date(row.startTime), day = dayKey(at, row.timezone);
    if (!groups.has(day)) groups.set(day, { day, timezone: row.timezone, label: new Intl.DateTimeFormat("en-US", { timeZone: row.timezone, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(at), entries: [] });
    groups.get(day)!.entries.push(row);
  }
  return [...groups.values()].sort((a, b) => a.day.localeCompare(b.day));
}
export function defaultInterviewDate(groups: ReturnType<typeof groupInterviewDates>, now = new Date()) {
  return groups.find(g => g.day === dayKey(now, g.timezone))?.day || groups.find(g => g.day > dayKey(now, g.timezone))?.day;
}
export function readExpandedInterviewDates(search: string): string[] | null {
  const query = new URLSearchParams(search);
  if (!query.has("interviewDays")) return null;
  return [...new Set((query.get("interviewDays") || "").split(",").filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day)))];
}
