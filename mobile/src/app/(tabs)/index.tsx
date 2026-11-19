import { useRouter } from "expo-router";
import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { ChevronRight, Compass, QrCode } from "~/components/icons";
import { useRefetchOnFocus } from "~/components/inbox/use-refetch-on-focus";
import { leaderMemberships } from "~/components/leader/access";
import { Text } from "~/components/text";
import { Button, Card, Chip, ClubMark, Divider, EmptyState, ErrorState, Row, ScreenScroll, SectionHeader, Skeleton, SkeletonRows, statusTone } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { easternShortDateTime } from "~/lib/eastern";
import { routeForHref } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { CalendarEvent, HomeView, Me, MyApplicationSummary, TaskNotification } from "~/lib/types";

const eventWhen = (event: CalendarEvent) => {
  const start = new Date(event.startTime);
  if (!Number.isFinite(start.getTime())) return event.time;
  return start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" }) + (event.allDay ? "" : ` · ${event.time}`);
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Route = { pathname: string; params?: Record<string, string> };

/** A task notification opens its own task when the server names the assignment, else the page its link names. */
function taskRoute(task: TaskNotification): Route {
  const assignmentId = task.taskActivity?.assignmentId;
  if (assignmentId && UUID.test(assignmentId)) return { pathname: "/task/[assignmentId]", params: { assignmentId, ...(UUID.test(task.clubId) ? { clubId: task.clubId } : {}) } };
  return routeForHref(task.taskHref) ?? { pathname: "/tasks" };
}
/** A meeting opens its agenda, a booked interview its application's interview screen; anything else the calendar. */
function eventRoute(event: CalendarEvent, applications: MyApplicationSummary[] = []): Route {
  if (event.id.startsWith("meeting-")) return { pathname: "/meeting/[id]", params: { id: event.id.slice(8) } };
  if (event.id.startsWith("booking-")) {
    const own = applications.filter(application => application.clubId === event.clubId);
    const application = own.find(item => item.status === "INTERVIEWING") ?? own[0];
    if (application) return { pathname: "/interview/[applicationId]", params: { applicationId: application.id } };
  }
  return { pathname: "/calendar" };
}
const taskDetail = (task: TaskNotification) => task.taskActivity?.dueAt ? `${task.club} · Due ${easternShortDateTime(task.taskActivity.dueAt)}` : task.club;

export default function Home() {
  const { colors } = useTheme();
  const router = useRouter();
  const top = useHeaderInset();
  const home = useApiQuery<HomeView>("home.view");
  useRefetchOnFocus(home);
  const me = useApiQuery<Me & { applications?: MyApplicationSummary[] }>("me", undefined, { staleTime: 5 * 60_000 });
  const data = home.data;
  const refresh = () => { home.refetch(); me.refetch(); };
  const next = data?.nextAction;
  const leading = leaderMemberships(me.data);
  const go = (route: Route) => router.push(route as never);

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll dock top={top} refreshing={home.isRefetching || me.isRefetching} onRefresh={refresh} testID="home-screen">
        <View style={{ gap: 4 }}>
          <Text variant="display" accessibilityRole="header">{me.data?.profile?.firstName ? `Hi, ${me.data.profile.firstName}` : "Home"}</Text>
        </View>

        {home.isPending ? (
          <>
            <Card style={{ gap: 10 }}><Skeleton width="40%" /><Skeleton width="80%" height={22} /><Skeleton width={120} height={44} radius={22} /></Card>
            <SkeletonRows count={3} />
          </>
        ) : home.isError && !data ? (
          <ErrorState message={errorMessage(home.error)} offline={home.error instanceof ApiError && home.error.offline} onRetry={refresh} />
        ) : data ? (
          <>
            {/* To-do: the one next step the web's Home picks (lib/student-home.ts nextHomeAction). */}
            <Card tone="brand" style={{ gap: 10 }} testID="home-next-action">
              <Text variant="eyebrow" color={colors.brandInk}>Next up</Text>
              {next?.kind === "application" ? (
                <>
                  <Text variant="section">Finish your {next.application.name} application</Text>
                  {next.application.deadline ? <Text variant="small" color={colors.foreground}>Due {eventWhen(next.application.deadline)}</Text> : null}
                  <Button label="Continue application" onPress={() => router.push({ pathname: "/application/[id]", params: { id: next.application.id } })} />
                </>
              ) : next?.kind === "event" ? (
                <>
                  <Text variant="section">{next.event.title}</Text>
                  <Text variant="small" color={colors.foreground}>{eventWhen(next.event)}{next.event.location ? ` · ${next.event.location}` : ""}</Text>
                  <Button label={next.event.id.startsWith("meeting-") ? "View meeting" : "View calendar"} onPress={() => go(eventRoute(next.event, me.data?.applications))} />
                </>
              ) : next?.kind === "notification" ? (
                <>
                  <Text variant="section">{next.notification.title}</Text>
                  <Text variant="small" color={colors.foreground} numberOfLines={2}>{next.notification.preview}</Text>
                  <Button label={next.notification.cta ?? "Open task"} onPress={() => go(taskRoute(next.notification))} />
                </>
              ) : (
                <>
                  <Text variant="section">Find your next club</Text>
                  <Button icon={Compass} label="Explore clubs" onPress={() => router.push("/explore")} />
                </>
              )}
            </Card>

            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              <Row testID="home-scan" leading={<QrCode size={24} color={colors.brandInk} />} title="Scan to check in" detail="Scan the code shown at a meeting" trailing={<ChevronRight size={18} color={colors.mutedForeground} />} onPress={() => router.push("/scan")} />
            </Card>

            {leading.length ? (
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {leading.map((membership, index) => (
                  <View key={membership.id}>
                    {index ? <Divider /> : null}
                    <Row testID="home-leader-tools" leading={<ClubMark name={membership.club.name} color={membership.club.color} logoUrl={membership.club.logoUrl} size={40} />} title="Leader tools" detail={membership.club.name} trailing={<ChevronRight size={18} color={colors.mutedForeground} />} onPress={() => router.push({ pathname: "/leader/[clubId]", params: { clubId: membership.clubId } })} />
                  </View>
                ))}
              </Card>
            ) : null}

            <View style={{ gap: 10 }}>
              <SectionHeader title="Tasks" action={data.tasks.length ? <Button variant="ghost" size="compact" label="All tasks" onPress={() => router.push("/tasks")} /> : undefined} />
              {data.tasks.length ? (
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  {data.tasks.slice(0, 3).map((task, index) => (
                    <View key={task.id}>
                      {index ? <Divider /> : null}
                      <Row leading={<ClubMark name={task.club} color={task.color} logoUrl={task.logoUrl} size={40} />} title={task.title} detail={taskDetail(task)} trailing={task.read ? <ChevronRight size={18} color={colors.mutedForeground} /> : <Chip label="New" tone="brand" />} onPress={() => go(taskRoute(task))} />
                    </View>
                  ))}
                </Card>
              ) : <Card><Text variant="small">No tasks right now.</Text></Card>}
            </View>

            <View style={{ gap: 10 }}>
              <SectionHeader title="Applications" action={<Button variant="ghost" size="compact" label="View all" onPress={() => router.push("/applications")} />} />
              {data.applications.length ? (
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  {data.applications.map((application, index) => (
                    <View key={application.id}>
                      {index ? <Divider /> : null}
                      <Row
                        testID={`home-application-${application.statusCode}`}
                        leading={<ClubMark name={application.name} color={application.color} logoUrl={application.logoUrl} size={40} />}
                        title={application.name}
                        detail={application.draft && application.intakeClosed ? "Applications closed" : undefined}
                        trailing={<Chip label={application.statusLabel} tone={statusTone(application.statusCode)} />}
                        accessibilityLabel={`${application.name}, ${application.statusLabel}`}
                        onPress={() => router.push({ pathname: "/application/[id]", params: { id: application.id } })}
                      />
                    </View>
                  ))}
                </Card>
              ) : <Card><EmptyState title="No applications yet" body="Clubs you apply to appear here." action={<Button icon={Compass} label="Explore clubs" onPress={() => router.push("/explore")} />} /></Card>}
            </View>

            <View style={{ gap: 10 }}>
              <SectionHeader title="My clubs" />
              {me.isPending ? <SkeletonRows count={1} /> : me.isError && !me.data ? (
                <Card style={{ gap: 8 }}><Text variant="small">{errorMessage(me.error, "Your clubs couldn’t load.")}</Text><Button variant="secondary" size="compact" label="Try again" onPress={() => me.refetch()} /></Card>
              ) : me.data?.memberships.length ? (
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  {me.data.memberships.map((membership, index) => (
                    <View key={membership.id}>
                      {index ? <Divider /> : null}
                      <Row leading={<ClubMark name={membership.club.name} color={membership.club.color} logoUrl={membership.club.logoUrl} size={40} />} title={membership.club.name} detail={membership.alumniSince ? "Alumni" : membership.title ?? undefined} trailing={<ChevronRight size={18} color={colors.mutedForeground} />} onPress={() => router.push({ pathname: "/my-club/[clubId]", params: { clubId: membership.clubId } })} />
                    </View>
                  ))}
                </Card>
              ) : <Card><Text variant="small">Clubs you join appear here. An acceptance doesn’t make you a member on its own.</Text></Card>}
            </View>

            <View style={{ gap: 10 }}>
              <SectionHeader title="Coming up" action={data.agendaCount ? <Button variant="ghost" size="compact" label="Calendar" onPress={() => router.push("/calendar")} /> : undefined} />
              {data.agenda.length ? (
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  {data.agenda.slice(0, 4).map((event, index) => (
                    <View key={event.id}>
                      {index ? <Divider /> : null}
                      <Row title={event.title} detail={`${eventWhen(event)} · ${event.club}`} trailing={<ChevronRight size={18} color={colors.mutedForeground} />} onPress={() => go(eventRoute(event, me.data?.applications))} />
                    </View>
                  ))}
                </Card>
              ) : <Card><Text variant="small">Nothing scheduled.</Text></Card>}
            </View>
          </>
        ) : null}
      </ScreenScroll>
      <Header title="Home" />
    </View>
  );
}
