import { resolveTheme } from "@outclass/shared/tokens";
import { Image } from "expo-image";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { clubImage } from "~/components/explore/directory";
import type { IconComponent } from "~/components/icon-factory";
import { ChevronRight, Gavel, Megaphone, Plus, Users, Video } from "~/components/icons";
import { type LeaderTools, leaderTools } from "~/components/leader/access";
import { Text } from "~/components/text";
import { Card, Chip, ClubMark, Divider, Press, SectionHeader, TARGET } from "~/components/ui";
import { config } from "~/lib/config";
import { eastern, easternDateKey, toInstant } from "~/lib/eastern";
import { type HomeHero, applicationDue } from "~/lib/home-priority";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { CalendarEvent, HomeApplication, Me, Membership, StudentApplication, TaskNotification } from "~/lib/types";

export type Route = { pathname: string; params?: Record<string, string> };
const weekdayShort = eastern({ weekday: "short" });
const dayNumber = eastern({ day: "numeric" });
const asDate = (value: string | number | null | undefined) => typeof value === "number" ? (Number.isFinite(value) ? new Date(value) : null) : value;
const dueDateText = eastern({ weekday: "short", month: "short", day: "numeric" });
const clockText = eastern({ hour: "numeric", minute: "2-digit" });
const dueDate = (value: string | number | null | undefined) => dueDateText(asDate(value));
const clock = (value: string | number | null | undefined) => clockText(asDate(value));
const monthDay = eastern({ month: "short", day: "numeric" });
const isToday = (value: string | number | null | undefined, now: Date) => { const date = toInstant(value); return !!date && easternDateKey(date) === easternDateKey(now); };
const isTomorrow = (value: string | number | null | undefined, now: Date) => { const date = toInstant(value); return !!date && easternDateKey(date) === easternDateKey(+now + 86_400_000); };
/** "Today, 4:30 PM", "Tomorrow, 9 AM" or "Mon, Nov 23, 7:00 PM" (Eastern, as the rest of the app). */
export function whenLabel(value: string | null | undefined, now: Date) {
  if (!toInstant(value)) return "";
  return `${isToday(value, now) ? "Today" : isTomorrow(value, now) ? "Tomorrow" : dueDate(value)}, ${clock(value)}`;
}

/** A section title with its "See all" style link on the right (orange, as in the mockups). */
function Heading({ title, action, onAction, testID, right }: { title: string; action?: string; onAction?: () => void; testID?: string; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <SectionHeader title={title} action={action && onAction ? (
      <Press testID={testID} onPress={onAction} accessibilityLabel={`${action}, ${title}`} hitSlop={8} style={{ minHeight: TARGET, justifyContent: "center", paddingLeft: 12 }}>
        <Text variant="bodyStrong" color={colors.brandInk}>{action}</Text>
      </Press>
    ) : right} />
  );
}

// ---- Hero ---------------------------------------------------------------------------------------

/**
 * The one thing that needs the person most, in a card drawn in the opposite scheme (cream on the dark
 * app, navy on the light one) so it stands out from everything under it.
 */
