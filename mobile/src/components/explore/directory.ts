import type { IconComponent } from "~/components/icon-factory";
import { BookOpen, BriefcaseBusiness, ChartNoAxesCombined, Globe2, Heart, Lightbulb, MessageSquare, Mountain, Users } from "~/components/icons";
import type { CampusEvent, PublicClub, PublicMarketing } from "~/lib/types";

/**
 * Display helpers for Explore, club pages and events: ports of the web's pure presentation code
 * (lib/club-directory.ts, lib/recruitment-presentation.ts, lib/campus-events.ts labels,
 * lib/club-marketing.ts profileStatistics). They only word and order what the server returned.
 */
export const EASTERN = "America/New_York";

// lib/recruitment-presentation.ts
export function recruitmentDeadline(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(+date) ? date : null;
}
/** "Nov 30, 2026, 11:59 PM · Eastern Time" (schedulingDateTime + SCHEDULING_TIMEZONE_LABEL). */
export function recruitmentDate(value: Date | string) {
  return `${new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value))} · Eastern Time`;
}
/** The card-width form: "Nov 30, 11:59 PM ET", with the year only when it is not this year's. */
export function shortRecruitmentDate(value: Date | string, now = Date.now()) {
  const date = new Date(value);
  const year = (instant: Date | number) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, year: "numeric" }).format(instant);
  return `${new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, month: "short", day: "numeric", ...(year(date) === year(now) ? {} : { year: "numeric" }), hour: "numeric", minute: "2-digit", hour12: true }).format(date)} ET`;
}
export function clubRecruitment(club: Pick<PublicClub, "source" | "claimed" | "applicationAvailable" | "applicationDeadline">, now = Date.now()) {
  const deadline = recruitmentDeadline(club.applicationDeadline);
  const expired = !!deadline && +deadline <= now;
  const available = club.source !== "preview" && club.applicationAvailable === true && !expired;
  const closingSoon = available && !!deadline && +deadline - now <= 7 * 86400000;
  const label = club.source === "preview" ? "Sample club" : club.claimed === false ? "Unclaimed" : expired ? "Deadline passed" : available ? "Applications open" : club.applicationAvailable === false ? "Applications unavailable" : "Recruitment not published";
  return { deadline, expired, available, closingSoon, label };
}

// lib/club-directory.ts
export type DirectoryFilters = { query: string; category: string; time: string; acceptance: string; sort: string; recruitment: string };
export const emptyDirectoryFilters: DirectoryFilters = { query: "", category: "all", time: "all", acceptance: "all", sort: "name", recruitment: "all" };
/** Search text without case or accents, so "societe" finds "Société". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-US");
/** A category as one key, whatever its case or stray spaces ("Pre-Professional" and "Pre-professional " are one). */
const categoryKey = (category: string | null | undefined) => (category ?? "").trim().toLocaleLowerCase("en-US");
/** The web's directory match when no search index is configured: every word must appear in the club's public text. */
export function filterDirectory(clubs: PublicClub[], filters: DirectoryFilters, now = Date.now()) {
  const words = fold(filters.query.trim()).split(/\s+/).filter(Boolean);
  const deadlineOrder = (club: PublicClub) => {
    const recruitment = clubRecruitment(club, now);
    return recruitment.available && recruitment.deadline ? +recruitment.deadline : Infinity;
  };
  return clubs
    .filter(club => {
      // Where a club meets comes from its public upcoming events (clubs have no separate location field).
      const text = fold([club.name, club.category, club.pitch, club.description || "", ...(club.tags ?? []), ...(club.marketing?.placements ?? []), ...(club.publicEvents ?? []).map(event => event.location ?? "")].join(" "));
      if (!words.every(word => text.includes(word))) return false;
      if (filters.category !== "all" && categoryKey(club.category) !== categoryKey(filters.category)) return false;
      const recruitment = clubRecruitment(club, now);
      if (filters.recruitment === "open" && !recruitment.available) return false;
      if (filters.recruitment === "closed" && recruitment.available) return false;
      if (filters.recruitment === "closing" && !recruitment.closingSoon) return false;
      if (filters.time !== "all" && club.timeCommitment !== filters.time) return false;
      if (filters.acceptance !== "all" && (club.acceptanceRate == null || club.acceptanceRate > Number(filters.acceptance))) return false;
      return true;
    })
    .sort((a, b) => (filters.sort === "deadline" ? deadlineOrder(a) - deadlineOrder(b) : filters.sort === "acceptance" ? (a.acceptanceRate ?? Infinity) - (b.acceptanceRate ?? Infinity) : 0) || a.name.localeCompare(b.name, "en-US"));
}
export const recruitmentOptions = [
  { value: "all", label: "All clubs" },
  { value: "open", label: "Applications open" },
  { value: "closed", label: "Not currently open" },
  { value: "closing", label: "Closing in 7 days" },
] as const;

/** Categories ranked by how many clubs carry them, then by name (components/views/explore-view.tsx). Spellings that differ only in case are one chip, labelled as first seen. */
export function rankedCategories(clubs: PublicClub[]) {
  const counts = new Map<string, { category: string; count: number }>();
  for (const club of clubs) {
    const key = categoryKey(club.category);
    if (!key) continue;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { category: club.category.trim(), count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, "en-US"));
}
export function categoryIcon(category: string): IconComponent {
  const value = category.toLowerCase();
  if (/academic|education/.test(value)) return BookOpen;
  if (/professional|business|finance/.test(value)) return BriefcaseBusiness;
  if (/cultur|international/.test(value)) return Globe2;
  if (/service|volunteer/.test(value)) return Heart;
  if (/recreat|sport|outdoor/.test(value)) return Mountain;
  if (/entrepreneur|startup/.test(value)) return Lightbulb;
  if (/consult/.test(value)) return ChartNoAxesCombined;
  if (/market|communication/.test(value)) return MessageSquare;
  return Users;
}

