import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "~/components/text";
import { Button, Card } from "~/components/ui";
import { push, type PushStatus } from "~/lib/push";

type NudgeState = PushStatus | "loading" | "asking" | "enabled" | "failed" | "dismissed";

/**
 * Shown once, right after a submit: push is off on this phone and the system can still ask
 * (`~/lib/push` status "off"). Turning it on goes through the same path as the switch in
 * notification preferences; nothing is asked until the student taps.
 */
export function PushNudge({ onDismiss }: { onDismiss: () => void }) {
  const [state, setState] = useState<NudgeState>("loading");
  useEffect(() => {
    let live = true;
    push.status().then(status => { if (live) setState(status); }, () => { if (live) setState("unavailable"); });
    return () => { live = false; };
  }, []);

  if (state === "enabled") return <Text variant="small" accessibilityRole="alert" testID="push-nudge-on">Notifications are on for this phone.</Text>;
  if (state !== "off" && state !== "asking" && state !== "failed") return null;

  const enable = async () => {
    setState("asking");
    const on = await push.enable().catch(() => false);
    setState(on ? "enabled" : "failed");
  };
  return (
    <Card testID="push-nudge" tone="soft" style={{ gap: 10 }}>
      <Text variant="section" accessibilityRole="header">Hear back on this phone</Text>
      <Text variant="small">Interview invites and decisions always reach your OutClass inbox and email. Turn on notifications to see them here too.</Text>
      {state === "failed" ? <Text variant="caption" accessibilityRole="alert" testID="push-nudge-failed">Notifications didn’t turn on. You can try again, or later in notification preferences.</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Button testID="push-nudge-enable" label="Turn on notifications" loading={state === "asking"} onPress={() => void enable()} />
        <Button testID="push-nudge-dismiss" variant="secondary" label="Not now" disabled={state === "asking"} onPress={() => { setState("dismissed"); onDismiss(); }} />
      </View>
    </Card>
  );
}