export function HomeHeroCard({ hero, now, onOpen, eventRoute, eventAction, taskRoute }: {
  hero: HomeHero; now: Date; onOpen: (route: Route) => void;
  eventRoute: (event: CalendarEvent) => Route; eventAction: (route: Route) => string; taskRoute: (task: TaskNotification) => Route;
}) {
  const { dark, radius } = useTheme();
  const inverse = resolveTheme(dark ? "light" : "dark").colors;
  const accent = inverse.brandInk;
  let eyebrow = "", corner = "", title = "", detail = "", segments: { done: number; total: number } | null = null;
  let primary: { label: string; route: Route }, secondary: { label: string; route: Route } | null = null;
  if (hero.kind === "application") {
    const { application, detail: full } = hero;
    const due = applicationDue(application, full);
    eyebrow = `Due ${isToday(due, now) ? "today" : isTomorrow(due, now) ? "tomorrow" : dueDate(due)}`;
    corner = clock(due);
    title = `Finish your ${application.name} application`;
    const progress = full?.progress;
    if (progress && progress.total > 0) {
      const left = Math.max(0, progress.total - progress.completed);
      detail = progress.ready || !left ? "Everything's answered. Review it and submit." : `${left} of ${progress.total} ${progress.total === 1 ? "section" : "sections"} left`;
      segments = { done: Math.min(progress.completed, progress.total), total: progress.total };
    }
    primary = { label: "Continue", route: { pathname: "/application/[id]", params: { id: application.id } } };
    secondary = { label: "View club", route: { pathname: "/club/[id]", params: { id: application.clubId } } };
  } else if (hero.kind === "event") {
    const { event } = hero;
    const start = toInstant(event.startTime);
    const minutes = start ? Math.round((+start - +now) / 60_000) : NaN;
    eyebrow = !Number.isFinite(minutes) ? "Coming up" : minutes <= 0 ? "Happening now" : minutes < 60 ? `Starts in ${minutes} min` : "Today";
    corner = clock(event.startTime);
    title = event.title;
    detail = [event.location, event.club].filter(Boolean).join(" · ");
    const route = eventRoute(event);
    primary = { label: eventAction(route), route };
    if (route.pathname !== "/calendar") secondary = { label: "Calendar", route: { pathname: "/calendar" } };
  } else if (hero.kind === "task") {
    const { task } = hero;
    eyebrow = hero.overdue ? "Overdue" : isToday(hero.at, now) ? "Due today" : isTomorrow(hero.at, now) ? "Due tomorrow" : `Due ${dueDate(hero.at)}`;
    corner = clock(hero.at);
    title = task.title;
    detail = task.club;
    primary = { label: task.cta ?? "Open task", route: taskRoute(task) };
    secondary = { label: "All tasks", route: { pathname: "/tasks" } };
  } else {
    eyebrow = "Live now";
    title = hero.roundName ? `Voting is open: ${hero.roundName}` : "A voting room is open";
    detail = hero.clubName;
    primary = { label: "Join voting", route: { pathname: "/leader/[clubId]/voting", params: { clubId: hero.clubId } } };
    secondary = { label: "Leader tools", route: { pathname: "/leader/[clubId]", params: { clubId: hero.clubId } } };
  }
  return (
    <View testID="home-hero" accessibilityLabel={`${eyebrow}. ${title}${detail ? `. ${detail}` : ""}`}
      style={{ backgroundColor: inverse.card, borderRadius: radius.lg + 4, padding: 20, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: inverse.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text variant="eyebrow" color={accent} style={{ flex: 1 }} numberOfLines={1}>{eyebrow}</Text>
        {corner ? <Text variant="small" color={inverse.mutedForeground}>{corner}</Text> : null}
      </View>
      <View style={{ gap: 4 }}>
        <Text variant="title" color={inverse.foreground} numberOfLines={3}>{title}</Text>
        {detail ? <Text variant="body" color={inverse.mutedForeground} numberOfLines={2}>{detail}</Text> : null}
      </View>
      {segments ? <Progress done={segments.done} total={segments.total} filled={inverse.foreground} empty={inverse.border} /> : null}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <HeroButton testID="home-hero-primary" label={primary.label} onPress={() => onOpen(primary.route)} background={inverse.primary} color={inverse.primaryForeground} border={inverse.primary} grow />
        {secondary ? <HeroButton testID="home-hero-secondary" label={secondary.label} onPress={() => onOpen(secondary!.route)} background="transparent" color={inverse.foreground} border={inverse.border} /> : null}
      </View>
    </View>
  );
}

function HeroButton({ label, onPress, background, color, border, grow, testID }: { label: string; onPress: () => void; background: string; color: string; border: string; grow?: boolean; testID: string }) {
  const { radius } = useTheme();
  return (
    <Press testID={testID} onPress={onPress} accessibilityLabel={label}
      style={{ flexGrow: grow ? 1 : 0, minHeight: TARGET + 8, paddingHorizontal: 20, borderRadius: radius.full, backgroundColor: background, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center" }}>
      <Text variant="button" color={color} numberOfLines={1}>{label}</Text>
    </Press>
  );
}

/** One segment per section (up to eight); a longer form draws one continuous bar. */
function Progress({ done, total, filled, empty }: { done: number; total: number; filled: string; empty: string }) {
  const label = `${done} of ${total} sections done`;
  if (total > 8) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ height: 6, borderRadius: 3, backgroundColor: empty, overflow: "hidden" }}>
        <View style={{ width: `${Math.round(done / total * 100)}%`, height: 6, backgroundColor: filled }} />
      </View>
    );
  }
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} testID="home-hero-progress" style={{ flexDirection: "row", gap: 6 }}>
      {Array.from({ length: total }, (_, index) => <View key={index} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: index < done ? filled : empty }} />)}
    </View>
  );
}

