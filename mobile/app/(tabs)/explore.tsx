import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { BookmarkSimple, MagnifyingGlass, MapPin, Users } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/screen";
import { ClubTile, DateTile, Display, Pill, PrimaryButton, ScreenHeader, SecondaryButton, Segmented, Surface } from "@/components/ui";
import { post, type Club, type CampusEvent, type Corkboard, type Following } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { font, hit, radius, space, text, useTheme } from "@/theme/tokens";

type Segment = "clubs" | "corkboard";
const periods = ["All", "Today", "This Week", "Weekend"] as const;
const periodLabel: Record<(typeof periods)[number], string> = { All: "All events", Today: "Today", "This Week": "This week", Weekend: "Weekend" };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
const when = (e: CampusEvent) => e.allDay ? new Date(e.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })
  : new Date(e.date).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** Explore: clubs at UVA, and the Corkboard of campus events. */
export default function Explore() {
  const t = useTheme();
  const [segment, setSegment] = useState<Segment>("clubs");
  return (
    <Screen>
      <ScreenHeader title={segment === "clubs" ? "Explore" : "Events"} subtitle={segment === "clubs" ? "Clubs at the University of Virginia." : "Events on Grounds."} />
      <Segmented value={segment} onChange={setSegment} options={[{ value: "clubs", label: "Clubs" }, { value: "corkboard", label: "Corkboard" }]} />
      {segment === "clubs" ? <Clubs /> : <Board onBrowse={() => setSegment("clubs")} />}
      <View style={{ height: space.sm }} />
      <Text style={[text.small, { color: t.faint, textAlign: "center", marginTop: space.lg }]}>Times shown in Eastern Time</Text>
    </Screen>
  );
}

function Clubs() {
  const t = useTheme();
  const [query, setQuery] = useState("");
  const { data, error } = useApi<{ clubs: Club[] }>("/api/v1/clubs");
  const following = useApi<Following>("/api/v1/following");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  useEffect(() => { if (following.data) setSaved(new Set(following.data.items.map((i) => i.club.id))); }, [following.data]);
  const toggle = async (clubId: string) => {
    const next = !saved.has(clubId);
    setSaved((s) => { const n = new Set(s); next ? n.add(clubId) : n.delete(clubId); return n; });
    try { await post("/api/v1/following", { clubId, saved: next }); }
    catch { setSaved((s) => { const n = new Set(s); next ? n.delete(clubId) : n.add(clubId); return n; }); }
  };
  const clubs = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (data?.clubs ?? [])
      .filter((c) => words.every((w) => `${c.name} ${c.category ?? ""} ${c.pitch ?? ""}`.toLowerCase().includes(w)))
      .sort((a, b) => Number(!!b.applicationAvailable) - Number(!!a.applicationAvailable));
  }, [data, query]);
  const open = clubs.filter((c) => c.applicationAvailable).length;

  return (
    <>
      <View style={[styles.search, { backgroundColor: t.raised, borderColor: t.edge, boxShadow: t.shadowRaised }]}>
        <MagnifyingGlass size={17} color={t.muted} />
        <TextInput accessibilityLabel="Search clubs" placeholder="Search clubs…" placeholderTextColor={t.faint} value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search"
          style={[text.body, { flex: 1, color: t.ink, paddingVertical: 0 }]} />
      </View>
      {data ? <Text style={[text.small, { color: t.muted, marginBottom: space.md }]}>{clubs.length} clubs · {open} accepting applications</Text> : null}
      {error ? <Text accessibilityRole="alert" style={[text.body, { color: t.danger, marginBottom: space.md }]}>{error}</Text> : null}
      {data && clubs.length === 0 ? <Surface><Text style={[text.body, { color: t.muted }]}><Text style={[text.bodyStrong, { color: t.ink }]}>No clubs match. </Text>Try another name or category.</Text></Surface> : null}
      <View style={{ gap: space.md }}>{clubs.map((c) => <ClubCard key={c.id} club={c} saved={saved.has(c.id)} onToggle={() => toggle(c.id)} />)}</View>
    </>
  );
}

