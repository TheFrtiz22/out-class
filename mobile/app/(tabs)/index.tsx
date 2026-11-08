import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, Chip, ClubMark, EmptyState, SectionHeader, Title } from "@/components/ui";
import type { Account } from "@/lib/api";
import { applicationStatusLabel } from "@/lib/application-status";
import { useApi } from "@/lib/use-api";
import { space, type, useTheme } from "@/theme/tokens";

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Home: my clubs, my applications and (next) the To-do list. Modeled on Canvas's dashboard. */
export default function Home() {
  const t = useTheme();
  const { data, error, loading, refresh } = useApi<Account>("/api/v1/me");
  const first = data?.profile?.firstName;
  const openApplications = data?.applications.filter((a) => a.status !== "DRAFTING") ?? [];
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} />}>
        <Title>{first ? `${greeting()}, ${first}` : greeting()}</Title>
        {error ? <Text accessibilityRole="alert" style={[type.body, { color: t.destructive, marginTop: space.md }]}>{error}</Text> : null}

        <SectionHeader title="My clubs" />
        {data && data.memberships.length === 0 ? <EmptyState title="No clubs yet" body="Clubs you join show up here." /> : null}
        <View style={styles.grid}>
          {data?.memberships.map((m) => (
            <Card key={m.id} style={styles.tile}>
              <View style={{ padding: space.md, gap: space.sm }}>
                <ClubMark name={m.club.name} logoUrl={m.club.logoUrl} color={m.club.color} size={40} />
                <Text numberOfLines={2} style={[type.headline, { color: t.foreground }]}>{m.club.name}</Text>
              </View>
            </Card>
          ))}
        </View>

        <SectionHeader title="Applications" subtitle="Where each application stands." />
        {data && openApplications.length === 0 ? <EmptyState title="No applications yet" body="Find clubs to apply to in Explore." /> : null}
        {openApplications.map((a) => (
          <Card key={a.id} style={{ marginBottom: space.sm }}>
            <View style={styles.row}>
              <Text style={[type.headline, { color: t.foreground, flex: 1 }]} numberOfLines={1}>{a.club.name}</Text>
              <Chip label={applicationStatusLabel(a.status)} tone={a.status === "ACCEPTED" ? "success" : "info"} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, paddingBottom: 120 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  tile: { width: "47%" },
  row: { flexDirection: "row", alignItems: "center", padding: space.lg, gap: space.md },
});
