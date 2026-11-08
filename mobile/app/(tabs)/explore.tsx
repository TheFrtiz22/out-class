import { MagnifyingGlass } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, Chip, ClubMark, EmptyState, Title } from "@/components/ui";
import type { Club } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { radius, space, type, useTheme } from "@/theme/tokens";

type Segment = "clubs" | "corkboard";

/** Explore: club search (BigFuture College Search pattern) and, next, the Corkboard. */
export default function Explore() {
  const t = useTheme();
  const [segment, setSegment] = useState<Segment>("clubs");
  const [query, setQuery] = useState("");
  const { data, error, loading, refresh } = useApi<{ clubs: Club[] }>("/api/v1/clubs");
  const clubs = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (data?.clubs ?? []).filter((c) => words.every((w) => `${c.name} ${c.category ?? ""} ${c.pitch ?? ""}`.toLowerCase().includes(w)));
  }, [data, query]);

  const header = (
    <View>
      <Title>Explore</Title>
      <View style={[styles.segments, { backgroundColor: t.muted }]} accessibilityRole="tablist">
        {(["clubs", "corkboard"] as const).map((s) => (
          <Pressable key={s} accessibilityRole="tab" accessibilityState={{ selected: segment === s }} onPress={() => setSegment(s)} style={[styles.segment, segment === s && { backgroundColor: t.card }]}>
            <Text style={[type.headline, { color: segment === s ? t.foreground : t.mutedForeground }]}>{s === "clubs" ? "Clubs" : "Corkboard"}</Text>
          </Pressable>
        ))}
      </View>
      {segment === "clubs" && (
        <>
          <View style={[styles.search, { backgroundColor: t.card, borderColor: t.border }]}>
            <MagnifyingGlass size={20} color={t.mutedForeground} />
            <TextInput accessibilityLabel="Search clubs" placeholder="Search clubs" placeholderTextColor={t.input} value={query} onChangeText={setQuery} style={[type.body, { flex: 1, color: t.foreground }]} autoCorrect={false} />
          </View>
          {data ? <Text style={[type.body, { color: t.mutedForeground, marginBottom: space.md }]}><Text style={{ fontWeight: "700", color: t.foreground }}>{clubs.length}</Text> clubs</Text> : null}
          {error ? <Text accessibilityRole="alert" style={[type.body, { color: t.destructive, marginBottom: space.md }]}>{error}</Text> : null}
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.background }}>
      <FlatList
        data={segment === "clubs" ? clubs : []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.page}
        ListHeaderComponent={header}
        ListEmptyComponent={segment === "corkboard"
          ? <EmptyState title="Corkboard is coming next" body="Event flyers from every club will live here." />
          : data ? <EmptyState title="No clubs match" body="Try a different search." /> : undefined}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} />}
        renderItem={({ item }) => <ClubCard club={item} />}
      />
    </SafeAreaView>
  );
}

function ClubCard({ club }: { club: Club }) {
  const t = useTheme();
  return (
    <Card style={{ marginBottom: space.lg }}>
      {club.bannerUrl
        ? <Image accessibilityIgnoresInvertColors source={{ uri: club.bannerUrl }} style={styles.banner} resizeMode="cover" />
        : <View style={[styles.banner, { backgroundColor: club.color || t.secondary }]} />}
      <View style={styles.markWrap}><ClubMark name={club.name} logoUrl={club.logoUrl} color={club.color} size={56} /></View>
      <View style={styles.body}>
        <Text style={[type.title, { color: t.foreground }]}>{club.name}</Text>
        {club.category ? <Text style={[type.body, { color: t.mutedForeground, marginTop: 2 }]}>{club.category}</Text> : null}
        {club.pitch ? <Text numberOfLines={2} style={[type.body, { color: t.foreground, marginTop: space.sm }]}>{club.pitch}</Text> : null}
        <View style={styles.chips}>
          {club.applicationAvailable ? <Chip tone="brand" label={club.applicationDeadline ? `Applications due ${new Date(club.applicationDeadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "Applications open"} /> : null}
          {club.rounds && club.rounds.length > 0 ? <Chip label={`${club.rounds.length} rounds`} /> : null}
          {club.acceptanceRate != null ? <Chip label={`${club.acceptanceRate}% acceptance (self-reported)`} /> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, paddingBottom: 120 },
  segments: { flexDirection: "row", borderRadius: radius.pill, padding: 4, marginVertical: space.lg },
  segment: { flex: 1, alignItems: "center", paddingVertical: space.sm, borderRadius: radius.pill },
  search: { flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.md, marginBottom: space.md },
  banner: { height: 88 },
  markWrap: { position: "absolute", top: 56, left: space.lg },
  body: { padding: space.lg, paddingTop: space.xxl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
});
