import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header, useHeaderInset } from "~/components/header";
import { ExternalLink, Search, ShieldCheck } from "~/components/icons";
import { PrivateImage, photoParams } from "~/components/private-image";
import { Text } from "~/components/text";
import { Button, Card, Chip, ErrorState, Press, Skeleton, SkeletonRows, TARGET, statusTone } from "~/components/ui";
import { ApiError, api, errorMessage } from "~/lib/api";
import { openOnWeb } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { fonts, useTheme } from "~/lib/theme";

// leader.overview (view "recruiting"): the Recruiting overview's own per-round counts.
type RoundCount = { id: string; name: string; type: string; anonymous: boolean; count: number; pending: number; reviewed: number };
type Overview = { operations: { rounds: RoundCount[] } | null };
// leader.pipelinePage: one page of the Applicants list, already projected for this viewer (anonymous rounds carry the anonymous label as the name).
type Profile = { firstName: string; lastName: string; major?: string | null; academicYear?: string | null; headshotUrl?: string | null };
type Applicant = { id: string; studentId: string; roundId: string; status: string; student: { email: string; studentProfile: Profile | null }; roundScore: { average: number | null; submitted: number; required: number; provisional: boolean } | null };
type Cursor = { id: string; direction: "after" | "before" | "at"; scope: string };
type Page = {
  rounds: { id: string; name: string }[]; applications: Applicant[];
  page: { total: number; baseTotal: number; next: Cursor | null };
  profileFields: { major: boolean; academicYear: boolean; photo: boolean };
};

// lib/application-status.ts (the Applicants list's StatusPill uses these labels).
const statusLabels: Record<string, string> = { DRAFTING: "Draft", SUBMITTED: "Submitted", IN_REVIEW: "In review", INTERVIEWING: "Interview", ACCEPTED: "Accepted", REJECTED: "Not selected", WAITLISTED: "Waitlisted" };
const anonymous = (app: Applicant) => app.studentId.startsWith("anonymous-");
const applicantName = (app: Applicant) => app.student.studentProfile ? `${app.student.studentProfile.firstName} ${app.student.studentProfile.lastName}` : app.student.email;
const average = (value: number) => (Math.round(value * 10) / 10).toFixed(1);
function rating(app: Applicant) {
  const summary = app.roundScore;
  if (!summary) return "Rating hidden until you review";
  if (summary.average !== null) return `Rating ${average(summary.average)}`;
  return summary.required || summary.submitted ? `${summary.submitted}/${summary.required} reviews` : "Not scored yet";
}

/**
 * Applicant glance: read-only. Round counts are the Recruiting overview's own, the list is the
 * Applicants pipeline page with its server-side search and round filter, and each card opens the
 * applicant's review on the web. Nothing is counted or filtered on the phone.
 */