function ClubCard({ club, saved, onToggle }: { club: Club; saved: boolean; onToggle: () => void }) {
  const t = useTheme();
  const open = () => router.push(`/club/${club.id}`);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={club.name} onPress={open}>
      <Surface padded={false} style={{ overflow: "hidden" }}>
        <View style={styles.banner}>
          {club.bannerUrl
            ? <Image source={{ uri: club.bannerUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
            : <LinearGradient colors={["#1d3a58", "#3c5874", "#7f93a6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
          <Pressable accessibilityRole="button" accessibilityLabel={saved ? `Unfollow ${club.name}` : `Follow ${club.name}`} accessibilityState={{ selected: saved }} onPress={onToggle} hitSlop={hit(34)} style={styles.save}>
            <BookmarkSimple size={16} color="#fff9f1" weight={saved ? "fill" : "regular"} />
          </Pressable>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.tileWrap}><ClubTile name={club.name} logoText={club.logoText} size={50} /></View>
          <Display size="cardTitle">{club.name}</Display>
          {club.pitch ? <Text numberOfLines={2} style={[text.body, { color: t.muted, marginTop: 4 }]}>{club.pitch}</Text> : null}
          <View style={styles.chips}>
            {club.category ? <Pill label={club.category} /> : null}
            {saved ? <Pill label="Following" tone="info" /> : null}
          </View>
          {(club.acceptanceRate != null || club.applicationAvailable) ? (
            <View style={[styles.stats, { borderColor: t.hairline }]}>
              {club.acceptanceRate != null ? (
                <View style={{ flex: 1 }}>
                  <Text style={[text.small, { color: t.muted }]}>Club acceptance</Text>
                  <Text style={[styles.stat, { color: t.ink }]}>{club.acceptanceRate}%</Text>
                  <Text style={[text.small, { fontSize: 11, color: t.faint }]}>Club-reported</Text>
                </View>
              ) : null}
              {club.applicationAvailable ? (
                <View style={{ flex: 1 }}>
                  <Text style={[text.small, { color: t.muted }]}>Applications</Text>
                  <Text style={[styles.stat, { color: t.ink }]}>{club.applicationDeadline ? shortDate(club.applicationDeadline) : "Open"}</Text>
                  <Text style={[text.small, { fontSize: 11, color: t.faint }]}>{club.applicationDeadline ? "Deadline" : `${club.rounds?.length ?? 1} rounds`}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={{ marginTop: space.lg }}>
            {club.applicationAvailable ? <PrimaryButton label="View and apply" onPress={open} /> : <SecondaryButton label="View club" onPress={open} />}
          </View>
        </View>
      </Surface>
    </Pressable>
  );
}

function Board({ onBrowse }: { onBrowse: () => void }) {
  const t = useTheme();
  const [period, setPeriod] = useState<(typeof periods)[number]>("All");
  const board = useApi<Corkboard>(`/api/v1/corkboard?period=${encodeURIComponent(period)}`);
  const [going, setGoing] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  useEffect(() => { if (board.data) { setGoing(new Set(board.data.going)); setSaved(new Set(board.data.saved)); } }, [board.data]);

  const rsvp = async (e: CampusEvent) => {
    setError("");
    try {
      const res = await post<{ ok: boolean; going?: boolean; count?: number; error?: string }>(`/api/v1/corkboard/${e.id}/rsvp`, { going: !going.has(e.id) });
      if (!res.ok) return setError(res.error ?? "We couldn’t update your RSVP.");
      setGoing((s) => { const n = new Set(s); res.going ? n.add(e.id) : n.delete(e.id); return n; });
      if (res.count != null) setCounts((c) => ({ ...c, [e.id]: res.count! }));
    } catch (err) { setError(err instanceof Error ? err.message : "We couldn’t update your RSVP."); }
  };
  const save = async (e: CampusEvent) => {
    const next = !saved.has(e.id);
    setSaved((s) => { const n = new Set(s); next ? n.add(e.id) : n.delete(e.id); return n; });
    try { await post(`/api/v1/corkboard/${e.id}/save`, { saved: next }); }
    catch { setSaved((s) => { const n = new Set(s); next ? n.delete(e.id) : n.add(e.id); return n; }); }
  };

  return (
    <>
      <View style={styles.whenRow}>
        {periods.map((p) => {
          const on = p === period;
          return (
            <Pressable key={p} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setPeriod(p)} hitSlop={hit(34)}
              style={[styles.when, on ? { backgroundColor: t.navy } : { backgroundColor: t.raised, borderColor: t.edge, borderWidth: 1, boxShadow: t.shadowRaised }]}>
              <Text style={[text.label, { color: on ? "#fff9f1" : t.ink }]}>{periodLabel[p]}</Text>
            </Pressable>
          );
        })}
      </View>
      {board.data ? <Text style={[text.small, { color: t.muted, marginBottom: space.md }]}>{board.data.total} {board.data.total === 1 ? "event" : "events"}</Text> : null}
      {board.error || error ? <Text accessibilityRole="alert" style={[text.body, { color: t.danger, marginBottom: space.md }]}>{board.error || error}</Text> : null}
      {board.data && board.data.events.length === 0 ? (
        <Surface>
          <Display size="cardTitle">No upcoming campus events yet.</Display>
          <Text style={[text.body, { color: t.muted, marginTop: 4, marginBottom: space.lg }]}>Clubs haven’t published upcoming events. Browse clubs to see what they do.</Text>
          <SecondaryButton compact label="Explore clubs" onPress={onBrowse} />
        </Surface>
      ) : null}
      <View style={{ gap: space.md }}>
        {board.data?.events.map((e) => {
          const isGoing = going.has(e.id); const count = counts[e.id] ?? e.rsvpCount;
          return (
            <Surface key={e.id} padded={false} style={{ overflow: "hidden" }}>
              {e.flyerUrl ? <Image source={{ uri: e.flyerUrl }} style={styles.flyer} contentFit="cover" accessibilityLabel={`${e.title} flyer`} /> : null}
              <View style={{ padding: space.lg }}>
                <View style={{ flexDirection: "row", gap: space.md }}>
                  <DateTile date={new Date(e.date)} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={[text.cardTitle, { color: t.ink }]}>{e.title}</Text>
                    <Text numberOfLines={1} style={[text.small, { color: t.muted, marginTop: 2 }]}>{when(e)} · {e.clubName}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={saved.has(e.id) ? "Unsave event" : "Save event"} onPress={() => save(e)} hitSlop={hit(28)} style={{ paddingTop: 2 }}>
                    <BookmarkSimple size={20} color={t.ink} weight={saved.has(e.id) ? "fill" : "regular"} />
                  </Pressable>
                </View>
                <View style={styles.eventMeta}>
                  {e.location ? <View style={styles.metaItem}><MapPin size={13} color={t.muted} /><Text numberOfLines={1} style={[text.small, { color: t.muted, flexShrink: 1 }]}>{e.location}</Text></View> : null}
                  {e.rsvpEnabled ? <View style={styles.metaItem}><Users size={13} color={t.muted} /><Text style={[text.small, { color: t.muted }]}>{count} going{e.capacity ? ` of ${e.capacity}` : ""}</Text></View> : null}
                </View>
                {e.rsvpEnabled ? (
                  <View style={{ marginTop: space.md }}>
                    {isGoing ? <SecondaryButton compact label="You’re going · Cancel" onPress={() => rsvp(e)} /> : <PrimaryButton label="RSVP" onPress={() => rsvp(e)} />}
                  </View>
                ) : null}
              </View>
            </Surface>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: space.sm, height: 44, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg, marginTop: space.md, marginBottom: space.sm },
  whenRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md, marginBottom: space.sm },
  when: { paddingHorizontal: space.md, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  banner: { height: 78 },
  save: { position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,35,56,0.38)", borderWidth: 1, borderColor: "rgba(255,249,241,0.22)" },
  cardBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, paddingTop: 34 },
  tileWrap: { position: "absolute", top: -25, left: space.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.sm },
  stats: { flexDirection: "row", gap: space.lg, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1 },
  stat: { fontFamily: font.display, fontSize: 22, lineHeight: 27, marginVertical: 1 },
  flyer: { width: "100%", aspectRatio: 16 / 9 },
  eventMeta: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.sm },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
});
