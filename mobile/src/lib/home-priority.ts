import { easternDateKey, toInstant } from "~/lib/eastern";
import type { CalendarEvent, HomeApplication, StudentApplication, TaskNotification } from "~/lib/types";

/**
 * How Home decides what goes on top. Pure, so the rules are tested on their own
 * (__tests__/render/home-redesign.test.tsx) and written out in docs/mobile/home-priority.md.
 *
 * 1. The hero card holds the single most pressing thing, and shows only when something is pressing.
 * 2. The sections below it sort by how much they need the person today; empty sections hide.
 * 3. Whatever is in the hero doesn't also push its own section up, and isn't listed again in it: it is already on top.
 */
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
/** An event this close (or one under way) is the hero. */
export const EVENT_SOON = 3 * HOUR;
/** An event that started up to this long ago still counts as happening now (when it has no end time). */
const EVENT_GRACE = 30 * 60_000;

/** What Home knows about a club the person leads, from its leader overview. */
export type LeaderSignal = {
  clubId: string; clubName: string;
  /** Applications in this person's own review queue that they haven't reviewed. */
  pendingReviews: number;
  /** The next interview they can see for this club (this week), if any. */
  nextInterviewAt: string | null;
  /** A voting room open for people to vote in right now. */
  liveVote: { sessionId: string; roundName: string | null } | null;
};

export type HomeHero =
  | { kind: "event"; id: string; at: number; event: CalendarEvent }
  | { kind: "vote"; id: string; at: number; clubId: string; clubName: string; sessionId: string; roundName: string | null }
  | { kind: "task"; id: string; at: number; task: TaskNotification; overdue: boolean }
  | { kind: "application"; id: string; at: number; application: HomeApplication; detail: StudentApplication | undefined };

export type HomeSectionId = "myClubs" | "comingUp" | "applications" | "leading" | "tasks";
/** The calm order (the first mockup): what shows when nothing needs the person. */
export const BASE_ORDER: HomeSectionId[] = ["myClubs", "comingUp", "applications", "leading", "tasks"];
/** A section's weight when something in it needs the person today, and when nothing does. */
export const SECTION_WEIGHT: Record<HomeSectionId, { urgent: number; calm: number }> = {
  leading: { urgent: 90, calm: 30 },
  tasks: { urgent: 85, calm: 25 },
  comingUp: { urgent: 80, calm: 40 },
  applications: { urgent: 75, calm: 35 },
  myClubs: { urgent: 50, calm: 50 },
};

export type HomeInput = {
  now: Date;
  applications: HomeApplication[];
  /** applications.view rows (progress, attention), matched by id. May be empty while loading. */
  details?: StudentApplication[];
  agenda: CalendarEvent[];
  tasks: TaskNotification[];
  /** One per club the person leads (only clubs whose overview has loaded). */
  leading?: LeaderSignal[];
  /** Whether the person leads any club at all (the Leading section shows even before its numbers load). */
  leads?: boolean;
};

export type HomeLayout = { hero: HomeHero | null; sections: HomeSectionId[]; urgent: Partial<Record<HomeSectionId, boolean>> };

const time = (value: string | null | undefined) => toInstant(value)?.getTime() ?? NaN;
const openDraft = (application: HomeApplication) => application.draft && !application.intakeClosed && !application.closed;
/** When a draft is due: the server's deadline event, else the club's own deadline from applications.view. */
export const applicationDue = (application: HomeApplication, detail?: StudentApplication) => {
  const own = time(application.deadline?.startTime);
  return Number.isFinite(own) ? own : time(detail?.club.applicationDeadline);
};
const taskDue = (task: TaskNotification) => task.taskActivity?.needsSubmission === false ? NaN : time(task.taskActivity?.dueAt);
/** An event the person is going to that starts soon or is under way. Deadlines and declined events don't count. */
/** When an event ends: its end time, or its start plus its length (interview panels carry only a length). */
const eventEnd = (event: CalendarEvent) => Number.isFinite(time(event.endTime)) ? time(event.endTime) : event.durationMinutes ? time(event.startTime) + event.durationMinutes * 60_000 : NaN;
function eventSoon(event: CalendarEvent, now: number) {
  if (event.allDay || event.type === "Deadline" || event.response?.toLowerCase() === "declined") return NaN;
  const start = time(event.startTime), end = eventEnd(event);
  if (!Number.isFinite(start) || start > now + EVENT_SOON) return NaN;
  const over = Number.isFinite(end) ? end <= now : start < now - EVENT_GRACE;
  return over ? NaN : start;
}
const isToday = (at: number, now: Date) => Number.isFinite(at) && easternDateKey(at) === easternDateKey(now);

/**
 * The hero, by tier (lower wins), then the soonest, then a stable id:
 * 1 an event within 3 hours or under way (meetings, your interviews, panels you sit on);
 * 2 a voting room open right now in a club you lead;
 * 3 a task overdue or due within 24 hours;
 * 4 a draft application due within 7 days;
 * 5 a task due within 3 days;
 * 6 a draft application due within 14 days.
 * Nothing in those windows: no hero.
 */
