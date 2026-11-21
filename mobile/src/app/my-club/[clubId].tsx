import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AlumniBanner } from "~/components/alumni-banner";
import { Header, useHeaderInset } from "~/components/header";
import { hasLeaderTools } from "~/components/leader/access";
import { CalendarDays, ChevronRight, FilePenLine } from "~/components/icons";
import { isMissing, isSubmitted, matchesFilter, ownTasks, relativeDue, statusLabel } from "~/components/tasks/presentation";
import { Text } from "~/components/text";
import { Button, Card, Chip, ClubMark, Divider, EmptyState, ErrorState, Press, ScreenScroll, SectionHeader, Segmented, Skeleton, SkeletonRows } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { easternDateTime, easternRange } from "~/lib/eastern";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { Me, Meeting, Membership, TaskWorkspace } from "~/lib/types";

// lib/copy/terms.ts `membershipRoleLabel`
const roleLabels: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", RECRUITING_ADMIN: "Recruiting Lead", INTERVIEWER: "Interviewer", MEMBER: "Member" };
const roleLabel = (member: Membership) => (member.isOwner ? roleLabels.OWNER! : roleLabels[member.accessRole] ?? roleLabels.MEMBER!);

/** A club the person belongs to, as a member sees it on the web: its meetings and their own tasks. */
export default function MyClub() {
  const { colors } = useTheme();
  const router = useRouter();
  const top = useHeaderInset();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  const member = me.data?.memberships.find(membership => membership.clubId === clubId);
  const meetings = useApiQuery<Meeting[]>("meetings", { clubId }, { enabled: !!clubId });
  const tasksEnabled = !!clubId && !!member && !member.alumniSince;
  const tasks = useApiQuery<TaskWorkspace>("tasks.workspace", { clubId }, { enabled: tasksEnabled });
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const now = Date.now();
  // `refetch` ignores `enabled`, so an alumni membership's task list is not asked for here either.
  const refresh = () => Promise.all([me.refetch(), clubId ? meetings.refetch() : null, tasksEnabled ? tasks.refetch() : null]);

  const upcoming = (meetings.data ?? []).filter(meeting => +new Date(meeting.endDate || meeting.date) >= now).sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const past = (meetings.data ?? []).filter(meeting => +new Date(meeting.endDate || meeting.date) < now);
  const list = (when === "upcoming" ? upcoming : past).slice(0, 20);
  const active = ownTasks(tasks.data).filter(({ task, own }) => matchesFilter(task, own, "open", now));
  const allTasks = ownTasks(tasks.data).length;

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} onRefresh={refresh} testID="my-club-screen">
        {me.isPending ? (
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}><Skeleton width={56} height={56} radius={14} /><View style={{ flex: 1, gap: 8 }}><Skeleton width="70%" height={24} /><Skeleton width="40%" /></View></View>
        ) : me.isError && !me.data ? (
          <ErrorState message={errorMessage(me.error)} offline={me.error instanceof ApiError && me.error.offline} onRetry={() => { void refresh(); }} />
        ) : !member ? (
          <Card><EmptyState title="You’re not a member of this club" body="Clubs appear here once you’re an active member. If you just accepted an offer, pull down to refresh." action={clubId ? <Button variant="secondary" label="View club page" onPress={() => router.replace({ pathname: "/club/[id]", params: { id: clubId } } as never)} /> : <Button variant="secondary" label="Explore clubs" onPress={() => router.dismissTo("/explore")} />} /></Card>
        ) : (
          <>
            {me.isError || (tasks.isError && tasks.data) || (meetings.isError && meetings.data) ? <Text variant="caption" accessibilityRole="alert" testID="my-club-refresh-failed">Couldn’t refresh this club. Showing what was last loaded.</Text> : null}
            <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
              <ClubMark name={member.club.name} color={member.club.color} logoUrl={member.club.logoUrl} size={56} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="title" accessibilityRole="header">{member.club.name}</Text>
                <Text variant="small">{member.alumniSince ? "Alumni" : roleLabel(member)}{member.title && member.title !== "Member" && member.title !== roleLabel(member) ? ` · ${member.title}` : ""}</Text>
              </View>
            </View>
            <AlumniBanner />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {/* The same gate as Home's leader rows; each tool is authorized again by the server. */}
              {hasLeaderTools(member, me.data?.profile) ? <Button size="compact" testID="my-club-leader-tools" label="Leader tools" onPress={() => router.push({ pathname: "/leader/[clubId]", params: { clubId: member.clubId } } as never)} /> : null}
              <Button variant="secondary" size="compact" testID="my-club-public" label="View club page" onPress={() => router.push({ pathname: "/club/[id]", params: { id: member.clubId } } as never)} />
            </View>

            <View style={{ gap: 10 }}>
              <SectionHeader title="Tasks" action={allTasks ? <Button variant="ghost" size="compact" testID="my-club-all-tasks" label="All tasks" onPress={() => router.push({ pathname: "/tasks", params: { clubId: member.clubId } })} /> : undefined} />
              {member.alumniSince ? <Card><Text variant="small">New tasks will appear here.</Text></Card> : tasks.isPending ? <SkeletonRows count={2} avatar={false} /> : tasks.isError && !tasks.data ? (
                <Card style={{ gap: 8 }} accessibilityRole="alert"><Text variant="small">{errorMessage(tasks.error, "Could not load tasks.")}</Text><Button variant="secondary" size="compact" label="Try again" onPress={() => tasks.refetch()} /></Card>
              ) : active.length ? (
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  {active.map(({ task, own }, index) => (
                    <View key={task.id}>
                      {index ? <Divider /> : null}
                      <Press large testID="my-club-task" onPress={() => router.push({ pathname: "/task/[assignmentId]", params: { assignmentId: own.id, clubId: task.clubId } } as never)} accessibilityLabel={`${task.title}. ${statusLabel(task, own, now)}. Due ${relativeDue(task.dueAt, now)}`} style={{ flexDirection: "row", gap: 12, paddingVertical: 14, alignItems: "center" }}>
                        <FilePenLine size={22} color={colors.brandInk} />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text variant="bodyStrong">{task.title}</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                            <Chip label={statusLabel(task, own, now)} tone={isSubmitted(own) ? "success" : isMissing(task, own, now) ? "error" : "neutral"} />
                            <Text variant="caption">{relativeDue(task.dueAt, now)}</Text>
                          </View>
                        </View>
                        <ChevronRight size={18} color={colors.mutedForeground} />
                      </Press>
                    </View>
                  ))}
                </Card>
              ) : <Card><Text variant="small">{allTasks ? "No tasks need your attention. You can still view earlier work." : "New tasks will appear here."}</Text></Card>}
            </View>

            <View style={{ gap: 10 }}>
              <SectionHeader title="Meetings" />
              <Segmented label="Meetings" value={when} onChange={setWhen} options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }]} />
              {meetings.isPending ? <SkeletonRows count={2} avatar={false} /> : meetings.isError && !meetings.data ? (
                <ErrorState message={errorMessage(meetings.error)} offline={meetings.error instanceof ApiError && meetings.error.offline} onRetry={() => meetings.refetch()} />
              ) : list.length ? (
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  {list.map((meeting, index) => (
                    <View key={meeting.id}>
                      {index ? <Divider /> : null}
                      <Press large testID="my-club-meeting" onPress={() => router.push({ pathname: "/meeting/[id]", params: { id: meeting.id } } as never)} accessibilityLabel={`${meeting.title}. ${easternDateTime(meeting.date)}. ${meeting.location}`} accessibilityHint="Open agenda, resources and attendance" style={{ flexDirection: "row", gap: 12, paddingVertical: 14, alignItems: "center" }}>
                        <CalendarDays size={22} color={colors.brandInk} />
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text variant="caption">{meeting.audience === "MEMBERS" ? "Members" : "Recruitment / Interest"}{meeting.recap?.trim() ? " · Recap available" : ""}</Text>
                          <Text variant="bodyStrong">{meeting.title}</Text>
                          <Text variant="small">{easternRange(meeting.date, meeting.endDate)}</Text>
                          <Text variant="small">{meeting.location}</Text>
                        </View>
                        <ChevronRight size={18} color={colors.mutedForeground} />
                      </Press>
                    </View>
                  ))}
                </Card>
              ) : <Card><Text variant="small">{when === "upcoming" ? "No upcoming meetings." : "No past meetings."}</Text></Card>}
            </View>
          </>
        )}
      </ScreenScroll>
      <Header title={member?.club.shortName || "My club"} back />
    </View>
  );
}