export default function Applicants() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const top = useHeaderInset();
  const insets = useSafeAreaInsets();
  const { colors, radius, text } = useTheme();
  const [roundId, setRoundId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [pulling, setPulling] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setQuery(typed.trim()), 350); return () => clearTimeout(timer); }, [typed]);

  const overview = useApiQuery<Overview>("leader.overview", { clubId, view: "recruiting" }, { scope: "leader", staleTime: 30_000 });
  const pipeline = useInfiniteQuery<Page, Error, { pages: Page[] }, unknown[], Cursor | null>({
    queryKey: ["leader", "leader.pipelinePage", clubId, roundId, query],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) => api.get<Page>("leader.pipelinePage", { clubId, query: { query, ...(roundId ? { roundId } : {}), ...(pageParam ? { cursor: pageParam } : {}) } }, { signal }),
    getNextPageParam: last => last.page.next,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
  const pages = pipeline.data?.pages ?? [];
  const first = pages[0];
  const applicants = pages.flatMap(page => page.applications);
  const roundCounts = overview.data?.operations?.rounds ?? [];
  const roundName = (id: string) => first?.rounds.find(round => round.id === id)?.name ?? "Round unavailable";
  const filtered = !!query || !!roundId;

  const chip = (id: string | null, label: string, count?: number) => {
    const selected = roundId === id;
    return (
      <Press key={id ?? "all"} testID={`applicants-round-${id ?? "all"}`} onPress={() => setRoundId(id)} accessibilityLabel={count === undefined ? label : `${label}, ${count}`} accessibilityState={{ selected }}
        style={{ minHeight: TARGET, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text variant="smallStrong" color={selected ? colors.primaryForeground : colors.foreground}>{label}</Text>
        {count === undefined ? null : <Text variant="small" color={selected ? colors.primaryForeground : colors.mutedForeground} style={{ fontVariant: ["tabular-nums"] }}>{count}</Text>}
      </Press>
    );
  };

  const header = (
    <View style={{ gap: 14, paddingBottom: 4 }}>
      <Text variant="title" accessibilityRole="header">Applicants</Text>
      {overview.isPending ? <View style={{ flexDirection: "row", gap: 10 }}><Skeleton width={104} height={64} radius={14} /><Skeleton width={104} height={64} radius={14} /><Skeleton width={104} height={64} radius={14} /></View>
        : roundCounts.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }} style={{ marginHorizontal: -16, paddingHorizontal: 16 }} testID="applicants-round-counts">
            {roundCounts.map(round => (
              <Card key={round.id} accessible accessibilityLabel={`${round.name}, ${round.count} applicant${round.count === 1 ? "" : "s"}`} style={{ minWidth: 132, gap: 2, paddingVertical: 12 }}>
                <Text variant="metric" style={{ fontSize: 26, lineHeight: 32 }}>{round.count}</Text>
                <Text variant="small" color={colors.foreground} numberOfLines={2}>{round.name}</Text>
                {round.anonymous ? <Text variant="caption">Anonymous review</Text> : null}
              </Card>
            ))}
          </ScrollView>
        ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, borderRadius: radius.full, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.card, paddingHorizontal: 14 }}>
        <Search size={18} color={colors.mutedForeground} />
        <TextInput testID="applicants-search" accessibilityLabel="Search applicants" placeholder="Name, anonymous ID, or major" placeholderTextColor={colors.mutedForeground} value={typed} onChangeText={setTyped}
          autoCapitalize="none" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" maxLength={200}
          style={{ flex: 1, minHeight: 46, fontFamily: fonts.sans, fontSize: Math.max(16, text.body), color: colors.foreground }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }} style={{ marginHorizontal: -16, paddingHorizontal: 16 }} accessibilityRole="tablist" accessibilityLabel="Round">
        {chip(null, "All rounds")}
        {(roundCounts.length ? roundCounts : first?.rounds ?? []).map(round => chip(round.id, round.name, "count" in round ? (round as RoundCount).count : undefined))}
      </ScrollView>
      {first ? <Text variant="small" testID="applicants-total" accessibilityLiveRegion="polite">{first.page.total} applicant{first.page.total === 1 ? "" : "s"}</Text> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        testID="applicants-screen"
        data={applicants}
        keyExtractor={app => app.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={pulling} tintColor={colors.mutedForeground} progressViewOffset={top} onRefresh={() => { setPulling(true); Promise.all([overview.refetch(), pipeline.refetch()]).finally(() => setPulling(false)); }} />}
        onEndReachedThreshold={0.6}
        onEndReached={() => { if (pipeline.hasNextPage && !pipeline.isFetchingNextPage) pipeline.fetchNextPage(); }}
        ListEmptyComponent={pipeline.isPending ? <SkeletonRows count={5} /> : pipeline.isError ? (
          <Card><ErrorState offline={pipeline.error instanceof ApiError && pipeline.error.offline} message={errorMessage(pipeline.error)} onRetry={() => pipeline.refetch()} /></Card>
        ) : (
          <Card style={{ gap: 12, alignItems: "flex-start" }}>
            <Text variant="small" accessibilityRole="text">{first?.page.baseTotal ? "No applicants match these filters." : "No one has submitted an application yet. Student drafts stay private until they submit."}</Text>
            {first?.page.baseTotal && filtered ? <Button label="Clear filters" variant="secondary" size="compact" onPress={() => { setTyped(""); setQuery(""); setRoundId(null); }} /> : null}
          </Card>
        )}
        ListFooterComponent={pipeline.isFetchingNextPage ? <SkeletonRows count={2} /> : undefined}
        renderItem={({ item }) => {
          const name = applicantName(item), hidden = anonymous(item), profile = item.student.studentProfile, fields = first?.profileFields;
          const facts = [fields?.academicYear !== false ? profile?.academicYear : null, !hidden && fields?.major !== false ? profile?.major : null].filter(Boolean).join(" · ");
          return (
            <Press large testID={`applicant-${item.id}`} accessibilityRole="link" accessibilityLabel={`Open ${name}`} accessibilityHint="Opens on the web" onPress={() => { openOnWeb(`/club/${encodeURIComponent(clubId)}/workspace?section=recruitment&tool=applicants&applicantId=${encodeURIComponent(item.id)}`); }}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {/* A photo shows only when the server's projection carries one for this viewer; its address already holds the scope the server authorizes (club, application, mode). Kept in memory only. */}
                <View accessible={false} style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden", backgroundColor: colors.brandSubtle, alignItems: "center", justifyContent: "center" }}>
                  {hidden ? <ShieldCheck size={18} color={colors.brandInk} /> : (
                    <PrivateImage kind="profile-photos" params={fields?.photo !== false ? photoParams(profile?.headshotUrl) : null} style={{ width: 44, height: 44 }}
                      fallback={<Text maxFontSizeMultiplier={1} style={{ fontFamily: fonts.sansSemibold, fontSize: 15, lineHeight: 20, color: colors.brandInk }}>{name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</Text>} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="card" numberOfLines={1}>{name}</Text>
                  <Text variant="small" numberOfLines={1}>{hidden ? "Anonymous review" : facts || item.student.email}</Text>
                  <Text variant="caption" numberOfLines={2}>{roundName(item.roundId)} · {rating(item)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <Chip label={statusLabels[item.status] ?? item.status} tone={statusTone(item.status)} />
                  <ExternalLink size={16} color={colors.mutedForeground} />
                </View>
              </Card>
            </Press>
          );
        }}
      />
      <Header title="Applicants" back />
    </View>
  );
}
