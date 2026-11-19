import { useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AppState, Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, ExternalLink, X } from "~/components/icons";
import { Text } from "~/components/text";
import { Button, IconButton } from "~/components/ui";
import { ApiError, OFFLINE_MESSAGE, errorMessage } from "~/lib/api";
import { easternDateTime } from "~/lib/eastern";
import { haptics } from "~/lib/haptics";
import { openOnWeb } from "~/lib/links";
import { reportError } from "~/lib/report";
import { classifyScan, redeemShortLink, type ScanOutcome } from "~/lib/scan";
import { useTheme } from "~/lib/theme";

type Phase = { name: "scanning" } | { name: "working" } | { name: "result"; outcome: ScanOutcome } | { name: "message"; title: string; body: string };

/** The universal scanner: OutClass check-in, club, voting and live-room codes. Everything else is politely declined. */
export function ScanScreen({ initialCode }: { initialCode?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const linkedCode = initialCode !== undefined;
  const [phase, setPhase] = useState<Phase>(linkedCode ? { name: "working" } : { name: "scanning" });
  const [cameraFailed, setCameraFailed] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Opened from a universal link the scanner can be the only screen: closing it then goes home.
  const leave = () => { if (router.canGoBack()) router.back(); else router.replace("/"); };

  // Camera access granted in Settings takes effect when the person comes back to the app.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => { if (state === "active") getPermission().catch(() => undefined); });
    return () => subscription.remove();
  }, [getPermission]);

  // Opened for one code (a `/q/<code>` link, src/app/q/[code].tsx): redeem it without the camera.
  const linked = useRef<string | null>(null);
  useEffect(() => {
    if (initialCode === undefined || linked.current === initialCode) return;
    linked.current = initialCode;
    busy.current = true;
    void redeem(initialCode ?? "");
    // Runs once for each code this screen is opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  function onScanned(text: string) {
    if (busy.current) return;
    busy.current = true;
    const scanned = classifyScan(text);
    if (scanned.kind === "other") { haptics.warning(); setPhase({ name: "message", title: "Not an OutClass code", body: "This scanner reads OutClass check-in, club and voting codes." }); return; }
    void redeem(scanned.code);
  }

  async function redeem(code: string) {
    setPhase({ name: "working" });
    try {
      const outcome = await redeemShortLink(code);
      // The person closed the scanner while the code was checked: never navigate away from where they went.
      if (!mounted.current) return;
      if (outcome.kind === "navigate") { haptics.confirm(); router.replace(outcome.route as never); return; }
      if (outcome.kind === "check-in") {
        if (outcome.outcome.status === "checked-in") haptics.checkIn(); else haptics.warning();
        for (const key of ["home.view", "calendar.view", "meetings", "meetings.meeting"]) void queryClient.invalidateQueries({ queryKey: [key] });
      } else if (outcome.kind === "web") { haptics.confirm(); void openOnWeb(outcome.href); }
      else haptics.warning();
      setPhase({ name: "result", outcome });
    } catch (error) {
      // The scanned text is never reported: only that a scan failed, and only when it was not a refusal.
      if (!(error instanceof ApiError) || error.status >= 500) reportError(error, "scan");
      if (!mounted.current) return;
      haptics.error();
      const offline = error instanceof ApiError && error.offline;
      setPhase({ name: "message", title: offline ? "You're offline" : "Couldn't open this code", body: offline ? OFFLINE_MESSAGE : errorMessage(error) });
    }
  }
  const again = () => { busy.current = false; setCameraFailed(false); setPhase({ name: "scanning" }); };

  // A linked code is redeemed without the camera, so it never asks for camera access.
  const granted = !!permission?.granted || (linkedCode && phase.name !== "scanning");
  const scanning = granted && phase.name === "scanning" && !cameraFailed;
  const scanAgain = <Button full size="large" label="Scan again" testID="scan-again" onPress={again} />;
  const done = (primary = false) => <Button full size="large" variant={primary ? "primary" : "secondary"} label="Done" testID="scan-done" onPress={leave} />;

  let panel: ReactNode = null;
  if (cameraFailed && phase.name === "scanning") {
    panel = <><Text variant="title" accessibilityRole="header">Camera unavailable</Text><Text variant="body">The camera couldn't start. Close other apps using it, then try again.</Text>{scanAgain}{done()}</>;
  } else if (phase.name === "scanning") {
    panel = !permission || granted ? null : (
      <>
        <Text variant="title" accessibilityRole="header">Camera access</Text>
        <Text variant="body">{permission.canAskAgain ? "OutClass uses the camera to scan check-in, club and voting codes." : "Camera access is off for OutClass. Turn it on in Settings to scan codes."}</Text>
        {permission.canAskAgain
          ? <Button full size="large" label="Allow camera" testID="scan-allow" onPress={() => { requestPermission().catch(() => undefined); }} />
          : <Button full size="large" label="Open Settings" testID="scan-settings" onPress={() => { Linking.openSettings().catch(() => undefined); }} />}
        <Button full size="large" variant="secondary" label="Not now" onPress={leave} />
      </>
    );
  } else if (phase.name === "working") {
    panel = <View accessible accessibilityRole="progressbar" accessibilityLabel="Checking this code" style={{ gap: 6 }}><Text variant="title" accessibilityRole="header">Checking…</Text><Text variant="body">One moment.</Text></View>;
  } else if (phase.name === "message") {
    panel = <><Text variant="title" accessibilityRole="header">{phase.title}</Text><Text variant="body">{phase.body}</Text>{scanAgain}{done()}</>;
  } else {
    const outcome = phase.outcome;
    panel = outcome.kind === "check-in" ? (
      <>
        <CheckCircle2 size={40} weight="fill" color={colors.success} />
        <Text variant="title" accessibilityRole="header" testID="scan-success">{outcome.outcome.status === "checked-in" ? "You're checked in" : "Already checked in"}</Text>
        <Text variant="body">{outcome.outcome.status === "checked-in" ? "Checked in" : "You checked in"} {easternDateTime(outcome.outcome.checkedInAt)} Eastern Time.</Text>
        {done(true)}
      </>
    ) : outcome.kind === "check-in-refused" ? (
      <><Text variant="title" accessibilityRole="header">Couldn't check you in</Text><Text variant="body">{outcome.message}</Text>{scanAgain}{done()}</>
    ) : outcome.kind === "closed" ? (
      <><Text variant="title" accessibilityRole="header">Check-in is closed</Text><Text variant="body">{outcome.message}</Text>{done(true)}</>
    ) : outcome.kind === "web" ? (
      <>
        <Text variant="title" accessibilityRole="header">Opened on the web</Text>
        <Text variant="body">This code opens a page on the OutClass website.</Text>
        <Button full size="large" icon={ExternalLink} label="Open again" variant="secondary" onPress={() => { void openOnWeb(outcome.href); }} />
        {scanAgain}{done()}
      </>
    ) : (
      <><Text variant="title" accessibilityRole="header">This code isn't available</Text><Text variant="body">It may have expired or been removed. Ask for the current code.</Text>{scanAgain}{done()}</>
    );
  }

  return (
    // The camera preview is always dark, so the scanner keeps its own dark surface in both themes.
    <View style={{ flex: 1, backgroundColor: "#000000" }} testID="scan-screen">
      {scanning ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={event => onScanned(event.data)} onMountError={() => setCameraFailed(true)} />
      ) : null}
      <View pointerEvents="box-none" style={{ position: "absolute", zIndex: 1, top: insets.top + 8, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 22 }}><IconButton icon={({ size }) => <X size={size} color="#ffffff" />} label="Close scanner" testID="scan-close" onPress={leave} /></View>
      </View>

      {scanning ? (
        <View pointerEvents="none" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 24 }}>
          <View accessible accessibilityLabel="Point the camera at an OutClass code" style={{ width: 248, height: 248, borderRadius: 28, borderWidth: 3, borderColor: "rgba(255,255,255,0.92)" }} />
          <View style={{ gap: 4, alignItems: "center" }}>
            <Text variant="bodyStrong" color="#ffffff" align="center">Scan an OutClass code</Text>
            <Text variant="small" color="rgba(255,255,255,0.8)" align="center">Check-in, club and voting codes</Text>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          {panel ? (
            <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, gap: 14 }}>
              {panel}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function Scan() {
  return <ScanScreen />;
}
