import { useQueries } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, type ReactNode } from "react";
import { type ScrollViewInstance, View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { ApplicationsList, ClubCarousel, ComingUp, HomeHeroCard, type LeaderOverview, LeadingSection, TasksList, votingStatus } from "~/components/home/home-sections";
import { useRefetchOnFocus } from "~/components/inbox/use-refetch-on-focus";
import { leaderMemberships, leaderTools } from "~/components/leader/access";
import { Card, ErrorState, ScreenScroll, Skeleton, SkeletonRows, StaleNote } from "~/components/ui";
import { api, ApiError, errorMessage } from "~/lib/api";
import { headerGreeting, useNow } from "~/lib/greeting";
import { type HomeSectionId, type LeaderSignal, homeLayout, rankApplications, upcoming } from "~/lib/home-priority";
import { openRoute, routeForHref } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { useTabScrollToTop } from "~/lib/scroll-to-top";
import type { ApplicationsView, CalendarEvent, HomeView, Me, MyApplicationSummary, TaskNotification } from "~/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Route = { pathname: string; params?: Record<string, string> };

/** A task notification opens its own task when the server names the assignment, else the page its link names. */
function taskRoute(task: TaskNotification): Route {
  const assignmentId = task.taskActivity?.assignmentId;
  if (assignmentId && UUID.test(assignmentId)) return { pathname: "/task/[assignmentId]", params: { assignmentId, ...(UUID.test(task.clubId) ? { clubId: task.clubId } : {}) } };
  return routeForHref(task.taskHref) ?? { pathname: "/tasks" };
}
/**
 * A meeting (or a meeting the person checked in to) opens its agenda, a booked interview its application's
 * interview screen, a leader's panel slot the club's interview tools; anything else the calendar.
 */
function eventRoute(event: CalendarEvent, applications: MyApplicationSummary[] = []): Route {
  if (event.id.startsWith("meeting-")) return { pathname: "/meeting/[id]", params: { id: event.id.slice(8) } };
  if (event.meetingId) return { pathname: "/meeting/[id]", params: { id: event.meetingId } };
  if (event.id.startsWith("panel-")) return { pathname: "/leader/[clubId]/interviews", params: { clubId: event.clubId } };
  if (event.id.startsWith("booking-")) {
    const own = applications.filter(application => application.clubId === event.clubId);
    const application = own.find(item => item.status === "INTERVIEWING") ?? own[0];
    if (application) return { pathname: "/interview/[applicationId]", params: { applicationId: application.id } };
  }
  return { pathname: "/calendar" };
}
/** The button names where it goes. */
const eventActionLabel = (route: Route) => ({ "/meeting/[id]": "View meeting", "/interview/[applicationId]": "View interview", "/leader/[clubId]/interviews": "Open interview tools" } as Record<string, string>)[route.pathname] ?? "View calendar";

/**
 * Home, as in the owner's mockups: a greeting bar, a hero card only when something is pressing, then
 * the sections in the order lib/home-priority.ts works out (most pressing first; empty ones hide).
 */
export default function Home() {
  const router = useRouter();
  const top = useHeaderInset();
  const now = useNow();
  const home = useApiQuery<HomeView>("home.view");
  useRefetchOnFocus(home);
  const me = useApiQuery<Me & { applications?: MyApplicationSummary[] }>("me", undefined, { staleTime: 5 * 60_000 });
  // The same read as the Applications tab and the dock's middle tab (shared cache): draft progress and what waits on the person.
  const apps = useApiQuery<ApplicationsView>("applications.view", undefined, { staleTime: 60_000 });
  const data = home.data;
  const leading = leaderMemberships(me.data);
  // Each led club's recruiting overview (the Applicants screen's own query, so they share the cache).
  const overviews = useQueries({
    queries: leading.map(membership => ({
      queryKey: ["leader", "leader.overview", { clubId: membership.clubId, view: "recruiting" }],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.get<LeaderOverview>("leader.overview", { clubId: membership.clubId, view: "recruiting" }, { signal }),
      enabled: leaderTools(membership, me.data?.profile).applicants || leaderTools(membership, me.data?.profile).interviews || leaderTools(membership, me.data?.profile).voting,
      staleTime: 30_000,
    })),
  });
  const overviewByClub: Record<string, LeaderOverview | undefined> = {};
  leading.forEach((membership, index) => { overviewByClub[membership.clubId] = overviews[index]?.data; });
  const signals: LeaderSignal[] = leading.flatMap(membership => {
    const ops = overviewByClub[membership.clubId]?.operations;
    if (!ops) return [];
    const vote = votingStatus(ops.votes);
    return [{
      clubId: membership.clubId, clubName: membership.club.name,
      pendingReviews: (ops.rounds ?? []).reduce((sum, round) => sum + (Number.isSafeInteger(round.pending) && round.pending > 0 ? round.pending : 0), 0),
      nextInterviewAt: ops.bookings?.[0]?.slot.startTime ?? null,
      liveVote: vote.live && vote.sessionId ? { sessionId: vote.sessionId, roundName: vote.roundName ?? null } : null,
    }];
  });
  const refresh = () => Promise.all([home.refetch(), me.refetch(), apps.refetch(), ...overviews.map(query => query.refetch())]);
  // A row that leads to another tab (the calendar) switches to it rather than stacking a second set of tabs.
  const go = (route: Route) => openRoute(router, route);
  const scroll = useRef<ScrollViewInstance>(null);
  useTabScrollToTop(scroll);

  const details = new Map((apps.data?.applications ?? []).map(application => [application.id, application]));
  const layout = data ? homeLayout({ now, applications: data.applications, details: apps.data?.applications, agenda: data.agenda, tasks: data.tasks, leading: signals, leads: leading.length > 0 }) : null;
  const toEvent = (event: CalendarEvent) => eventRoute(event, me.data?.applications);
  const heroEvent = layout?.hero?.kind === "event" ? layout.hero.event.id : null;
  const sections: Record<HomeSectionId, () => ReactNode> = {
    myClubs: () => me.isError && !me.data ? null : <ClubCarousel memberships={me.data?.memberships ?? []} agenda={data?.agenda ?? []} now={now} onOpen={go} />,
    comingUp: () => <ComingUp events={upcoming(data?.agenda ?? [], now).filter(event => event.id !== heroEvent).slice(0, 3)} now={now} onOpen={go} routeFor={toEvent} />,
    applications: () => <ApplicationsList applications={rankApplications({ now, applications: data?.applications ?? [], details: apps.data?.applications }).slice(0, 3)} details={details} onOpen={go} />,
    leading: () => <LeadingSection memberships={leading} profile={me.data?.profile} overviews={overviewByClub} now={now} onOpen={go} />,
    tasks: () => <TasksList tasks={(data?.tasks ?? []).slice(0, 3)} now={now} onOpen={go} routeFor={taskRoute} />,
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll ref={scroll} dock top={top} onRefresh={refresh} testID="home-screen">
        {home.isPending ? (
          <>
            <Card style={{ gap: 10 }}><Skeleton width="40%" /><Skeleton width="80%" height={22} /><Skeleton width={120} height={44} radius={22} /></Card>
            <SkeletonRows count={3} />
          </>
        ) : home.isError && !data ? (
          <ErrorState message={errorMessage(home.error)} offline={home.error instanceof ApiError && home.error.offline} onRetry={refresh} />
        ) : data && layout ? (
          <>
            {home.isRefetchError ? <StaleNote /> : null}
            {layout.hero ? <HomeHeroCard hero={layout.hero} now={now} onOpen={go} eventRoute={toEvent} eventAction={eventActionLabel} taskRoute={taskRoute} /> : null}
            {layout.sections.map(id => <View key={id} testID={`home-section-${id}`}>{sections[id]()}</View>)}
          </>
        ) : null}
      </ScreenScroll>
      <Header root title={headerGreeting(now, me.data?.profile?.firstName)} />
    </View>
  );
}
