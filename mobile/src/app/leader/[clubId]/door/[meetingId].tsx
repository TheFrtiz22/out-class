import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAudioPlayer } from "expo-audio";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "~/components/icons";
import { Text } from "~/components/text";
import { Button, IconButton } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { classifyScan } from "~/lib/scan";
import { useTheme } from "~/lib/theme";

type DoorResult = { status: "checked-in" | "already-checked-in"; checkedInAt: string; name: string | null } | { status: "not-eligible" };
type Banner = { tone: "success" | "warning" | "error"; title: string; detail?: string };

/** How long the same pass text is ignored after a scan, so one held-up phone is read once. */
const SAME_CODE_MS = 4000;

/**
 * Door mode: the leader scans each member's personal pass. Built for a line: the camera never
 * stops, each result shows as a banner with its own haptic and sound, and the next person can be
 * scanned at once. The pass and the result live in memory only; nothing is written to the device.
 */
export default function DoorMode() {
  const { clubId, meetingId } = useLocalSearchParams<{ clubId: string; meetingId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [session, setSession] = useState(0);
  const inFlight = useRef(false);
  const last = useRef<{ text: string; at: number } | null>(null);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);
  useKeepAwake();
  const successSound = useAudioPlayer(require("../../../../../assets/sounds/check-in.wav"));
  const noticeSound = useAudioPlayer(require("../../../../../assets/sounds/notice.wav"));
  const play = (player: typeof successSound) => { try { player.seekTo(0); player.play(); } catch { /* sound is a nicety */ } };

  const attendance = useQuery<{ id: string }[], Error>({
    queryKey: ["leader", "meetings.attendance", clubId, meetingId],
    queryFn: () => api.get<{ id: string }[]>("meetings.attendance", { clubId, meetingId }),
    refetchInterval: 15_000, gcTime: 0,
  });

  function show(next: Banner) {
    setBanner(next);
    if (clear.current) clearTimeout(clear.current);
    clear.current = setTimeout(() => setBanner(null), 2600);
  }

  async function onScanned(text: string) {
    const now = Date.now();
    if (inFlight.current || (last.current && last.current.text === text && now - last.current.at < SAME_CODE_MS)) return;
    last.current = { text, at: now };
    const scanned = classifyScan(text);
    if (scanned.kind !== "pass") { haptics.warning(); play(noticeSound); show({ tone: "warning", title: "Not a check-in pass", detail: "Ask them to open Check-in pass in the OutClass app." }); return; }
    inFlight.current = true;
    try {
      const result = await api.post<DoorResult>("checkInPass.scan", { clubId, meetingId, payload: scanned.payload });
      if (result.status === "checked-in") {
        haptics.checkIn(); play(successSound); setSession(value => value + 1);
        show({ tone: "success", title: result.name ?? "Checked in", detail: result.name ? "Checked in" : undefined });
        queryClient.invalidateQueries({ queryKey: ["leader", "meetings.attendance", clubId, meetingId] });
      } else if (result.status === "already-checked-in") {
        haptics.warning(); play(noticeSound);
        show({ tone: "warning", title: result.name ?? "Already checked in", detail: result.name ? "Already checked in" : undefined });
      } else {
        haptics.error(); play(noticeSound);
        show({ tone: "error", title: "Not eligible", detail: "This meeting isn't open to them." });
      }
    } catch (error) {
      haptics.error(); play(noticeSound);
      show({ tone: "error", title: "Couldn't check in", detail: errorMessage(error) });
    } finally { inFlight.current = false; }
  }

  const granted = !!permission?.granted;
  const tones = { success: [colors.successSubtle, colors.success], warning: [colors.warningSubtle, colors.warning], error: [colors.errorSubtle, colors.destructive] } as const;
  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }} testID="door-mode">
      {granted ? <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={event => onScanned(event.data)} /> : null}
      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 12, right: 12, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 22 }}><IconButton icon={({ size }) => <X size={size} color="#ffffff" />} label="Leave door mode" onPress={() => router.back()} /></View>
          <View accessible accessibilityLiveRegion="polite" accessibilityLabel={`${attendance.data?.length ?? 0} checked in, ${session} by this phone`} style={{ backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 22, paddingHorizontal: 16, minHeight: 44, justifyContent: "center" }}>
            <Text variant="bodyStrong" color="#ffffff" testID="door-count">{attendance.data?.length ?? "–"} checked in</Text>
          </View>
        </View>
        {banner ? (
          <View testID="door-banner" accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ backgroundColor: tones[banner.tone][0], borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, gap: 2 }}>
            <Text variant="section" color={tones[banner.tone][1]} numberOfLines={2}>{banner.title}</Text>
            {banner.detail ? <Text variant="small" color={tones[banner.tone][1]}>{banner.detail}</Text> : null}
          </View>
        ) : null}
      </View>
      {granted ? (
        <View pointerEvents="none" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 24 }}>
          <View style={{ width: 256, height: 256, borderRadius: 28, borderWidth: 3, borderColor: "rgba(255,255,255,0.92)" }} />
          <Text variant="bodyStrong" color="#ffffff" align="center">Scan a member's check-in pass</Text>
        </View>
      ) : permission ? (
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, gap: 14 }}>
            <Text variant="title" accessibilityRole="header">Camera access</Text>
            <Text variant="body">Door mode uses the camera to scan check-in passes.</Text>
            {permission.canAskAgain ? <Button full size="large" label="Allow camera" onPress={() => requestPermission()} /> : <Button full size="large" label="Open Settings" onPress={() => Linking.openSettings()} />}
            <Button full size="large" variant="secondary" label="Not now" onPress={() => router.back()} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
