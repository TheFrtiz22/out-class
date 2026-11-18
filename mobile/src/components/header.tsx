import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "~/components/glass";
import { ArrowLeft, QrCode } from "~/components/icons";
import { Text } from "~/components/text";
import { IconButton, TARGET } from "~/components/ui";

export const HEADER_HEIGHT = 56;
/** Top inset a screen's scroll content needs to clear the floating header. */
export function useHeaderInset() {
  return useSafeAreaInsets().top + HEADER_HEIGHT + 8;
}

/**
 * The floating glass header. Tab screens show their title with the scanner entry point (tap to
 * scan; the long-press app-icon shortcut opens the same screen). Pushed screens show Back.
 */
export function Header({ title, back, actions, scanner = !back }: { title: string; back?: boolean; actions?: ReactNode; scanner?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 4, left: 12, right: 12, zIndex: 20 }}>
      <Glass radius={HEADER_HEIGHT / 2} style={{ height: HEADER_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 2 }}>
        {back ? <IconButton icon={ArrowLeft} label="Back" testID="header-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} /> : <View style={{ width: 12 }} />}
        <Text variant="section" accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontSize: 20, lineHeight: 26 }}>{title}</Text>
        {actions}
        {scanner ? <IconButton icon={QrCode} label="Scan a code" testID="header-scan" onPress={() => router.push("/scan")} /> : null}
        {!actions && !scanner ? <View style={{ width: TARGET }} /> : null}
      </Glass>
    </View>
  );
}
