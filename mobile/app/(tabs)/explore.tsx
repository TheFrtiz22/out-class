import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BookmarkSimple, MagnifyingGlass, SlidersHorizontal } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/screen";
import { ClubTile, Display, Eyebrow, Pill, PrimaryButton, ScreenHeader, SecondaryButton, Segmented, Surface } from "@/components/ui";
import type { Club } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { font, radius, space, text, useTheme } from "@/theme/tokens";

type Segment = "clubs" | "corkboard";
const when = ["All events", "Today", "This week", "Weekend"] as const;
const deadline = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

/** Explore: clubs at UVA, and the Corkboard of campus events. */
export default function Explore() {
  const t = useTheme();
  const [segment, setSegment] = useState<Segment>("clubs");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<(typeof when)[number]>("All events");
  const { data, error, loading, refresh } = useApi<{ clubs: Club[] }>("/api/v1/clubs");
  const clubs = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (data?.clubs ?? [])
      .filter((c) => words.every((w) => `${c.name} ${c.category ?? ""} ${c.pitch ?? ""}`.toLowerCase().includes(w)))
      .sort((a, b) => Number(!!b.applicationAvailable) - Number(!!a.applicationAvailable));
  }, [data, query]);
  const open = clubs.filter((c) => c.applicationAvailable).length;

  return (
    <Screen refreshing={loading && !!data} onRefresh={refresh}>
      <ScreenHeader title={segment === "clubs" ? "Explore" : "Events"} subtitle={segment === "clubs" ? "Clubs at the University of Virginia." : "Events on Grounds."} />
      <Segmented value={segment} onChange={setSegment} options={[{ value: "clubs", label: "Clubs" }, { value: "corkboard", label: "Corkboard" }]} />

      {segment === "clubs" ? (
        <>
          <View style={styles.searchRow}>
            <View style={[styles.search, { backgroundColor: t.raised, borderColor: t.edge, boxShadow: t.shadowRaised }]}>
              <MagnifyingGlass size={19} color={t.muted} />
              <TextInput accessibilityLabel="Search clubs" placeholder="Search clubs…" placeholderTextColor={t.faint} value={query} onChangeText={setQuery} autoCorrect={false}
                style={[text.body, { flex: 1, color: t.ink, paddingVertical: 0 }]} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Filter" style={[styles.filter, { backgroundColor: t.raised, borderColor: t.edge, boxShadow: t.shadowRaised }]}>
              <SlidersHorizontal size={19} color={t.ink} />
            </Pressable>
          </View>
          {data ? <Text style={[text.small, { color: t.muted, marginBottom: space.lg }]}>{clubs.length} clubs · {open} accepting applications</Text> : null}
          {error ? <Text accessibilityRole="alert" style={[text.body, { color: t.danger, marginBottom: space.lg }]}>{error}</Text> : null}
          {data && clubs.length === 0 ? <Surface><Text style={[text.body, { color: t.muted }]}><Text style={[text.bodyStrong, { color: t.ink }]}>No clubs match. </Text>Try another name or category.</Text></Surface> : null}
          <View style={{ gap: space.lg }}>{clubs.map((c) => <ClubCard key={c.id} club={c} />)}</View>
        </>
      ) : (
        <>
          <View style={styles.whenRow}>
            {when.map((w) => {
              const on = w === range;
              return (
                <Pressable key={w} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setRange(w)}
                  style={[styles.when, on ? { backgroundColor: t.navy } : { backgroundColor: t.raised, borderColor: t.edge, borderWidth: 1, boxShadow: t.shadowRaised }]}>
                  <Text style={[text.label, { color: on ? "#fff9f1" : t.ink }]}>{w}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[text.small, { color: t.muted, marginBottom: space.lg }]}>Times shown in Eastern Time</Text>
          <Surface>
            <Display size="cardTitle">No upcoming campus events yet.</Display>
            <Text style={[text.body, { color: t.muted, marginTop: space.sm, marginBottom: space.xl }]}>Clubs haven’t published upcoming events. Browse clubs to see what they do.</Text>
            <SecondaryButton compact label="Explore clubs" onPress={() => setSegment("clubs")} />
          </Surface>
        </>
      )}
    </Screen>
  );
}

function ClubCard({ club }: { club: Club }) {
  const t = useTheme();
  const [saved, setSaved] = useState(false);
  return (
    <Surface padded={false} style={{ overflow: "hidden" }}>
      <View style={styles.banner}>
        {club.bannerUrl
          ? <Image source={{ uri: club.bannerUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          : <LinearGradient colors={["#1d3a58", "#3c5874", "#7f93a6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
        <LinearGradient colors={["rgba(14,35,56,0)", "rgba(14,35,56,0.35)"]} style={StyleSheet.absoluteFill} />
        <Pressable accessibilityRole="button" accessibilityLabel={saved ? "Unfollow" : "Follow"} onPress={() => setSaved(!saved)} style={styles.save}>
          <BookmarkSimple size={19} color="#fff9f1" weight={saved ? "fill" : "regular"} />
        </Pressable>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.tileWrap}><ClubTile name={club.name} logoText={club.logoText} size={64} /></View>
        <Display size="cardTitle" style={{ fontSize: 26, lineHeight: 30 }}>{club.name}</Display>
        {club.pitch ? <Text numberOfLines={2} style={[text.body, { color: t.muted, marginTop: space.sm }]}>{club.pitch}</Text> : null}
        {club.category ? <View style={{ marginTop: space.md }}><Pill label={club.category} /></View> : null}

        {(club.acceptanceRate != null || club.applicationAvailable) ? (
          <View style={[styles.stats, { borderColor: t.hairline }]}>
            {club.acceptanceRate != null ? (
              <View style={{ flex: 1 }}>
                <Text style={[text.small, { color: t.muted }]}>Club acceptance</Text>
                <Text style={[styles.stat, { color: t.ink }]}>{club.acceptanceRate}%</Text>
                <Text style={[text.small, { fontSize: 12, color: t.muted }]}>Club-reported</Text>
              </View>
            ) : null}
            {club.applicationAvailable ? (
              <View style={{ flex: 1 }}>
                <Text style={[text.small, { color: t.muted }]}>Applications</Text>
                <Text style={[styles.stat, { color: t.ink }]}>{club.applicationDeadline ? deadline(club.applicationDeadline) : "Open"}</Text>
                <Text style={[text.small, { fontSize: 12, color: t.muted }]}>{club.applicationDeadline ? "Deadline · Eastern" : `${club.rounds?.length ?? 1} rounds`}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ marginTop: space.xl }}>
          {club.applicationAvailable
            ? <PrimaryButton label="Apply" onPress={() => Linking.openURL(`https://out-class.net/club/${club.id}`)} />
            : <SecondaryButton label="View club" onPress={() => Linking.openURL(`https://out-class.net/club/${club.id}`)} />}
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", gap: space.md, marginTop: space.lg, marginBottom: space.md },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, height: 50, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg },
  filter: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  whenRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg, marginBottom: space.md },
  when: { paddingHorizontal: space.lg, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  banner: { height: 112 },
  save: { position: "absolute", top: 12, right: 12, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,35,56,0.38)", borderWidth: 1, borderColor: "rgba(255,249,241,0.22)" },
  cardBody: { paddingHorizontal: space.xl, paddingBottom: space.xl, paddingTop: 44 },
  tileWrap: { position: "absolute", top: -32, left: space.xl },
  stats: { flexDirection: "row", gap: space.lg, marginTop: space.xl, paddingTop: space.lg, borderTopWidth: 1 },
  stat: { fontFamily: font.display, fontSize: 28, lineHeight: 34, marginVertical: 2 },
});
