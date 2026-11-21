import * as WebBrowser from "expo-web-browser";
import { Pressable, View } from "react-native";
import { Check } from "~/components/icons";
import { Text } from "~/components/text";
import { TARGET } from "~/components/ui";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

/** The clickwrap box for account creation, with the Terms and Privacy Policy one tap away. */
export function TermsCheckbox({ checked, onChange, error, testID }: { checked: boolean; onChange: (checked: boolean) => void; error?: string; testID?: string }) {
  const { colors } = useTheme();
  const open = (path: string) => { WebBrowser.openBrowserAsync(`${config.apiUrl}${path}`).catch(() => {}); };
  return (
    <View style={{ gap: 6 }}>
      <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
        onPress={() => { haptics.tick(); onChange(!checked); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: TARGET }}>
        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: error ? colors.destructive : checked ? colors.primary : colors.input, backgroundColor: checked ? colors.primary : colors.card, alignItems: "center", justifyContent: "center" }}>
          {checked ? <Check size={16} weight="bold" color={colors.primaryForeground} /> : null}
        </View>
        <Text variant="small" style={{ flex: 1 }}>I agree to the Terms of Service and Privacy Policy.</Text>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 20, paddingLeft: 36 }}>
        <Pressable accessibilityRole="link" onPress={() => open("/terms")} hitSlop={{ left: 10, right: 10 }} style={{ minHeight: TARGET, justifyContent: "center" }}><Text variant="smallStrong" color={colors.primary}>Read the Terms</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => open("/privacy")} hitSlop={{ left: 10, right: 10 }} style={{ minHeight: TARGET, justifyContent: "center" }}><Text variant="smallStrong" color={colors.primary}>Privacy Policy</Text></Pressable>
      </View>
      {error ? <Text variant="caption" color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}
