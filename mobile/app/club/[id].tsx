import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, BookmarkSimple, Check } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClubTile, DateTile, Display, Pill, PrimaryButton, SecondaryButton, SectionTitle, Surface } from "@/components/ui";
import { post, webUrl, type Club, type Following } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { font, hit, radius, space, text, useTheme } from "@/theme/tokens";

const deadline = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** A club's page, modeled on the web club profile. Applying opens the web application. */
export default function ClubPage() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useApi<{ club: Club }>(`/api/v1/clubs/${encodeURIComponent(id ?? "")}`);
  const following = useApi<Following>("/api/v1/following");
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (following.data) setSaved(following.data.items.some((i) => i.club.id === data?.club.id)); }, [following.data, data]);
  const club = data?.club;
  const toggle = async () => {
    if (!club) return;
    const next = !saved; setSaved(next);
    try { await post("/api/v1/following", { clubId: club.id, saved: next }); } catch { setSaved(!next); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
        <View style={[styles.banner, { height: 150 + insets.top }]}>
          {club?.bannerUrl
            ? <Image source={{ uri: club.bannerUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
            : <LinearGradient colors={["#1d3a58", "#3c5874", "#7f93a6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={hit(38)} style={[styles.back, { top: insets.top + space.sm }]}>
            <ArrowLeft size={18} color="#fff9f1" />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: space.xl }}>
          <View style={styles.tileWrap}><ClubTile name={club?.name ?? ""} logoText={club?.logoText} size={62} /></View>
          {error ? <Text accessibilityRole="alert" style={[text.body, { color: t.danger, marginTop: space.lg }]}>{error}</Text> : null}
          {club ? (
            <>
              <Display size="hero" style={{ marginTop: space.md }}>{club.name}</Display>
              {club.tagline || club.pitch ? <Text style={[text.body, { color: t.muted, marginTop: 4 }]}>{club.tagline || club.pitch}</Text> : null}
              {club.category ? <View style={{ marginTop: space.md }}><Pill label={club.category} /></View> : null}

              <Surface style={{ marginTop: space.lg }}>
                {(club.acceptanceRate != null || club.applicationDeadline) ? (
                  <View style={[styles.stats, { borderBottomColor: t.hairline }]}>
                    {club.acceptanceRate != null ? (
                      <View style={{ flex: 1 }}>
                        <Text style={[text.small, { color: t.muted }]}>Club acceptance</Text>
                        <Text style={[styles.stat, { color: t.ink }]}>{club.acceptanceRate}%</Text>
                        <Text style={[text.small, { fontSize: 11, color: t.faint }]}>Club-reported</Text>
                      </View>
                    ) : null}
                    {club.rounds?.length ? (
                      <View style={{ flex: 1 }}>
                        <Text style={[text.small, { color: t.muted }]}>Recruitment</Text>
                        <Text style={[styles.stat, { color: t.ink }]}>{club.rounds.length} {club.rounds.length === 1 ? "round" : "rounds"}</Text>
                        <Text style={[text.small, { fontSize: 11, color: t.faint }]}>{club.applicationAvailable ? "Accepting applications" : "Not open now"}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {club.applicationAvailable
                  ? <PrimaryButton label="Apply on OutClass" onPress={() => Linking.openURL(webUrl(`/club/${club.id}`))} />
                  : <Text style={[text.body, { color: t.muted, marginBottom: space.sm }]}>Applications aren’t open right now. Follow to hear when they are.</Text>}
                <View style={{ height: space.sm }} />
                <SecondaryButton label={saved ? "Following" : "Follow"} onPress={toggle}
                  icon={saved ? <Check size={16} color={t.ink} weight="bold" /> : <BookmarkSimple size={16} color={t.ink} />} />
                {club.applicationDeadline ? <Text style={[text.small, { color: t.muted, marginTop: space.md }]}>Application deadline: {deadline(club.applicationDeadline)} · Eastern Time</Text> : null}
              </Surface>

              {club.description ? (
                <>
                  <SectionTitle title="About" />
                  <Text style={[text.body, { color: t.inkSoft }]}>{club.description}</Text>
                </>
              ) : null}

              {club.rounds?.length ? (
                <>
                  <SectionTitle title="Recruitment" />
                  <Surface padded={false}>
                    {[...club.rounds].sort((a, b) => a.order - b.order).map((r, i) => (
                      <View key={r.id} style={[styles.round, i > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                        <View style={[styles.roundNo, { backgroundColor: t.scheme === "dark" ? t.raised : "#eceee9" }]}><Text style={[text.label, { color: t.inkSoft }]}>{i + 1}</Text></View>
                        <Text style={[text.bodyStrong, { color: t.ink }]}>{r.name}</Text>
                      </View>
                    ))}
                  </Surface>
                </>
              ) : null}

              {club.requirements?.length || club.testRequirement ? (
                <>
                  <SectionTitle title="Before you apply" />
                  {club.testRequirement ? <Text style={[text.body, { color: t.inkSoft, marginBottom: space.sm }]}>Standardized tests: {club.testRequirement}</Text> : null}
                  {club.requirements?.map((r) => (
                    <View key={r} style={styles.req}><Check size={15} color={t.success} weight="bold" /><Text style={[text.body, { color: t.inkSoft, flex: 1 }]}>{r}</Text></View>
                  ))}
                </>
              ) : null}

              {club.publicEvents?.length ? (
                <>
                  <SectionTitle title="Upcoming events" />
                  <Surface padded={false}>
                    {club.publicEvents.slice(0, 5).map((e, i) => (
                      <View key={e.id} style={[styles.round, i > 0 && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
                        <DateTile date={new Date(e.date)} size={42} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={[text.bodyStrong, { color: t.ink }]}>{e.title}</Text>
                          <Text numberOfLines={1} style={[text.small, { color: t.muted }]}>{e.location}</Text>
                        </View>
                      </View>
                    ))}
                  </Surface>
                </>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { overflow: "hidden" },
  back: { position: "absolute", left: space.lg, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,35,56,0.42)", borderWidth: 1, borderColor: "rgba(255,249,241,0.25)" },
  tileWrap: { marginTop: -31 },
  stats: { flexDirection: "row", gap: space.lg, paddingBottom: space.md, marginBottom: space.lg, borderBottomWidth: 1 },
  stat: { fontFamily: font.display, fontSize: 24, lineHeight: 29, marginVertical: 1 },
  round: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 11, minHeight: 52 },
  roundNo: { width: 26, height: 26, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  req: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", marginBottom: 6 },
});
