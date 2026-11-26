import type { IconComponent } from "~/components/icon-factory";
import { Bell, CalendarDays, CheckCheck, FileText, ListChecks, Mail, Megaphone, Users2 } from "~/components/icons";
import type { InboxRow } from "~/lib/types";

/**
 * How the web presents a durable notification (lib/communications-client.ts `inboxNotification`,
 * lib/notification-presentation.ts, lib/student-agenda.ts). Display only: the rows, their order
 * and the unread count are the server's.
 */
export const EASTERN = "America/New_York";

const typeLabels: Record<string, string> = {
  DECISION: "Decision Available", OFFER_RESPONSE: "Offer Confirmation", ANNOUNCEMENT: "Announcement", INTERVIEW: "Interview Invite", APPLICATION: "Application Update",
  INVITATION: "Club Invitation", TASK: "Task", PLATFORM: "OutClass Update", MESSAGE: "Private Message",
};
const typeIcons: Record<string, IconComponent> = { ANNOUNCEMENT: Megaphone, INTERVIEW: CalendarDays, APPLICATION: FileText, INVITATION: Users2, TASK: ListChecks, DECISION: FileText, OFFER_RESPONSE: CheckCheck, PLATFORM: Bell, MESSAGE: Mail };

export const typeLabel = (item: InboxRow) => typeLabels[item.type] ?? "OutClass Update";
export const typeIcon = (item: InboxRow): IconComponent => typeIcons[item.type] ?? Bell;
export const clubName = (item: InboxRow) => item.club?.name || "OutClass";
export const isUrgent = (item: InboxRow) => item.type === "INTERVIEW";
/** The urgent pill: white on this red keeps 6.4:1 contrast in light and dark appearance. */
export const URGENT_RED = "#b42318";
export const senderTitle = (item: InboxRow) => (item.type === "MESSAGE" ? "Private message" : "Club update");
export const preview = (item: InboxRow) => item.body.slice(0, 160);

/** The action label the web gives each kind of update. */
export function ctaLabel(item: InboxRow): string | undefined {
  const href = item.href ?? "";
  if (item.eventKey?.startsWith("interview-assignment:")) return "Open interview room";
  if (href.startsWith("/interviews/book")) return item.eventKey?.includes(":confirmed:") ? "View interview" : "Book interview";
  if (item.type === "DECISION") return "View Decision";
  if (item.type === "OFFER_RESPONSE") return "View response";
  if (item.type === "TASK") return "View task";
  if (item.type === "APPLICATION" || item.type === "INTERVIEW") return "View application";
  if (item.type === "INVITATION") return "Review invitation";
  return undefined;
}

/** Announcements target the inbox itself: they are read in place, as on the web. */
export function opensInPlace(item: InboxRow): boolean {
  if (!item.href) return true;
  try {
    const url = new URL(item.href, "https://outclass.local");
    return url.pathname === "/inbox" || url.searchParams.get("view") === "inbox";
  } catch { return true; }
}

/** Mon D, YYYY, h:mm AM (Eastern), as the web's inbox rows show. */
export function fullDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
}

const units = [[31536000, "year", "yr."], [2592000, "month", "mo."], [604800, "week", "wk."], [86400, "day", "day"], [3600, "hour", "hr."], [60, "minute", "min."], [1, "second", "sec."]] as const;
type RelativeFormat = { format(value: number, unit: string): string };
type RelativeFormatConstructor = new (locale: string, options: { numeric: "auto"; style: "short" }) => RelativeFormat;

/** The web's `notificationRelativeTime`: "Just now", then en short relative time ("3 hr. ago", "yesterday"). */
export function relativeTime(createdAt: string | undefined, fallback: string, now = Date.now()): string {
  const date = Date.parse(createdAt || "");
  if (!Number.isFinite(date)) return fallback;
  const seconds = (date - now) / 1000;
  if (Math.abs(seconds) < 45) return "Just now";
  const [size, unit, short] = units.find(([size]) => Math.abs(seconds) >= size) ?? units[units.length - 1]!;
  const value = Math.round(seconds / size);
  const Relative = (Intl as unknown as { RelativeTimeFormat?: RelativeFormatConstructor }).RelativeTimeFormat;
  if (Relative) { try { return new Relative("en", { numeric: "auto", style: "short" }).format(value, unit); } catch { /* fall through */ } }
  // The same en-short wording for engines without Intl.RelativeTimeFormat.
  const count = Math.abs(value);
  if (count === 1 && unit === "day") return value < 0 ? "yesterday" : "tomorrow";
  if (count === 1 && (unit === "week" || unit === "month" || unit === "year")) return `${value < 0 ? "last" : "next"} ${short}`;
  const label = unit === "day" ? (count === 1 ? "day" : "days") : short;
  return value < 0 ? `${count} ${label} ago` : `in ${count} ${label}`;
}

export type ReadFilter = "all" | "unread" | "read";
export const typeFilters = ["All", "Announcements", "Interviews", "Urgent"] as const;
export type TypeFilter = (typeof typeFilters)[number];

/** Structured flags only, never guessed from message text (lib/student-agenda.ts). */
const priority = (item: InboxRow) => (isUrgent(item) ? 0 : 2);

export function filterRows(items: InboxRow[], read: ReadFilter, type: TypeFilter): InboxRow[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return (type !== "Announcements" || item.type === "ANNOUNCEMENT") && (type !== "Interviews" || item.type === "INTERVIEW") && (type !== "Urgent" || isUrgent(item))
      && (read === "all" || (read === "read" ? !!item.readAt : !item.readAt));
  });
}

/** The web's default order and headings: recruiting priority, newest first within each group. */
export function groupRows(items: InboxRow[]): { title: string; data: InboxRow[] }[] {
  const date = (item: InboxRow) => Date.parse(item.createdAt) || 0;
  const sorted = [...items].sort((a, b) => priority(a) - priority(b) || date(b) - date(a));
  const groups = new Map<string, InboxRow[]>();
  for (const item of sorted) {
    const title = priority(item) < 2 ? "Recruitment & schedule updates" : "Club updates";
    groups.set(title, [...(groups.get(title) ?? []), item]);
  }
  return [...groups].map(([title, data]) => ({ title, data }));
}
