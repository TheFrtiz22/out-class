import { useQuery } from "@tanstack/react-query";
import * as Brightness from "expo-brightness";
import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "~/components/icons";
import { QrCode } from "~/components/qr-code";
import { Text } from "~/components/text";
import { Button, IconButton, Skeleton } from "~/components/ui";
import { api, ApiError, errorMessage } from "~/lib/api";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { Me } from "~/lib/types";

type Pass = { payload: string; expiresAt: string; refreshAfterSeconds: number };

/** Raise the screen to full brightness while a code is shown, and put it back afterwards. */
export function useBrightnessBoost() {
  useEffect(() => {
    let previous: number | null = null, live = true;
    Brightness.getBrightnessAsync().then(value => { previous = value; if (live) Brightness.setBrightnessAsync(1).catch(() => {}); }).catch(() => {});
    return () => { live = false; if (previous !== null) Brightness.setBrightnessAsync(previous).catch(() => {}); };
  }, []);
}

/** The personal check-in pass: a short-lived code only this account's server row can mint, refreshed on a timer. */
export default function CheckInPass() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useKeepAwake();
  useBrightnessBoost();
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  // Never cached beyond its own life, never persisted: each read mints a new single-use pass.
  const pass = useQuery<Pass, Error>({
    queryKey: ["checkInPass"],
    queryFn: () => api.post<Pass>("checkInPass.issue"),
    refetchInterval: query => (query.state.data?.refreshAfterSeconds ?? 25) * 1000,
    refetchIntervalInBackground: false,
    staleTime: 0, gcTime: 0, retry: 1,
  });
  const name = me.data?.profile ? `${me.data.profile.firstName} ${me.data.profile.lastName}` : "";

  return (
    <View testID="pass-screen" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <IconButton icon={X} label="Close pass" tone="surface" testID="pass-close" onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 22 }}>
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text variant="eyebrow">Check-in pass</Text>
          <Text variant="title" align="center" accessibilityRole="header">{name || "Your pass"}</Text>
        </View>
        {pass.data ? (
          <QrCode value={pass.data.payload} size={288} label="Your check-in pass. A club leader scans this at the door." testID="pass-code" />
        ) : pass.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingHorizontal: 12 }} accessibilityRole="alert">
            <Text variant="section" align="center">{pass.error instanceof ApiError && pass.error.offline ? "You're offline" : "Your pass isn't available"}</Text>
            <Text variant="small" align="center">{errorMessage(pass.error)}</Text>
            <Button label="Try again" variant="secondary" onPress={() => pass.refetch()} />
          </View>
        ) : <Skeleton width={288} height={288} radius={16} />}
        <Text variant="small" align="center" style={{ maxWidth: 280 }}>Show this to the leader at the door. It refreshes on its own and works once.</Text>
      </View>
    </View>
  );
}
