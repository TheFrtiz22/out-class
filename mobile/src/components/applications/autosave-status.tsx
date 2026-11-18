import { ActivityIndicator, View } from "react-native";
import { Text } from "~/components/text";
import { Press } from "~/components/ui";
import { type AutosaveHandle, recoveryText } from "~/lib/autosave";
import { useTheme } from "~/lib/theme";

function Link({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Press testID={testID} onPress={onPress} accessibilityLabel={label} hitSlop={12} style={{ minHeight: 28, justifyContent: "center" }}>
      <Text variant="caption" color={colors.foreground} style={{ textDecorationLine: "underline" }}>{label}</Text>
    </Press>
  );
}

/** The web's AutosaveStatus (components/ui/autosave-status.tsx): the same states and wording. */
export function AutosaveStatus<T>({ save }: { save: AutosaveHandle<T> }) {
  const { colors, radius } = useTheme();
  const retry = () => { void save.flush().catch(() => {}); };
  const discard = () => { void save.discardRecovery().catch(() => {}); };
  if (save.recovery != null) {
    // A copy the server has moved past is never restored or saved: keep the newer version, or read the copy.
    if (save.recoveryKind !== "local") return (
      <View accessibilityRole="alert" testID="autosave-conflict" style={{ gap: 6 }}>
        <Text variant="caption">This device has changes from before a newer version was saved elsewhere.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          <Link testID="autosave-keep-newer" label="Keep newer version" onPress={discard} />
          {!save.reviewing ? <Link testID="autosave-review-copy" label="Review my copy" onPress={save.reviewRecovery} /> : null}
        </View>
        {save.reviewing ? (
          <View accessibilityLabel="Your earlier copy (read-only)" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.muted, padding: 10 }}>
            <Text variant="small" color={colors.foreground} selectable>{recoveryText(save.recovery)}</Text>
          </View>
        ) : null}
      </View>
    );
    return (
      <View accessibilityRole="alert" testID="autosave-recovery" style={{ gap: 6 }}>
        <Text variant="caption">Unsaved changes from this device are available.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          <Link testID="autosave-restore" label="Restore draft" onPress={save.restoreRecovery} />
          <Link testID="autosave-discard" label="Discard" onPress={discard} />
        </View>
      </View>
    );
  }
  if (save.state === "idle") return null;
  const connection = save.state === "offline" || save.state === "unreachable";
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {connection ? (
        <>
          <Text variant="caption" testID="autosave-offline" style={{ flexShrink: 1 }}>{save.error || (save.state === "offline" ? "Offline. Changes save when you reconnect" : "Couldn’t reach OutClass")}</Text>
          <Link testID="autosave-retry" label="Retry" onPress={retry} />
        </>
      ) : save.state === "error" ? (
        <>
          <Text variant="caption" testID="autosave-error">Couldn’t save.</Text>
          <Link testID="autosave-retry" label="Retry" onPress={retry} />
          {save.error ? <Text variant="caption" style={{ flexShrink: 1 }}>{save.error}</Text> : null}
        </>
      ) : save.state === "saved" ? (
        <Text variant="caption" testID="autosave-saved">Saved</Text>
      ) : (
        <>
          <ActivityIndicator size="small" color={colors.mutedForeground} style={{ transform: [{ scale: 0.7 }] }} />
          <Text variant="caption" testID="autosave-saving">Saving…</Text>
        </>
      )}
    </View>
  );
}
