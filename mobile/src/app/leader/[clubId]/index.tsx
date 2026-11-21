import { useLocalSearchParams, useRouter } from "expo-router";
import { Fragment } from "react";
import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { CalendarDays, ChevronRight, ExternalLink, Gavel, Megaphone, QrCode, Users, Video } from "~/components/icons";
import type { IconComponent } from "~/components/icon-factory";
import { attendanceOpen, canAnnounceToApplicants, canOpenSettings, leaderTools } from "~/components/leader/access";
import { useRefetchOnReturn } from "~/components/leader/use-refetch-on-return";
import { Text } from "~/components/text";
import { Card, Chip, Divider, EmptyState, ErrorState, Row, ScreenScroll, SectionHeader, SkeletonRows } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { easternShortDateTime } from "~/lib/eastern";
import { openOnWeb } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { Me } from "~/lib/types";

export type LeaderMeeting = { id: string; clubId: string; title: string; date: string; endDate: string | null; location: string; audience: string };

export default function LeaderHub() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const top = useHeaderInset();
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  const membership = me.data?.memberships.find(item => item.clubId === clubId);
  const tools = membership ? leaderTools(membership, me.data?.profile) : null;
  const meetings = useApiQuery<LeaderMeeting[]>("meetings", { clubId }, { enabled: !!tools?.attendance, scope: "leader" });
  // Back from a tool: a meeting that opened for check-in meanwhile shows its Host button. (`refetch` ignores `enabled`.)
  useRefetchOnReturn(() => { if (tools?.attendance) void meetings.refetch(); });
  const now = Date.now();
  const open = (meetings.data ?? []).filter(meeting => attendanceOpen(meeting, now)).sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const upcoming = (meetings.data ?? []).filter(meeting => +new Date(meeting.date) > now && !attendanceOpen(meeting, now)).sort((a, b) => +new Date(a.date) - +new Date(b.date))[0];

  const tool = (Icon: IconComponent, title: string, detail: string, onPress: () => void, testID: string) => (
    <Row testID={testID} leading={<Icon size={24} color={colors.brandInk} />} title={title} detail={detail} trailing={<ChevronRight size={18} color={colors.mutedForeground} />} onPress={onPress} />
  );
  const run = tools ? ([
    ["voting", tools.voting && tool(Gavel, "Live voting", "Host or join a voting room", () => router.push({ pathname: "/leader/[clubId]/voting", params: { clubId } } as never), "leader-voting")],
    ["applicants", tools.applicants && tool(Users, "Applicants", "Pipeline counts and applicant cards", () => router.push({ pathname: "/leader/[clubId]/applicants", params: { clubId } } as never), "leader-applicants")],
    ["interviews", tools.interviews && tool(Video, "Interview day", "Your next interview, timer and notes", () => router.push({ pathname: "/leader/[clubId]/interviews", params: { clubId } } as never), "leader-interviews")],
    ["announce", tools.announce && tool(Megaphone, "Announce", membership && canAnnounceToApplicants(membership, me.data?.profile) ? "Send an update to members or applicants" : "Send an update to members", () => router.push({ pathname: "/leader/[clubId]/announce", params: { clubId } } as never), "leader-announce")],
  ] as const).filter(([, row]) => row) : [];
  const web = (label: string, href: string) => (
    <Row leading={<ExternalLink size={22} color={colors.mutedForeground} />} title={label} detail="Open on web" onPress={() => { openOnWeb(href); }} />
  );

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="leader-hub" onRefresh={() => Promise.all([me.refetch(), meetings.refetch()])}>
        <View style={{ gap: 4 }}>
          <Text variant="eyebrow">Leader tools</Text>
          <Text variant="title" accessibilityRole="header" numberOfLines={3}>{membership?.club.name ?? (me.isPending ? " " : "Club")}</Text>
        </View>
        {me.isPending ? <SkeletonRows count={3} avatar={false} /> : me.isError && !me.data ? (
          <Card><ErrorState message={errorMessage(me.error)} offline={me.error instanceof ApiError && me.error.offline} onRetry={() => me.refetch()} /></Card>
        ) : !membership || !tools || !Object.values(tools).some(Boolean) ? (
          <Card><EmptyState title="No leader tools here" body="Your role in this club doesn't include leader tools." /></Card>
        ) : (
          <>
            {tools.attendance ? (
              <View style={{ gap: 10 }}>
                <SectionHeader title="Check-in" />
                {meetings.isPending ? <SkeletonRows count={2} avatar={false} /> : meetings.isError && !meetings.data ? (
                  <ErrorState message={errorMessage(meetings.error)} offline={meetings.error instanceof ApiError && meetings.error.offline} onRetry={() => meetings.refetch()} />
                ) : open.length ? open.map(meeting => (
                  <Card key={meeting.id} style={{ gap: 10 }}>
                    <View style={{ gap: 2 }}>
                      <Text variant="card" numberOfLines={2}>{meeting.title}</Text>
                      <Text variant="small">{easternShortDateTime(meeting.date)}{meeting.location ? ` · ${meeting.location}` : ""}</Text>
                    </View>
                    <Chip label="Attendance open" tone="success" />
                    <Divider />
                    {tool(QrCode, "Host check-in", "Show the room's code on this phone", () => router.push({ pathname: "/leader/[clubId]/check-in/[meetingId]", params: { clubId, meetingId: meeting.id } } as never), "leader-host-check-in")}
                  </Card>
                )) : (
                  <Card padded={!upcoming} style={upcoming ? { paddingHorizontal: 16, paddingBottom: 12 } : { gap: 4 }}>
                    {upcoming ? (
                      <Row testID="leader-next-meeting" leading={<CalendarDays size={22} color={colors.brandInk} />} title={`Next: ${upcoming.title}`} detail={easternShortDateTime(upcoming.date)} trailing={<ChevronRight size={18} color={colors.mutedForeground} />}
                        onPress={() => router.push({ pathname: "/meeting/[id]", params: { id: upcoming.id } } as never)} />
                    ) : <Text variant="bodyStrong">No meeting is open for check-in</Text>}
                    <Text variant="small">Attendance opens one hour before a meeting and closes six hours after its end.</Text>
                  </Card>
                )}
              </View>
            ) : null}

            {/* Only the tools this role has, divided between them; a check-in-only role has no section at all. */}
            {run.length ? (
              <View style={{ gap: 10 }}>
                <SectionHeader title="Run the club" />
                <Card padded={false} style={{ paddingHorizontal: 16 }} testID="leader-run">
                  {run.map(([key, row], index) => <Fragment key={key}>{index ? <Divider /> : null}{row}</Fragment>)}
                </Card>
              </View>
            ) : null}

            <View style={{ gap: 10 }}>
              <SectionHeader title="On the web" />
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {web("Club workspace", `/club/${clubId}/workspace`)}
                <Divider />
                {canOpenSettings(membership, me.data?.profile) ? <>{web("Recruiting settings and application builder", `/club/${clubId}/workspace?section=settings`)}<Divider /></> : null}
                <Row leading={<CalendarDays size={22} color={colors.mutedForeground} />} title="Scheduling and panels" detail="Open on web" onPress={() => { openOnWeb(`/club/${clubId}/workspace?section=interviews`); }} />
              </Card>
            </View>
          </>
        )}
      </ScreenScroll>
      <Header title="Leader tools" back />
    </View>
  );
}