// lib/club-marketing.ts profileStatistics: club-reported figures the club chose to show.
export function profileStatistics(club: Pick<PublicClub, "acceptanceRate" | "aumValue">, marketing: PublicMarketing) {
  const m = marketing ?? {};
  const reported = (detail?: string) => detail ? /club-reported/i.test(detail) ? detail : `${detail} · Club-reported` : "Club-reported";
  return [
    ...(m.showAcceptance !== false && club.acceptanceRate != null ? [{ label: "Club acceptance", value: `${m.acceptanceApproximate ? "~" : ""}${club.acceptanceRate}%`, detail: reported(m.acceptanceNote) }] : []),
    ...(m.showAum !== false && club.aumValue != null ? [{ label: "AUM", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" }).format(club.aumValue), detail: reported() }] : []),
    ...(m.showMembers !== false && m.memberCount != null ? [{ label: "Members", value: String(m.memberCount), detail: reported() }] : []),
    ...(m.metrics ?? []).filter(metric => metric.label && metric.value).map(metric => ({ ...metric, detail: reported() })),
  ];
}

// lib/application-status.ts: student-facing labels.
const statusLabels: Record<string, string> = { DRAFTING: "Draft", SUBMITTED: "Submitted", IN_REVIEW: "In review", INTERVIEWING: "Interview", ACCEPTED: "Accepted", REJECTED: "Not selected", WAITLISTED: "Waitlisted" };
const statusAliases: Record<string, string> = { DRAFT: "DRAFTING", DRAFTING: "DRAFTING", APPLIED: "SUBMITTED", REVIEW: "IN_REVIEW", INTERVIEW: "INTERVIEWING", "NOT SELECTED": "REJECTED" };
export function applicationStatusCode(status: string) {
  const normalized = status.toUpperCase().replaceAll("_", " ");
  return statusAliases[normalized] || (normalized === "IN REVIEW" ? "IN_REVIEW" : status.toUpperCase());
}
export const applicationStatusLabel = (status: string) => statusLabels[applicationStatusCode(status)] || status;

// lib/campus-events.ts labels. Events are shown in Eastern Time, as on the web.
export const eventCategories = ["Academic", "Professional", "Social", "Sports", "Arts", "Service", "Other"] as const;
export const eventDateLabel = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
export const eventTimeLabel = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
/** The Eastern calendar date of an instant, as YYYY-MM-DD. */
export function easternDate(value: string | Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
/** A calendar date moved by whole days. */
export function shiftDay(date: string, days: number) {
  const moved = new Date(`${date}T12:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}
const calendarDayLabel = (date: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
/** All-day ends are exclusive, so the last day shown is the day before the stored end. */
export function eventScheduleLabel(event: Pick<CampusEvent, "date" | "endDate" | "allDay">) {
  if (event.allDay) {
    const first = easternDate(event.date), last = shiftDay(easternDate(event.endDate), -1);
    return `${eventDateLabel(event.date)}${last > first ? ` – ${calendarDayLabel(last)}` : ""} · All day`;
  }
  return `${eventDateLabel(event.date)} · ${eventTimeLabel(event.date)} – ${easternDate(event.date) === easternDate(event.endDate) ? "" : `${eventDateLabel(event.endDate)} · `}${eventTimeLabel(event.endDate)}`;
}

// lib/event-board-empty.ts
export type EventFilters = { query: string; period: "All" | "Today" | "This Week" | "Weekend"; category: string; savedOnly: boolean; required: boolean; sort: "soonest" | "latest" | "name" };
export const initialEventFilters: EventFilters = { query: "", period: "All", category: "", savedOnly: false, required: false, sort: "soonest" };
export function eventBoardEmpty(filters: EventFilters): { title: string; description: string; action: { kind: "clear-filters" | "show-all-events" | "explore-clubs"; label: string } } {
  const narrowed = !!(filters.query || filters.category || filters.required || filters.period !== "All");
  if (narrowed) return {
    title: filters.query ? `No events match “${filters.query}”.` : "No events match these filters.",
    description: filters.savedOnly ? "None of your saved events fit the current search or filters." : "Nothing approved fits the current search or filters.",
    action: { kind: "clear-filters", label: "Clear filters" },
  };
  if (filters.savedOnly) return { title: "You haven’t saved any events yet.", description: "Save an event from the board to keep it here.", action: { kind: "show-all-events", label: "Browse all events" } };
  return { title: "No upcoming campus events yet.", description: "Clubs haven’t published upcoming events. Browse clubs to see what they do.", action: { kind: "explore-clubs", label: "Explore clubs" } };
}

// lib/share-links.ts
export const clubSharePath = (clubId: string) => `/club/${encodeURIComponent(clubId)}`;
export const eventSharePath = (eventId: string) => `/corkboard?event=${encodeURIComponent(eventId)}`;

// lib/club-assets.ts clubAssetSource: uploaded club images are served by the site, not Storage.
const assetReference = /^club-assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/;
export function clubImage(value: string | null | undefined, siteUrl: string): string | null {
  if (!value) return null;
  if (assetReference.test(value)) return `${siteUrl}/api/club-assets?reference=${encodeURIComponent(value)}`;
  if (value.startsWith("/") && !value.startsWith("//")) return `${siteUrl}${value}`;
  return /^(https:\/\/|data:image\/)/i.test(value) ? value : null;
}
