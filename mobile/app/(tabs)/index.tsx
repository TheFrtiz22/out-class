import { router } from "expo-router";
import { CheckCircle, CircleDashed, MapPin } from "phosphor-react-native";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/screen";
import { ClubTile, DateTile, Display, Eyebrow, NavyPanel, Pill, ScreenHeader, SectionTitle, Surface, TextLink } from "@/components/ui";
import { webUrl, type Account, type CalendarEvent, type TodoItem } from "@/lib/api";
import { applicationStatusLabel } from "@/lib/application-status";
import { useApi } from "@/lib/use-api";
import { space, text, useTheme } from "@/theme/tokens";

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const decidedStatuses = ["ACCEPTED", "REJECTED", "WAITLISTED"];
const stages = ["SUBMITTED", "IN_REVIEW", "INTERVIEWING"];
const stageIndex = (status: string) => (decidedStatuses.includes(status) ? 3 : Math.max(0, stages.indexOf(status)));
const due = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const time = (e: CalendarEvent) => e.allDay || !e.startTime ? "All day" : new Date(e.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** Home: To-do, what's coming up, where applications stand, and your clubs. */
export default function Home() {
  const t = useTheme();
  const me = useApi<Account>("/api/v1/me");
  const todo = useApi<{ items: TodoItem[] }>("/api/v1/todo");
  const calendar = useApi<{ events: CalendarEvent[] }>("/api/v1/calendar");
  const data = me.data;
  const name = data?.profile ? `${data.profile.firstName} ${data.profile.lastName}` : "";
  const active = (data?.applications ?? []).filter((a) => a.status !== "DRAFTING" && !decidedStatuses.includes(a.status));
  const decided = (data?.applications ?? []).filter((a) => decidedStatuses.includes(a.status));
  const featured = [...active].sort((a, b) => stageIndex(b.status) - stageIndex(a.status))[0];
  const tasks = (todo.data?.items ?? []).filter((i) => i.needsSubmission).slice(0, 4);
  const now = Date.now();
  const upcoming = (calendar.data?.events ?? []).filter((e) => new Date(e.startTime ?? `${e.date}T23:59:00-05:00`).getTime() >= now).slice(0, 3);
  const refresh = () => { me.refresh(); todo.refresh(); calendar.refresh(); };
  const subtitle = data ? `${active.length} ${active.length === 1 ? "application" : "applications"} in progress${tasks.length ? ` · ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} due` : ""}.` : undefined;

  return (
    <Screen refreshing={me.loading && !!data} onRefresh={refresh}>
      <ScreenHeader title={data?.profile ? `${greeting()}, ${data.profile.firstName}` : greeting()} subtitle={subtitle} accountName={name || undefined} />
      {me.error ? <Text accessibilityRole="alert" style={[text.body, { color: t.danger }]}>{me.error}</Text> : null}

      <SectionTitle title="To-do" />
      {tasks.length === 0 ? (
        <Surface>
          <Text style={[text.body, { color: t.muted }]}><Text style={[text.bodyStrong, { color: t.ink }]}>You’re clear for now. </Text>Club tasks and deadlines that need you will show up here.</Text>
        </Surface>
      ) : (
        <Surface padded={false}>
          {tasks.map((task, i) => (
            <Pressable key={task.id} accessibilityRole="button" onPress={() => task.href && Linking.openURL(webUrl(task.href))} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
              <View style={[styles.check, { borderColor: task.urgent ? t.accent : t.faint }]} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[text.bodyStrong, { color: t.ink }]}>{task.title}</Text>
                <Text numberOfLines={1} style={[text.small, { color: task.urgent ? t.accentInk : t.muted }]}>{task.club}{task.dueAt ? ` · Due ${due(task.dueAt)}` : ""}</Text>
              </View>
            </Pressable>
          ))}
        </Surface>
      )}

      {upcoming.length ? (
        <>
          <SectionTitle title="Coming up" action={<TextLink label="Calendar" onPress={() => router.navigate("/calendar")} />} />
          <Surface padded={false}>
            {upcoming.map((e, i) => (
              <View key={e.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                <DateTile date={new Date(e.startTime ?? `${e.date}T12:00:00-05:00`)} size={44} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[text.bodyStrong, { color: t.ink }]}>{e.title}</Text>
                  <Text numberOfLines={1} style={[text.small, { color: t.muted }]}>{time(e)} · {e.club}</Text>
                  {e.location ? <View style={styles.meta}><MapPin size={12} color={t.faint} /><Text numberOfLines={1} style={[text.small, { color: t.faint, flex: 1 }]}>{e.location}</Text></View> : null}
                </View>
              </View>
            ))}
          </Surface>
        </>
      ) : null}

      {featured ? (
        <>
          <SectionTitle title="Furthest along" />
          <NavyPanel style={{ padding: space.lg }}>
            <Eyebrow color="rgba(255,249,241,0.7)">Application status</Eyebrow>
            <Display size="cardTitle" color="#fff9f1" style={{ marginTop: 4 }}>{featured.club.name}</Display>
            <View style={[styles.divider, { backgroundColor: "rgba(255,249,241,0.14)" }]} />
            {["Application submitted", "Club review", "Interview", "Decision"].map((label, i) => {
              const at = stageIndex(featured.status);
              const done = i < at; const current = i === at;
              return (
                <View key={label} style={[styles.step, i > 0 && { borderTopWidth: 1, borderTopColor: "rgba(255,249,241,0.10)" }]}>
                  {done ? <CheckCircle size={21} color="#fff9f1" weight="light" />
                    : current ? <View style={styles.currentDot}><View style={styles.currentCore} /></View>
                    : <CircleDashed size={21} color="rgba(255,249,241,0.4)" weight="light" />}
                  <Text style={[current ? text.bodyStrong : text.body, { color: current ? "#fff9f1" : "rgba(255,249,241,0.72)" }]}>
                    {current && i === 1 ? "Club review in progress" : current && i === 2 ? "Interview stage" : label}
                  </Text>
                </View>
              );
            })}
          </NavyPanel>
        </>
      ) : null}

      <SectionTitle title="Applications" action={<TextLink label="Explore" onPress={() => router.navigate("/explore")} />} />
      {data && active.length + decided.length === 0 ? (
        <Surface><Text style={[text.body, { color: t.muted }]}><Text style={[text.bodyStrong, { color: t.ink }]}>Nothing submitted yet. </Text>Find clubs to apply to in Explore.</Text></Surface>
      ) : (
        <Surface padded={false}>
          {[...active, ...decided].map((a, i) => (
            <Pressable key={a.id} accessibilityRole="button" onPress={() => router.push(`/club/${a.club.id}`)} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
              <ClubTile name={a.club.name} size={38} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[text.bodyStrong, { color: t.ink }]}>{a.club.name}</Text>
                {a.submittedAt ? <Text style={[text.small, { color: t.muted }]}>Submitted {new Date(a.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text> : null}
              </View>
              <Pill label={applicationStatusLabel(a.status)} tone={a.status === "ACCEPTED" ? "success" : a.status === "INTERVIEWING" ? "accent" : "outline"} />
            </Pressable>
          ))}
        </Surface>
      )}

      <SectionTitle title="My clubs" />
      {data && data.memberships.length === 0 ? (
        <Surface><Text style={[text.body, { color: t.muted }]}>Clubs you join appear here, with their meetings and tasks.</Text></Surface>
      ) : (
        <View style={styles.grid}>
          {data?.memberships.map((m) => (
            <Pressable key={m.id} accessibilityRole="button" onPress={() => router.push(`/club/${m.club.id}`)} style={styles.tile}>
              <Surface style={{ padding: space.md }}>
                <ClubTile name={m.club.name} size={36} />
                <Text numberOfLines={2} style={[text.cardTitle, { fontSize: 17, lineHeight: 21, color: t.ink, marginTop: space.sm }]}>{m.club.name}</Text>
                <Text style={[text.small, { color: t.muted, marginTop: 2 }]}>{m.role === "MEMBER" ? "Member" : m.role.charAt(0) + m.role.slice(1).toLowerCase()}</Text>
              </Surface>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, marginVertical: space.md },
  step: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 10 },
  currentDot: { width: 21, height: 21, borderRadius: 11, backgroundColor: "#e8793e", alignItems: "center", justifyContent: "center" },
  currentCore: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff9f1" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 11, minHeight: 56 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { width: "48.5%", flexGrow: 1 },
});