// ---- Leading ------------------------------------------------------------------------------------

/** leader.overview (view "recruiting"), the parts Home reads. Same query as the Applicants screen, so they share the cache. */
export type LeaderOverview = { operations: {
  rounds?: { count: number; pending: number }[];
  bookings?: { id: string; candidate: string; slot: { startTime: string; location: string | null } }[];
  votes?: { id: string; state: string; joinOpenedAt: string | null; round: { name: string } | null }[];
} | null };
type PipelinePage = { applications: { studentId: string; student: { studentProfile: { firstName: string; lastName: string } | null } }[]; page: { total: number } };
type Announcement = { id: string; publishedAt: string | null; _count?: { notifications: number } };

/** The voting state a leader would want to see first: a room open now, then paused, then a waiting room, then results to publish. */
export function votingStatus(votes: NonNullable<LeaderOverview["operations"]>["votes"]) {
  const list = votes ?? [];
  const pick = (state: string) => list.find(vote => vote.state === state);
  const named = (vote: { round: { name: string } | null }, text: string) => vote.round?.name ? `${vote.round.name}: ${text}` : text[0]!.toUpperCase() + text.slice(1);
  const open = pick("OPEN");
  if (open) return { text: named(open, "voting is open now"), live: true, sessionId: open.id, roundName: open.round?.name ?? null };
  const paused = pick("PAUSED");
  if (paused) return { text: named(paused, "voting is paused"), live: false };
  const waiting = list.find(vote => vote.state === "DRAFT" && vote.joinOpenedAt);
  if (waiting) return { text: named(waiting, "waiting room is open"), live: false };
  const draft = pick("DRAFT");
  if (draft) return { text: named(draft, "session set up, not started"), live: false };
  const done = pick("COMPLETED");
  if (done) return { text: named(done, "results waiting to be published"), live: false };
  return { text: "No voting session open", live: false };
}

/** Each club the person leads, with the four tools from the mockup and what's waiting in each. */
export function LeadingSection({ memberships, profile, overviews, now, onOpen }: { memberships: Membership[]; profile?: Me["profile"]; overviews: Record<string, LeaderOverview | undefined>; now: Date; onOpen: (route: Route) => void }) {
  return (
    <View style={{ gap: 18 }} testID="home-leading">
      {memberships.map(membership => (
        <LeadingClub key={membership.id} membership={membership} tools={leaderTools(membership, profile)} overview={overviews[membership.clubId]} now={now} onOpen={onOpen} />
      ))}
    </View>
  );
}

