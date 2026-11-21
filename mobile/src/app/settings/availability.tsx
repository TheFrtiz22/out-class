import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AlumniBanner, useIsAlumni } from "~/components/alumni-banner";
import { AvailabilityEditor } from "~/components/availability/editor";
import { Header, useHeaderInset } from "~/components/header";
import { Check, ChevronDown } from "~/components/icons";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Card, Divider, ErrorState, Press, ScreenScroll, Skeleton, TARGET } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { readDocument, responseLabels, type AvailabilityDocument, type AvailabilityRound, type MyAvailability, type RoundAvailability } from "~/lib/availability";
import { haptics } from "~/lib/haptics";
import { openOnWeb } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";

const MINE = ["availability.mine", null] as const;
const GLOBAL_LABEL = "My global availability · all clubs";
const roundLabel = (round: AvailabilityRound) => `${round.clubName} · ${round.name} · ${responseLabels[round.response]}`;

function Loading({ label }: { label: string }) {
  return (
    <Card accessibilityLabel={label} accessibilityRole="progressbar" style={{ gap: 12 }}>
      <Skeleton width="50%" height={20} /><Skeleton width="90%" /><Skeleton width="100%" height={52} />
      {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} width="100%" height={TARGET} />)}
    </Card>
  );
}

/**
 * Settings → Availability (web: app/(workspace)/settings/availability, components/availability/my-availability.tsx):
 * the global weekly schedule shared by every club, and each requested round's own response.
 * The same endpoints and stored schedule as the web, so an edit on one shows on the other.
 */
