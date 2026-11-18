import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, X } from "~/components/icons";
import { Text } from "~/components/text";
import { Button, IconButton } from "~/components/ui";
import { errorMessage } from "~/lib/api";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { reportError } from "~/lib/report";
import { classifyScan, redeemShortLink, type ScanOutcome } from "~/lib/scan";
import { useTheme } from "~/lib/theme";
import { useQueryClient } from "@tanstack/react-query";

type Phase = { name: "scanning" } | { name: "working" } | { name: "result"; outcome: ScanOutcome } | { name: "message"; title: string; body: string };

/** The universal scanner: OutClass check-in, club, voting and live-room codes. Everything else is politely declined. */
export default function Scan() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ name: "scanning" });
  const busy = useRef(false);
  // Opened from a `/q/<code>` universal link: redeem that code without the camera.
  const { code: linkedCode } = useLocalSearchParams<{ code?: string }>();
  const linked = useRef(false);
  useEffect(() => {
    if (!linkedCode || linked.current) return;
    linked.current = true;
    onScanned(`${config.apiUrl}/q/${linkedCode}`);
    // Runs once for the code this screen was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedCode]);

  async function onScanned(text: string) {
    if (busy.current) return;
    busy.current = true;
    const scanned = classifyScan(text);
    if (scanned.kind === "pass") { haptics.warning(); setPhase({ name: "message", title: "That's a check-in pass", body: "A club leader scans this from a meeting's door mode." }); return; }
    if (scanned.kind === "other") { haptics.warning(); setPhase({ name: "message", title: "Not an OutClass code", body: "This scanner reads OutClass check-in, club and voting codes." }); return; }
    setPhase({ name: "working" });
    try {
      const outcome = await redeemShortLink(scanned.code);
      if (outcome.kind === "navigate") { haptics.confirm(); router.replace(outcome.route as never); return; }
      if (outcome.kind === "check-in") {
        if (outcome.outcome.status === "checked-in") haptics.checkIn(); else haptics.warning();
        queryClient.invalidateQueries({ queryKey: ["home.view"] });
        queryClient.invalidateQueries({ queryKey: ["calendar.view"] });
      } else haptics.warning();
      setPhase({ name: "result", outcome });
    } catch (error) {
      // The scanned text is never reported: only that a scan failed.
      reportError(error, "scan");
      haptics.error();
      setPhase({ name: "message", title: "Couldn't check you in", body: errorMessage(error) });
    }
  }
  const again = () => { busy.current = false; setPhase({ name: "scanning" }); };

  const granted = !!permission?.granted;
  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }} testID="scan-screen">
      {granted && phase.name === "scanning" ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={event => onScanned(event.data)} />
      ) : null}
      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 22 }}><IconButton icon={({ size }) => <X size={size} color="#ffffff" />} label="Close scanner" testID="scan-close" onPress={() => router.back()} /></View>
      </View>

      {granted && phase.name === "scanning" ? (
        <View pointerEvents="none" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 24 }}>
          <View accessible accessibilityLabel="Point the camera at an OutClass code" style={{ width: 248, height: 248, borderRadius: 28, borderWidth: 3, borderColor: "rgba(255,255,255,0.92)" }} />
          <Text variant="bodyStrong" color="#ffffff" align="center">Scan an OutClass code</Text>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, gap: 14 }}>
            {!permission ? null : !granted ? (
              <>
                <Text variant="title" accessibilityRole="header">Camera access</Text>
                <Text variant="body">OutClass uses the camera to scan check-in codes.</Text>
                {permission.canAskAgain
                  ? <Button full size="large" label="Allow camera" testID="scan-allow" onPress={() => requestPermission()} />
                  : <Button full size="large" label="Open Settings" onPress={() => Linking.openSettings()} />}
                <Button full size="large" variant="secondary" label="Not now" onPress={() => router.back()} />
              </>
            ) : phase.name === "working" ? (
              <><Text variant="title" accessibilityRole="header">Checking…</Text><Text variant="body">One moment.</Text></>
            ) : phase.name === "message" ? (
              <>
                <Text variant="title" accessibilityRole="header">{phase.title}</Text>
                <Text variant="body">{phase.body}</Text>
                <Button full size="large" label="Scan again" testID="scan-again" onPress={again} />
                <Button full size="large" variant="secondary" label="Done" onPress={() => router.back()} />
              </>
            ) : phase.name === "result" ? (
              phase.outcome.kind === "check-in" ? (
                <>
                  <CheckCircle2 size={40} weight="fill" color={colors.success} />
                  <Text variant="title" accessibilityRole="header" testID="scan-success">{phase.outcome.outcome.status === "checked-in" ? "You're checked in" : "Already checked in"}</Text>
                  <Text variant="body">{new Date(phase.outcome.outcome.checkedInAt).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Text>
                  <Button full size="large" label="Done" testID="scan-done" onPress={() => router.back()} />
                </>
              ) : phase.outcome.kind === "closed" ? (
                <>
                  <Text variant="title" accessibilityRole="header">Check-in is closed</Text>
                  <Text variant="body">{phase.outcome.message}</Text>
                  <Button full size="large" label="Done" onPress={() => router.back()} />
                </>
              ) : (
                <>
                  <Text variant="title" accessibilityRole="header">This link isn't available</Text>
                  <Text variant="body">It may have expired. Ask for the current code.</Text>
                  <Button full size="large" label="Scan again" onPress={again} />
                  <Button full size="large" variant="secondary" label="Done" onPress={() => router.back()} />
                </>
              )
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}
