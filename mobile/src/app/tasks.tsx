import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AlumniBanner } from "~/components/alumni-banner";
import { Header, useHeaderInset } from "~/components/header";
import { CalendarClock, FilePenLine } from "~/components/icons";
import { FilterChips } from "~/components/inbox/filter-chips";
import { isMissing, isSubmitted, matchesFilter, ownTasks, relativeDue, requirementsLabel, statusLabel, type TaskFilter, taskFilters, useTaskWorkspaces } from "~/components/tasks/presentation";
import { Text } from "~/components/text";
import { Button, Card, Chip, Divider, EmptyState, ErrorState, Press, ScreenScroll, SkeletonRows } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { ClubTask, Me, TaskAssignment } from "~/lib/types";

/** "Your tasks across clubs" (web: /clubs/tasks): every club's own tasks under one status filter. */
export default function Tasks() {
  const { colors } = useTheme();
  const router = useRouter();
  const top = useHeaderInset();
  const params = useLocalSearchParams<{ clubId?: string; taskId?: string }>();
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  // Alumni memberships stay on the roster without club access (lib/graduation.ts), so their task lists are not requested.
  const memberships = (me.data?.memberships ?? []).filter(membership => !membership.alumniSince && (!params.clubId || membership.clubId === params.clubId));
  // Opened from My club or a notification, the list is one club's: the title and a way out say so.
  const scoped = params.clubId ? me.data?.memberships.find(membership => membership.clubId === params.clubId)?.club : undefined;
  const showAll = () => router.setParams({ clubId: undefined, taskId: undefined });
  const workspaces = useTaskWorkspaces(memberships);
  const [filter, setFilter] = useState<TaskFilter>("open");
  const now = Date.now();
  const focused = useRef<string | null>(null);

  // Each club shows as its list arrives; only the memberships themselves hold the whole screen.
  const loading = me.isPending;
  const waiting = workspaces.some(query => query.isPending);
  const refresh = () => Promise.all([me.refetch(), ...workspaces.map(query => query.refetch())]);
  const clubs = memberships.map((membership, index) => {
    const all = ownTasks(workspaces[index]?.data);
    return { membership, query: workspaces[index], all, shown: all.filter(({ task, own }) => matchesFilter(task, own, filter, now)) };
  });
  const total = clubs.reduce((sum, club) => sum + club.all.length, 0);
  const shown = clubs.reduce((sum, club) => sum + club.shown.length, 0);
  // A failed refetch keeps the club's loaded tasks; only a club with nothing to show gets the error card.
  const failed = clubs.filter(club => club.query?.isError && !club.query.data);
  const outdated = (me.isError && !!me.data) || clubs.some(club => club.query?.isError && !!club.query.data);

  // A notification names its task (`taskId`); open that task once its club's list has loaded.
  const target = params.taskId ? clubs.flatMap(club => club.all).find(({ task }) => task.id === params.taskId) : undefined;
  useEffect(() => {
    if (!target || focused.current === target.task.id) return;
    focused.current = target.task.id;
    router.push({ pathname: "/task/[assignmentId]", params: { assignmentId: target.own.id, clubId: target.task.clubId } } as never);
  }, [target, router]);

  const open = (task: ClubTask, own: TaskAssignment) => router.push({ pathname: "/task/[assignmentId]", params: { assignmentId: own.id, clubId: task.clubId } } as never);

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} onRefresh={refresh} testID="tasks-screen">
        <AlumniBanner action="task" />
        {me.isError && !me.data ? (
          <ErrorState message={errorMessage(me.error)} offline={me.error instanceof ApiError && me.error.offline} onRetry={() => { void refresh(); }} />
        ) : loading ? (
          <SkeletonRows count={4} avatar={false} />
        ) : !memberships.length && params.clubId ? (
          <Card><EmptyState title="You’re not a member of this club" body="Tasks appear here for clubs you’re an active member of." action={<Button variant="secondary" testID="tasks-show-all" label="Show all clubs" onPress={showAll} />} /></Card>
        ) : !memberships.length ? (
          // "Leave to" Explore: back to the tabs already underneath, not a second tab bar on top of this screen.
          <Card><EmptyState title="You haven’t joined any clubs yet" body="Clubs appear here once you’re a member. An acceptance doesn’t make you a member on its own." action={<Button variant="secondary" testID="tasks-explore" label="Explore clubs" onPress={() => router.dismissTo("/explore")} />} /></Card>
        ) : (
          <>
            {outdated ? <Text variant="caption" accessibilityRole="alert" testID="tasks-refresh-failed">Couldn’t refresh your tasks. Showing what was last loaded.</Text> : null}
            {params.clubId ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text variant="small" style={{ flex: 1 }}>Showing {scoped?.name ?? "this club"} only.</Text>
                <Button variant="ghost" size="compact" testID="tasks-show-all" label="Show all clubs" onPress={showAll} />
              </View>
            ) : null}
            <FilterChips label="Status" testID="tasks-filter" value={filter} onChange={setFilter} options={taskFilters} />
            {failed.map(club => (
              <Card key={club.membership.clubId} style={{ gap: 8 }} accessibilityRole="alert">
                <Text variant="bodyStrong">{club.membership.club.name}</Text>
                <Text variant="small">{errorMessage(club.query!.error, "Could not load tasks.")}</Text>
                <Button variant="secondary" size="compact" label="Try again" onPress={() => club.query!.refetch()} />
              </Card>
            ))}
            {clubs.filter(club => club.shown.length || club.query?.isPending).map(club => (
              <View key={club.membership.clubId} style={{ gap: 10 }}>
                {memberships.length > 1 ? <Text variant="section" accessibilityRole="header">{club.membership.club.name}</Text> : null}
                {club.query?.isPending ? <View testID="tasks-club-loading"><SkeletonRows count={2} avatar={false} /></View> : <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  {club.shown.map(({ task, own }, index) => {
                    const status = statusLabel(task, own, now);
                    const tone = isSubmitted(own) ? "success" : isMissing(task, own, now) ? "error" : "neutral";
                    return (
                      <View key={task.id}>
                        {index ? <Divider /> : null}
                        <Press large testID={`task-row-${status.toLowerCase().replace(/\s+/g, "-")}`} onPress={() => open(task, own)} accessibilityLabel={`${task.title}. ${status}. Due ${relativeDue(task.dueAt, now)}`} style={{ flexDirection: "row", gap: 12, paddingVertical: 14, alignItems: "flex-start" }}>
                          <View style={{ marginTop: 2 }}><FilePenLine size={22} color={colors.brandInk} /></View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text variant="bodyStrong">{task.title}</Text>
                            <Text variant="small">{club.membership.club.name}{task.project ? ` · ${task.project.title}` : ""}{own.groupLabel ? ` · ${own.groupLabel}` : ""}</Text>
                            <Text variant="caption">{requirementsLabel(task)}</Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 2 }}>
                              <Chip label={status} tone={tone} />
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><CalendarClock size={14} color={colors.mutedForeground} /><Text variant="caption">{relativeDue(task.dueAt, now)}</Text></View>
                            </View>
                          </View>
                        </Press>
                      </View>
                    );
                  })}
                </Card>}
              </View>
            ))}
            {!shown && !failed.length && !waiting ? (
              <Card>
                <EmptyState
                  title={filter !== "open" ? "No tasks match your filters." : "You're all caught up."}
                  body={filter !== "open" ? "Try another status, or go back to active tasks." : total ? "No tasks need your attention. Choose All tasks under Status to see earlier work." : "New tasks will appear here."}
                  action={filter !== "open" ? <Button variant="secondary" label="Show active tasks" onPress={() => setFilter("open")} /> : total ? <Button variant="secondary" testID="tasks-view-all" label="View all tasks" onPress={() => setFilter("all")} /> : undefined}
                />
              </Card>
            ) : null}
          </>
        )}
      </ScreenScroll>
      <Header title={scoped ? `${scoped.shortName || scoped.name} tasks` : "Tasks"} back />
    </View>
  );
}
