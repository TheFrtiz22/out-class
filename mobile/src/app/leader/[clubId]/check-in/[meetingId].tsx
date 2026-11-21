import { useMutation, useQuery } from "@tanstack/react-query";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBrightnessBoost } from "~/lib/brightness";
import { X } from "~/components/icons";
import { QrCode } from "~/components/qr-code";
import { useConfirm } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, IconButton, Skeleton } from "~/components/ui";
import { api, ApiError, errorMessage } from "~/lib/api";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { LeaderMeeting } from "~/app/leader/[clubId]/index";

type Issued = { expiresAt: string; shortCode: string; shortUrl: string };
type Attendee = { id: string; checkedInAt: string; name: string };

/**
 * Check-in host mode: the room's rotating branded code, full screen, bright and awake, with a live
 * count. The code is the same first-party `/q` short link the web host shows (issueMeetingCheckIn);
 * a new one is issued before the last expires, and "Close check-in" revokes them all.
 */
export default function CheckInHost() {
  const { clubId, meetingId } = useLocalSearchParams<{ clubId: string; meetingId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const { confirm, sheet } = useConfirm();
  useKeepAwake();
  useBrightnessBoost();

  const leave = () => { if (router.canGoBack()) router.back(); else router.replace({ pathname: "/leader/[clubId]", params: { clubId } } as never); };
  const close = useMutation({
    mutationFn: () => api.post("meetings.checkIn.close", { clubId, meetingId }),
    onSuccess: () => { haptics.confirm(); leave(); },
    onError: () => haptics.error(),
  });
  const closing = close.isPending || close.isSuccess;

  const meetings = useApiQuery<LeaderMeeting[]>("meetings", { clubId }, { scope: "leader", staleTime: 60_000 });
  const meeting = meetings.data?.find(item => item.id === meetingId);
  // Rotation: each issue lives 90 s on the server; ask for the next one at 60 s, and every 5 s after a
  // failed refresh so a blip never leaves an expired code on screen for long. Nothing is issued while closing.
  const code = useQuery<Issued, Error>({
    queryKey: ["leader", "checkIn.issue", clubId, meetingId],
    queryFn: () => api.post<Issued>("meetings.checkIn.issue", { clubId, meetingId }),
    refetchInterval: query => query.state.status === "error" ? 5_000 : 60_000,
    staleTime: 0, gcTime: 0, retry: 1, enabled: !closing,
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 2_000); return () => clearInterval(timer); }, []);
  // A code past its 90 s life no longer checks anyone in: never leave it up while the next one is on its way.
  // Timed from when this phone received it, so a phone clock that is off can't hide a live code.
  const expired = !!code.data && now - code.dataUpdatedAt >= 85_000;
  const attendance = useQuery<Attendee[], Error>({
    queryKey: ["leader", "meetings.attendance", clubId, meetingId],
    queryFn: () => api.get<Attendee[]>("meetings.attendance", { clubId, meetingId }),
    refetchInterval: 4_000, gcTime: 0,
  });
  const count = attendance.data?.length;
  const previous = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (count !== undefined && previous.current !== undefined && count > previous.current) haptics.tick();
    previous.current = count;
  }, [count]);

  async function onClose() {
    if (await confirm({ title: "Close check-in?", description: "The code stops working and attendance is no longer recorded. You can open it again from this meeting.", confirmLabel: "Close check-in", destructive: true })) close.mutate();
  }
  // The address a phone camera opens. The short link lives on the site, whatever API host this build uses.
  const link = code.data ? new URL(code.data.shortUrl, config.apiUrl).toString() : "";
  // As large as the phone allows, leaving room for the title, the count and Close on a small screen.
  const size = Math.max(200, Math.min(320, width - 48, height - insets.top - insets.bottom - 330));

  return (
    <View testID="check-in-host" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <IconButton icon={X} label="Leave host mode" tone="surface" onPress={leave} />
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20 }}>
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text variant="eyebrow">Check in</Text>
          <Text variant="title" align="center" accessibilityRole="header" numberOfLines={2}>{meeting?.title ?? "Meeting"}</Text>
        </View>
        {code.data && !expired ? (
          <View style={{ alignItems: "center", gap: 8 }}>
            <QrCode value={link} size={size} label="Check-in code. Members scan this with the OutClass app or their camera." testID="host-code" />
            <Text variant="caption" align="center">The code changes every minute. Old codes stop working.</Text>
          </View>
        ) : code.isError ? (
            <View accessibilityRole="alert" style={{ alignItems: "center", gap: 12 }}>
              <Text variant="section" align="center">{code.error instanceof ApiError && code.error.offline ? "You're offline" : code.error instanceof ApiError && code.error.unreachable ? "Reconnecting…" : "Check-in isn't available"}</Text>
              <Text variant="small" align="center">{errorMessage(code.error)}</Text>
              <Button label="Try again" variant="secondary" onPress={() => code.refetch()} />
            </View>
          ) : (
            <View accessibilityRole="progressbar" accessibilityLabel={expired ? "Refreshing the check-in code" : "Loading the check-in code"} style={{ alignItems: "center", gap: 8 }}>
              <Skeleton width={size} height={size} radius={16} />
              {expired ? <Text variant="caption" align="center">Refreshing the code…</Text> : null}
            </View>
          )}
        {code.isError && count == null ? null : <View accessible accessibilityLiveRegion="polite" accessibilityLabel={`${count ?? 0} checked in`} style={{ alignItems: "center" }}>
          <Text variant="metric" testID="host-count" style={{ fontSize: 44, lineHeight: 50 }}>{count ?? "–"}</Text>
          <Text variant="small">checked in</Text>
        </View>}
      </View>
      <Button full size="large" variant="secondary" label={close.isPending ? "Closing…" : "Close check-in"} testID="host-close" loading={close.isPending} disabled={close.isSuccess} onPress={() => { void onClose(); }} />
      {close.isError ? <Text variant="small" color={colors.destructive} align="center" accessibilityRole="alert" style={{ marginTop: 8 }}>{errorMessage(close.error)}</Text> : null}
      {sheet}
    </View>
  );
}
