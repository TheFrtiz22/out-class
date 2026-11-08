import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Title } from "@/components/ui";
import type { Account } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useApi } from "@/lib/use-api";
import { space, type, useTheme } from "@/theme/tokens";

/** Profile: who I am, my counts (visible only to me), and account actions. */
export default function Profile() {
  const t = useTheme();
  const { data } = useApi<Account>("/api/v1/me");
  const p = data?.profile;
  const name = p ? `${p.firstName} ${p.lastName}` : data?.email ?? "";
  const applications = data?.applications.filter((a) => a.status !== "DRAFTING").length ?? 0;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Title style={{ fontSize: 28 }}>{name}</Title>
            {p ? <Text style={[type.body, { color: t.mutedForeground }]}>Class of {p.gradYear}</Text> : null}
          </View>
          {p?.headshotUrl
            ? <Image accessibilityLabel="Your headshot" source={{ uri: p.headshotUrl }} style={styles.headshot} />
            : <View style={[styles.headshot, { backgroundColor: t.secondary }]} />}
        </View>
        <View style={styles.counts}>
          <Count value={data?.memberships.length ?? 0} label="Clubs" />
          <Count value={applications} label="Applications" />
        </View>
        <Card style={{ padding: space.lg, marginTop: space.xl, gap: space.md }}>
          <Text style={[type.body, { color: t.mutedForeground }]}>Edit your profile, resume and headshot at out-class.net. Editing in the app is coming.</Text>
          <Button label="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ marginRight: space.xl }}>
      <Text style={[type.title, { color: t.foreground }]}>{value}</Text>
      <Text style={[type.caption, { color: t.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.lg, marginTop: space.md },
  headshot: { width: 76, height: 76, borderRadius: 38 },
  counts: { flexDirection: "row", marginTop: space.xl },
});