export default function AvailabilitySettings() {
  const top = useHeaderInset();
  const { colors } = useTheme();
  const client = useQueryClient();
  const alumni = useIsAlumni();
  const params = useLocalSearchParams<{ roundId?: string }>();
  const query = useApiQuery<MyAvailability>("availability.mine");
  const rounds = query.data?.rounds ?? [];
  const [chosen, setChosen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [nonce, setNonce] = useState(0);
  // While a finger paints a range on the grid, the page holds still.
  const [painting, setPainting] = useState(false);
  const selectedId = chosen ?? (typeof params.roundId === "string" ? params.roundId : "");
  const round = rounds.find(item => item.id === selectedId);

  const reload = async () => { await query.refetch(); setNonce(value => value + 1); };
  const setRoundStatus = (id: string, confirmed: boolean, declined: boolean) => client.setQueryData<MyAvailability>(MINE, old => old && {
    ...old, rounds: old.rounds.map(item => item.id === id ? { ...item, confirmed, response: confirmed ? "SUBMITTED" : declined ? "DECLINED" : item.requested ? "AWAITING" : "NOT_REQUESTED" } : item),
  });

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="settings-availability-screen" keyboardShouldPersistTaps="handled" scrollEnabled={!painting}
        refreshing={query.isRefetching && !query.data} onRefresh={query.data ? undefined : () => { void query.refetch(); }}>
        <AlumniBanner action="availability" />
        {query.data ? (
          <>
            <View style={{ gap: 6 }}>
              <Text variant="smallStrong">Editing</Text>
              <Press testID="availability-round-picker" accessibilityRole="button" accessibilityLabel={`Choose an interview round. ${round ? roundLabel(round) : GLOBAL_LABEL}`}
                onPress={() => setPicking(true)}
                style={{ minHeight: TARGET + 4, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>{round ? roundLabel(round) : GLOBAL_LABEL}</Text>
                <ChevronDown size={18} color={colors.mutedForeground} />
              </Press>
              <Text variant="caption">{round ? "This response belongs only to this club and round. It does not change your global schedule." : "Save your usual week once. Round requests prefill this schedule and require a separate submission."}</Text>
              <Press testID="availability-view-interviews" accessibilityRole="link" accessibilityHint="Opens on the web" onPress={() => openOnWeb("/settings/interviews")} style={{ minHeight: TARGET, justifyContent: "center", alignSelf: "flex-start" }}>
                <Text variant="smallStrong" color={colors.brandInk} style={{ textDecorationLine: "underline" }}>View my published interviews</Text>
              </Press>
            </View>
            {round ? (
              <RoundEditor key={`${round.id}:${nonce}`} round={round} readOnly={alumni} onPaintingChange={setPainting} onStatus={(confirmed, declined) => setRoundStatus(round.id, confirmed, declined)} onReload={() => { void reload(); }} />
            ) : (
              <AvailabilityEditor key={`global:${nonce}`} initial={readDocument(query.data.document)} title="Your weekly rhythm" readOnly={alumni} onPaintingChange={setPainting}
                onSaved={saved => {
                  client.setQueryData<MyAvailability>(MINE, old => old && { ...old, document: saved });
                  // Each round's prefill comes from the global schedule.
                  void client.invalidateQueries({ queryKey: ["availability.round"], refetchType: "none" });
                }}
                onReload={() => { void reload(); }} />
            )}
          </>
        ) : query.isError ? (
          <Card><ErrorState message={errorMessage(query.error, "Couldn’t load your availability.")} offline={query.error instanceof ApiError && query.error.unreachable} onRetry={() => { void query.refetch(); }} /></Card>
        ) : <Loading label="Loading your availability…" />}
      </ScreenScroll>
      <Header title="Availability" back />
      <Sheet open={picking} onClose={() => setPicking(false)} title="Choose an interview round" testID="availability-round-sheet">
        <View>
          {[{ id: "", label: GLOBAL_LABEL }, ...rounds.map(item => ({ id: item.id, label: roundLabel(item) }))].map((option, index) => {
            const selected = option.id === (round?.id ?? "");
            return (
              <View key={option.id || "global"}>
                {index ? <Divider /> : null}
                <Press testID={`availability-round-${option.id || "global"}`} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={option.label}
                  onPress={() => { haptics.tick(); setChosen(option.id); setPicking(false); }}
                  style={{ minHeight: TARGET + 8, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
                  <Text variant={selected ? "bodyStrong" : "body"} style={{ flex: 1 }}>{option.label}</Text>
                  {selected ? <Check size={20} color={colors.primary} /> : null}
                </Press>
              </View>
            );
          })}
          {rounds.length ? null : <Text variant="caption" style={{ paddingTop: 8 }}>No club has asked for availability for an interview round yet.</Text>}
        </View>
      </Sheet>
    </View>
  );
}

function RoundEditor({ round, readOnly, onStatus, onReload, onPaintingChange }: { round: AvailabilityRound; readOnly: boolean; onStatus: (confirmed: boolean, declined: boolean) => void; onReload: () => void; onPaintingChange: (painting: boolean) => void }) {
  const client = useQueryClient();
  const input = { clubId: round.clubId, roundId: round.id };
  const query = useApiQuery<RoundAvailability>("availability.round", input, { staleTime: 0 });
  const key = ["availability.round", input];
  const patch = (change: Partial<RoundAvailability>) => client.setQueryData<RoundAvailability>(key, old => old && { ...old, ...change });
  if (query.data) {
    return (
      <AvailabilityEditor initial={readDocument(query.data.document)} scope={input} title={query.data.name} initialWeek={query.data.preferredWeek} readOnly={readOnly} onPaintingChange={onPaintingChange}
        initialStatus={{ confirmed: query.data.confirmed, declined: query.data.declined }}
        onSaved={(document: AvailabilityDocument) => patch({ document })}
        onStatus={status => { patch(status); onStatus(status.confirmed, status.declined); }}
        onReload={() => { void query.refetch().then(onReload); }} />
    );
  }
  if (query.isError) return <Card><ErrorState message={errorMessage(query.error, "Could not load this round.")} offline={query.error instanceof ApiError && query.error.unreachable} onRetry={() => { void query.refetch(); }} /></Card>;
  return <Loading label="Loading round availability…" />;
}
