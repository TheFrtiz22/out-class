import { Image } from "expo-image";
import { ArrowUpRight, BellSimple, CircleHalf, IdentificationCard, SignOut } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/screen";
import { Display, Eyebrow, NavyPanel, SectionTitle, Surface } from "@/components/ui";
import type { Account } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useApi } from "@/lib/use-api";
import { font, space, text, useTheme } from "@/theme/tokens";

/** Profile: the student card, private counts, and account settings. */
export default function Profile() {
  const t = useTheme();
  const { data } = useApi<Account>("/api/v1/me");
  const p = data?.profile;
  const name = p ? `${p.firstName} ${p.lastName}` : data?.email ?? "";
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const applications = data?.applications.filter((a) => a.status !== "DRAFTING").length ?? 0;
  return (
    <Screen>
      <View style={{ height: space.xxl }} />
      <NavyPanel style={{ paddingVertical: space.xxl }}>
        <View style={styles.identity}>
          {p?.headshotUrl
            ? <Image source={{ uri: p.headshotUrl }} style={styles.headshot} accessibilityLabel="Your headshot" />
            : <View style={[styles.headshot, styles.initials]}><Text style={{ fontFamily: font.display, fontSize: 30, color: "#142d45" }}>{initials}</Text></View>}
          <View style={{ flex: 1 }}>
            <Eyebrow color="rgba(255,249,241,0.7)">University of Virginia</Eyebrow>
            <Display size="title" color="#fff9f1" style={{ marginTop: 4 }}>{name}</Display>
            {p ? <Text style={[text.body, { color: "rgba(255,249,241,0.75)" }]}>Class of {p.gradYear}</Text> : null}
          </View>
        </View>
        <View style={[styles.stats, { borderTopColor: "rgba(255,249,241,0.14)" }]}>
          <Stat value={data?.memberships.length ?? 0} label="Clubs" />
          <Stat value={applications} label="Applications" />
        </View>
        <Text style={[text.small, { color: "rgba(255,249,241,0.6)", marginTop: space.md }]}>Only you can see these counts.</Text>
      </NavyPanel>

      <SectionTitle title="Account" />
      <Surface padded={false}>
        <Row icon={<IdentificationCard size={22} color={t.ink} />} label="Edit profile and resume" detail="On out-class.net" trailing={<ArrowUpRight size={18} color={t.muted} />} onPress={() => Linking.openURL("https://out-class.net/profile")} />
        <Row icon={<BellSimple size={22} color={t.ink} />} label="Notifications" detail="Decisions, interviews and club messages" divider />
        <Row icon={<CircleHalf size={22} color={t.ink} />} label="Appearance" detail="Matches your phone’s light or dark setting" divider />
      </Surface>
      <Surface padded={false} style={{ marginTop: space.md }}>
        <Row icon={<SignOut size={22} color={t.danger} />} label="Sign out" color={t.danger} onPress={() => supabase.auth.signOut()} />
      </Surface>
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: font.display, fontSize: 34, lineHeight: 40, color: "#fff9f1" }}>{value}</Text>
      <Text style={[text.small, { color: "rgba(255,249,241,0.72)" }]}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, detail, trailing, onPress, divider, color }: { icon: ReactNode; label: string; detail?: string; trailing?: ReactNode; onPress?: () => void; divider?: boolean; color?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.row, divider && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyStrong, { color: color ?? t.ink }]}>{label}</Text>
        {detail ? <Text style={[text.small, { color: t.muted }]}>{detail}</Text> : null}
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: space.lg },
  headshot: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: "rgba(255,249,241,0.6)" },
  initials: { backgroundColor: "#fff9f1", alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", marginTop: space.xl, paddingTop: space.lg, borderTopWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 15 },
});
