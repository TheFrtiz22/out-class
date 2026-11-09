import { CheckCircle, CircleDashed } from "phosphor-react-native";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/screen";
import { ClubTile, Eyebrow, NavyPanel, Pill, ScreenHeader, SectionTitle, Surface, TextLink, Display } from "@/components/ui";
import type { Account } from "@/lib/api";
import { applicationStatusLabel } from "@/lib/application-status";
import { useApi } from "@/lib/use-api";
import { space, text, useTheme } from "@/theme/tokens";

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const stages = ["SUBMITTED", "IN_REVIEW", "INTERVIEWING", "DECIDED"] as const;
const stageIndex = (status: string) => (["ACCEPTED", "REJECTED", "WAITLISTED"].includes(status) ? 3 : Math.max(0, stages.indexOf(status as (typeof stages)[number])));

/** Home: what needs you, where applications stand, and your clubs. */
export default function Home() {
  const t = useTheme();
  const { data, error, loading, refresh } = useApi<Account>("/api/v1/me");
  const name = data?.profile ? `${data.profile.firstName} ${data.profile.lastName}` : "";
  const active = (data?.applications ?? []).filter((a) => !["DRAFTING", "ACCEPTED", "REJECTED", "WAITLISTED"].includes(a.status));
  const decided = (data?.applications ?? []).filter((a) => ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(a.status));
  const featured = [...active].sort((a, b) => stageIndex(b.status) - stageIndex(a.status))[0];
  const inFlight = active.length === 1 ? "1 application in progress." : `${active.length} applications in progress.`;

  return (
    <Screen refreshing={loading && !!data} onRefresh={refresh}>
      <ScreenHeader title={data?.profile ? `${greeting()},\n${data.profile.firstName}` : greeting()} subtitle={data ? inFlight : undefined} accountName={name || undefined} />
      {error ? <Text accessibilityRole="alert" style={[text.body, { color: t.danger }]}>{error}</Text> : null}

      <SectionTitle title="Needs you" />
      <Surface>
        <Text style={[text.body, { color: t.muted }]}>
          <Text style={[text.bodyStrong, { color: t.ink }]}>You’re clear for now. </Text>
          Deadlines, interview invitations and club tasks that need you will show up here.
        </Text>
      </Surface>

      {featured ? (
        <>
          <SectionTitle title="Furthest along" />
          <NavyPanel>
            <Eyebrow color="rgba(255,249,241,0.7)">Application status</Eyebrow>
            <Display size="cardTitle" color="#fff9f1" style={{ marginTop: space.sm }}>{featured.club.name}</Display>
            <View style={[styles.divider, { backgroundColor: "rgba(255,249,241,0.14)" }]} />
            {[
              ["Application submitted", 0],
              ["Club review", 1],
              ["Interview", 2],
              ["Decision", 3],
            ].map(([label, i]) => {
              const at = stageIndex(featured.status);
              const done = (i as number) < at; const current = i === at;
              return (
                <View key={label as string} style={[styles.step, (i as number) > 0 && { borderTopWidth: 1, borderTopColor: "rgba(255,249,241,0.10)" }]}>
                  {done ? <CheckCircle size={26} color="#fff9f1" weight="light" />
                    : current ? <View style={styles.currentDot}><View style={styles.currentCore} /></View>
                    : <CircleDashed size={26} color="rgba(255,249,241,0.4)" weight="light" />}
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
            <View key={a.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
              <ClubTile name={a.club.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[text.bodyStrong, { color: t.ink }]}>{a.club.name}</Text>
                {a.submittedAt ? <Text style={[text.small, { color: t.muted }]}>Submitted {new Date(a.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text> : null}
              </View>
              <Pill label={applicationStatusLabel(a.status)} tone={a.status === "ACCEPTED" ? "success" : a.status === "INTERVIEWING" ? "accent" : "outline"} />
            </View>
          ))}
        </Surface>
      )}

      <SectionTitle title="My clubs" />
      {data && data.memberships.length === 0 ? (
        <Surface><Text style={[text.body, { color: t.muted }]}>Clubs you join appear here, with their meetings and tasks.</Text></Surface>
      ) : (
        <View style={styles.grid}>
          {data?.memberships.map((m) => (
            <Surface key={m.id} style={styles.tile}>
              <ClubTile name={m.club.name} size={44} />
              <Text numberOfLines={2} style={[text.cardTitle, { fontSize: 19, lineHeight: 23, color: t.ink, marginTop: space.md }]}>{m.club.name}</Text>
              <Text style={[text.small, { color: t.muted, marginTop: 4 }]}>{m.role === "MEMBER" ? "Member" : m.role.charAt(0) + m.role.slice(1).toLowerCase()}</Text>
            </Surface>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, marginVertical: space.lg },
  step: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 13 },
  currentDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#e8793e", alignItems: "center", justifyContent: "center" },
  currentCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff9f1" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  tile: { width: "48%", flexGrow: 1, padding: space.lg },
});