export function pickHero(input: HomeInput): HomeHero | null {
  const now = +input.now;
  const candidates: { tier: number; hero: HomeHero }[] = [];
  for (const event of input.agenda) {
    const at = eventSoon(event, now);
    if (Number.isFinite(at)) candidates.push({ tier: 1, hero: { kind: "event", id: `event:${event.id}`, at, event } });
  }
  for (const signal of input.leading ?? []) {
    if (signal.liveVote) candidates.push({ tier: 2, hero: { kind: "vote", id: `vote:${signal.liveVote.sessionId}`, at: now, clubId: signal.clubId, clubName: signal.clubName, sessionId: signal.liveVote.sessionId, roundName: signal.liveVote.roundName } });
  }
  for (const task of input.tasks) {
    const at = taskDue(task);
    if (!Number.isFinite(at)) continue;
    const tier = at <= now + DAY ? 3 : at <= now + 3 * DAY ? 5 : 0;
    if (tier) candidates.push({ tier, hero: { kind: "task", id: `task:${task.id}`, at, task, overdue: at < now } });
  }
  const details = new Map((input.details ?? []).map(detail => [detail.id, detail]));
  for (const application of input.applications) {
    if (!openDraft(application)) continue;
    const detail = details.get(application.id);
    const at = applicationDue(application, detail);
    // A deadline that has passed can't be met: that draft is no longer the thing to do first.
    if (!Number.isFinite(at) || at < now) continue;
    const tier = at <= now + 7 * DAY ? 4 : at <= now + 14 * DAY ? 6 : 0;
    if (tier) candidates.push({ tier, hero: { kind: "application", id: `application:${application.id}`, at, application, detail } });
  }
  candidates.sort((a, b) => a.tier - b.tier || a.hero.at - b.hero.at || (a.hero.id < b.hero.id ? -1 : a.hero.id > b.hero.id ? 1 : 0));
  return candidates[0]?.hero ?? null;
}

/** Applications first that need the person: a decision or step waiting on them, then drafts due soonest; then the server's order. */
export function rankApplications(input: Pick<HomeInput, "now" | "applications" | "details">) {
  const now = +input.now;
  const details = new Map((input.details ?? []).map(detail => [detail.id, detail]));
  const weight = (application: HomeApplication) => {
    const detail = details.get(application.id);
    if (openDraft(application)) {
      const due = applicationDue(application, detail);
      return Number.isFinite(due) && due >= now && due <= now + 7 * DAY ? 1 : 2;
    }
    return detail?.attention ? 0 : 3;
  };
  return input.applications.map((application, index) => ({ application, index, weight: weight(application) }))
    .sort((a, b) => a.weight - b.weight || a.index - b.index).map(item => item.application);
}

/** Upcoming agenda rows: not yet over, soonest first. */
export function upcoming(agenda: CalendarEvent[], now: Date) {
  return agenda.filter(event => {
    const end = eventEnd(event), start = time(event.startTime);
    return event.allDay ? easternDateKey(start) >= easternDateKey(now) : Number.isFinite(end) ? end > +now : start >= +now - EVENT_GRACE;
  }).sort((a, b) => time(a.startTime) - time(b.startTime));
}

/** The whole layout: the hero, then the sections that have something, most pressing first. */
export function homeLayout(input: HomeInput): HomeLayout {
  const now = +input.now;
  const hero = pickHero(input);
  const heroId = hero?.id;
  const details = new Map((input.details ?? []).map(detail => [detail.id, detail]));
  const present: Partial<Record<HomeSectionId, boolean>> = {
    myClubs: true,
    // The hero's own item is left out of its section, so a section whose only item is in the hero hides.
    comingUp: upcoming(input.agenda, input.now).some(event => `event:${event.id}` !== heroId),
    applications: input.applications.some(application => `application:${application.id}` !== heroId),
    leading: !!input.leads,
    tasks: input.tasks.some(task => `task:${task.id}` !== heroId),
  };
  const urgent: Partial<Record<HomeSectionId, boolean>> = {
    leading: (input.leading ?? []).some(signal => signal.pendingReviews > 0 || !!signal.liveVote || (isToday(time(signal.nextInterviewAt), input.now) && time(signal.nextInterviewAt) >= now)),
    tasks: input.tasks.some(task => {
      if (`task:${task.id}` === heroId) return false;
      const due = taskDue(task);
      return !task.read || (Number.isFinite(due) && due <= now + 2 * DAY);
    }),
    comingUp: upcoming(input.agenda, input.now).some(event => `event:${event.id}` !== heroId && event.type !== "Deadline" && isToday(time(event.startTime), input.now)),
    applications: input.applications.some(application => {
      if (`application:${application.id}` === heroId) return false;
      const detail = details.get(application.id);
      if (openDraft(application)) { const due = applicationDue(application, detail); return Number.isFinite(due) && due >= now && due <= now + 7 * DAY; }
      return !!detail?.attention;
    }),
    myClubs: false,
  };
  const score = (id: HomeSectionId) => urgent[id] ? SECTION_WEIGHT[id].urgent : SECTION_WEIGHT[id].calm;
  const sections = BASE_ORDER.filter(id => present[id]).sort((a, b) => score(b) - score(a) || BASE_ORDER.indexOf(a) - BASE_ORDER.indexOf(b));
  return { hero, sections, urgent };
}