function LeadingClub({ membership, tools, overview, now, onOpen }: { membership: Membership; tools: LeaderTools; overview: LeaderOverview | undefined; now: Date; onOpen: (route: Route) => void }) {
  const { colors } = useTheme();
  const clubId = membership.clubId;
  const pipeline = useApiQuery<PipelinePage>("leader.pipelinePage", { clubId, query: { query: "" } }, { scope: "leader", enabled: tools.applicants, staleTime: 60_000 });
  const announcements = useApiQuery<Announcement[]>("leader.announcements", { clubId }, { scope: "leader", enabled: tools.announce, staleTime: 60_000 });
  const ops = overview?.operations ?? null;
  const pending = (ops?.rounds ?? []).reduce((sum, round) => sum + (Number.isSafeInteger(round.pending) && round.pending > 0 ? round.pending : 0), 0);
  const people = (pipeline.data?.applications ?? []).filter(app => app.student.studentProfile && !app.studentId.startsWith("anonymous-")).slice(0, 3).map(app => app.student.studentProfile!);
  const total = pipeline.data?.page.total ?? (ops?.rounds ?? []).reduce((sum, round) => sum + (Number(round.count) || 0), 0);
  const others = Math.max(0, total - people.length);
  const names = people.length ? `${people.slice(0, 2).map(person => person.firstName).join(", ")}${others ? ` and ${others} ${others === 1 ? "other" : "others"}` : ""}` : total ? `${total} ${total === 1 ? "applicant" : "applicants"}` : "No applicants yet";
  const booking = ops?.bookings?.[0];
  const voting = votingStatus(ops?.votes);
  const last = announcements.data?.[0];
  const go = (pathname: string) => onOpen({ pathname, params: { clubId } });
  const rows: { key: keyof LeaderTools; icon: IconComponent; title: string; detail: ReactNode; label: string; badge?: string; path: string }[] = [];
  if (tools.applicants) rows.push({ key: "applicants", icon: Users, title: "Applicants", label: names, badge: pending ? `${pending} to review` : undefined, path: "/leader/[clubId]/applicants",
    detail: <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{people.length ? <Avatars people={people} /> : null}<Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>{names}</Text></View> });
  if (tools.interviews) {
    const text = booking ? `Next: ${booking.candidate} · ${whenLabel(booking.slot.startTime, now)}` : "No interviews this week";
    rows.push({ key: "interviews", icon: Video, title: "Interviews", label: text, path: "/leader/[clubId]/interviews", detail: <Text variant="small" numberOfLines={1}>{text}</Text> });
  }
  if (tools.voting) rows.push({ key: "voting", icon: Gavel, title: "Voting", label: voting.text, path: "/leader/[clubId]/voting", detail: <Text variant={voting.live ? "smallStrong" : "small"} color={voting.live ? colors.brandInk : undefined} numberOfLines={1}>{voting.text}</Text> });
  if (tools.announce) {
    const sent = last?.publishedAt ? `Last sent ${monthDay(last.publishedAt)}${last._count ? ` · ${last._count.notifications} ${last._count.notifications === 1 ? "person" : "people"}` : ""}` : announcements.isPending ? " " : "Nothing sent yet";
    rows.push({ key: "announce", icon: Megaphone, title: "Announcements", label: sent, path: "/leader/[clubId]/announce", detail: <Text variant="small" numberOfLines={1}>{sent}</Text> });
  }
  return (
    <View style={{ gap: 10 }}>
      <Heading title="Leading" right={
        <Press testID={`home-leading-club-${clubId}`} onPress={() => go("/leader/[clubId]")} accessibilityLabel={`Leader tools for ${membership.club.name}`} hitSlop={8} style={{ minHeight: TARGET, justifyContent: "center", paddingLeft: 12, maxWidth: "62%" }}>
          <Text variant="small" numberOfLines={1}>{membership.club.shortName || membership.club.name}</Text>
        </Press>
      } />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {rows.length ? rows.map((row, index) => (
          <View key={row.key}>
            {index ? <Divider /> : null}
            <Press large testID={`home-leading-${row.key}`} onPress={() => go(row.path)} accessibilityLabel={`${row.title}, ${row.label}${row.badge ? `, ${row.badge}` : ""}, ${membership.club.name}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: TARGET + 20, paddingVertical: 10 }}>
              <row.icon size={24} color={colors.mutedForeground} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="bodyStrong" numberOfLines={1}>{row.title}</Text>
                {row.detail}
              </View>
              {row.badge ? <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.brandSubtle }}><Text variant="smallStrong" color={colors.brandInk}>{row.badge}</Text></View> : null}
              <ChevronRight size={18} color={colors.mutedForeground} />
            </Press>
          </View>
        )) : (
          <Press large testID="home-leading-hub" onPress={() => go("/leader/[clubId]")} style={{ flexDirection: "row", alignItems: "center", minHeight: TARGET + 12, gap: 12 }}>
            <Text variant="bodyStrong" style={{ flex: 1 }}>Open leader tools</Text>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </Press>
        )}
      </Card>
    </View>
  );
}

const initials = (person: { firstName: string; lastName: string }) => `${Array.from(person.firstName.trim())[0] ?? ""}${Array.from(person.lastName.trim())[0] ?? ""}`.toUpperCase();
function Avatars({ people }: { people: { firstName: string; lastName: string }[] }) {
  const { colors } = useTheme();
  const fills = [colors.surfaceLilac, colors.surfaceSage, colors.surfaceWarm];
  return (
    <View accessible={false} style={{ flexDirection: "row" }}>
      {people.map((person, index) => (
        <View key={index} style={{ width: 28, height: 28, borderRadius: 14, marginLeft: index ? -8 : 0, backgroundColor: fills[index % 3], borderWidth: 2, borderColor: colors.card, alignItems: "center", justifyContent: "center" }}>
          <Text maxFontSizeMultiplier={1} variant="caption" color={colors.foreground} style={{ fontSize: 10, lineHeight: 12 }}>{initials(person)}</Text>
        </View>
      ))}
    </View>
  );
}

// ---- My Clubs -----------------------------------------------------------------------------------

/** A sideways row of club cards (banner, name, role and next meeting) and a last card to find more clubs. */
export function ClubCarousel({ memberships, agenda, now, onOpen }: { memberships: Membership[]; agenda: CalendarEvent[]; now: Date; onOpen: (route: Route) => void }) {
  const { colors, radius } = useTheme();
  const width = 252;
  return (
    <View style={{ gap: 10 }} testID="home-my-clubs">
      <Heading title="My Clubs" action={memberships.length ? "See all" : undefined} testID="home-clubs-all" onAction={() => onOpen({ pathname: "/my-clubs" })} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }} style={{ marginHorizontal: -4 }} contentInset={{ left: 4 }}>
        {memberships.map(membership => {
          const next = agenda.find(event => event.clubId === membership.clubId && event.type !== "Deadline" && +(toInstant(event.startTime) ?? 0) >= +now);
          const role = membership.alumniSince ? "Alumni" : membership.title || (leaderish(membership) ? "Leader" : "Member");
          const detail = next ? `${role} · ${whenLabel(next.startTime, now)}` : role;
          return (
            <Press key={membership.id} large testID={`home-club-${membership.clubId}`} onPress={() => onOpen({ pathname: "/my-club/[clubId]", params: { clubId: membership.clubId } })} accessibilityLabel={`${membership.club.name}, ${detail}`}
              style={{ width, borderRadius: radius.lg + 4, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" }}>
              <Banner membership={membership} height={112} />
              <View style={{ padding: 14, gap: 4 }}>
                <Text variant="bodyStrong" numberOfLines={1}>{membership.club.name}</Text>
                <Text variant="small" numberOfLines={1}>{detail}</Text>
              </View>
            </Press>
          );
        })}
        <Press large testID="home-find-clubs" onPress={() => onOpen({ pathname: "/explore" })} accessibilityLabel="Find clubs"
          style={{ width: memberships.length ? 150 : width, minHeight: 176, borderRadius: radius.lg + 4, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.border, alignItems: "center", justifyContent: "center", gap: 8, padding: 12 }}>
          <Plus size={24} color={colors.mutedForeground} />
          <Text variant="bodyStrong" color={colors.mutedForeground}>Find clubs</Text>
          {!memberships.length ? <Text variant="small" align="center">Clubs you join appear here.</Text> : null}
        </Press>
      </ScrollView>
    </View>
  );
}
const leaderish = (membership: Membership) => membership.isOwner || membership.permissions.length > 0;

/** The club's own banner; without one (or if it fails to load), its colour with its mark. */
function Banner({ membership, height }: { membership: Membership; height: number }) {
  const [failed, setFailed] = useState(false);
  const uri = clubImage(membership.club.bannerUrl, config.apiUrl);
  const color = /^#[0-9a-f]{3,8}$/i.test(membership.club.color ?? "") ? membership.club.color : "#142d4e";
  return (
    <View style={{ height, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      {uri && !failed ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} onError={() => setFailed(true)} accessible={false} />
        : <ClubMark name={membership.club.name} color={membership.club.color} logoUrl={membership.club.logoUrl} size={52} />}
    </View>
  );
}

// ---- Coming Up ----------------------------------------------------------------------------------

/** Date column (TODAY / MON and the day), title, time and place; a Leader tag on things the person runs. */
export function ComingUp({ events, now, onOpen, routeFor }: { events: CalendarEvent[]; now: Date; onOpen: (route: Route) => void; routeFor: (event: CalendarEvent) => Route }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10 }} testID="home-coming-up">
      <Heading title="Coming Up" action="Calendar" testID="home-calendar" onAction={() => onOpen({ pathname: "/calendar" })} />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {events.map((event, index) => {
          const today = isToday(event.startTime, now);
          const timeText = event.allDay ? "All day" : event.endTime && toInstant(event.endTime) && event.type !== "Deadline" ? `${clock(event.startTime)} – ${clock(event.endTime)}` : clock(event.startTime) || event.time;
          const detail = [timeText, event.location].filter(Boolean).join(" · ");
          const leader = event.id.startsWith("panel-");
          return (
            <View key={event.id}>
              {index ? <Divider /> : null}
              <Press large testID={`home-event-${index}`} onPress={() => onOpen(routeFor(event))} accessibilityLabel={`${today ? "Today" : dueDate(event.startTime)}, ${event.title}, ${detail}${leader ? ", you're running this" : ""}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: TARGET + 20, paddingVertical: 10 }}>
                <View style={{ width: 44, alignItems: "center" }}>
                  <Text variant="eyebrow" color={today ? colors.brandInk : colors.mutedForeground}>{today ? "Today" : weekdayShort(event.startTime)}</Text>
                  <Text variant="section" maxFontSizeMultiplier={1.3}>{dayNumber(event.startTime)}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong" numberOfLines={2}>{event.title}</Text>
                  {detail ? <Text variant="small" numberOfLines={1}>{detail}</Text> : null}
                </View>
                {leader ? <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}><Text variant="caption" color={colors.foreground}>Leader</Text></View> : null}
              </Press>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

// ---- Applications -------------------------------------------------------------------------------

/** "Draft · 3 of 5 sections · due Fri, Dec 4", or the status (and the next step when it waits on the person). */
export function applicationLine(application: HomeApplication, detail: StudentApplication | undefined) {
  if (application.draft) {
    if (application.intakeClosed || application.closed) return "Draft · Applications closed";
    const parts = ["Draft"];
    if (detail?.progress.total) parts.push(`${detail.progress.completed} of ${detail.progress.total} sections`);
    const due = applicationDue(application, detail);
    if (Number.isFinite(due)) parts.push(`due ${dueDate(due)}`);
    return parts.join(" · ");
  }
  return detail?.attention && detail.nextStep ? `${application.statusLabel} · ${detail.nextStep}` : application.statusLabel;
}

export function ApplicationsList({ applications, details, onOpen }: { applications: HomeApplication[]; details: Map<string, StudentApplication>; onOpen: (route: Route) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10 }} testID="home-applications">
      <Heading title="Applications" action="View all" testID="home-applications-all" onAction={() => onOpen({ pathname: "/applications" })} />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {applications.map((application, index) => {
          const line = applicationLine(application, details.get(application.id));
          return (
            <View key={application.id}>
              {index ? <Divider /> : null}
              <Press large testID={`home-application-${index}`} onPress={() => onOpen({ pathname: "/application/[id]", params: { id: application.id } })} accessibilityLabel={`${application.name}, ${line}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: TARGET + 20, paddingVertical: 10 }}>
                <ClubMark name={application.name} color={application.color} logoUrl={application.logoUrl} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong" numberOfLines={2}>{application.name}</Text>
                  <Text variant="small" numberOfLines={2}>{line}</Text>
                </View>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </Press>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

// ---- Tasks --------------------------------------------------------------------------------------

export function TasksList({ tasks, now, onOpen, routeFor }: { tasks: TaskNotification[]; now: Date; onOpen: (route: Route) => void; routeFor: (task: TaskNotification) => Route }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10 }} testID="home-tasks">
      <Heading title="Tasks" action="All tasks" testID="home-tasks-all" onAction={() => onOpen({ pathname: "/tasks" })} />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {tasks.map((task, index) => {
          const due = task.taskActivity?.dueAt;
          const detail = due && toInstant(due) ? `${task.club} · Due ${whenLabel(due, now)}` : task.club;
          return (
            <View key={task.id}>
              {index ? <Divider /> : null}
              <Press large testID={`home-task-${index}`} onPress={() => onOpen(routeFor(task))} accessibilityLabel={`${task.title}, ${detail}${task.read ? "" : ", new"}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: TARGET + 20, paddingVertical: 10 }}>
                <ClubMark name={task.club} color={task.color} logoUrl={task.logoUrl} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong" numberOfLines={2}>{task.title}</Text>
                  <Text variant="small" numberOfLines={1}>{detail}</Text>
                </View>
                {task.read ? <ChevronRight size={18} color={colors.mutedForeground} /> : <Chip label="New" tone="brand" />}
              </Press>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

