import { useIsFocused, useNavigation, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "~/components/glass";
import { ArrowLeft, QrCode } from "~/components/icons";
import { Text } from "~/components/text";
import { IconButton, TARGET } from "~/components/ui";

export const HEADER_HEIGHT = 56;
/** A fitted title never drops below 10pt (half of 20pt), which a 45-character name needs on a 320pt-wide phone. */
const TITLE_MIN_SCALE = 0.5;
/** Top inset a screen's scroll content needs to clear the floating header. */
export function useHeaderInset() {
  return useSafeAreaInsets().top + HEADER_HEIGHT + 8;
}

/**
 * The floating glass header. Tab screens show their title with the scanner entry point (tap to
 * scan; the long-press app-icon shortcut opens the same screen). Pushed screens show Back.
 *
 * A tab opened from a pushed screen (Update profile in a draft) is a second copy of the tabs on top
 * of the stack, with no way back but the swipe. Its tab headers show Back too, which closes that copy.
 *
 * `fitTitle` shrinks a long title (a club's full name) to fit the bar on one line instead of
 * cutting it off.
 */
export function Header({ title, back, actions, scanner = !back, fitTitle }: { title: string; back?: boolean; actions?: ReactNode; scanner?: boolean; fitTitle?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const focused = useIsFocused();
  // Read while focused only: a focused tab's own copy of the tabs is the top of the root stack, so a
  // stack index above 0 means it was opened over another screen. (Unfocused, the index is a screen's above it.)
  const stacked = !back && focused && (navigation.getParent()?.getState()?.index ?? 0) > 0;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 4, left: 12, right: 12, zIndex: 20 }}>
      <Glass radius={HEADER_HEIGHT / 2} style={{ height: HEADER_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 2 }}>
        {back ? <IconButton icon={ArrowLeft} label="Back" testID="header-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
          // `dismiss` pops the whole copy of the tabs; `back` would first step through the tabs' own history.
          : stacked ? <IconButton icon={ArrowLeft} label="Back" testID="header-back" onPress={() => router.dismiss()} />
            : <View style={{ width: 12 }} />}
        {/* The bar has a fixed height, so the title scales less than body text and truncates rather than clips. */}
        <Text variant="section" accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.35} adjustsFontSizeToFit={fitTitle} minimumFontScale={fitTitle ? TITLE_MIN_SCALE : undefined} style={{ flex: 1, fontSize: 20, lineHeight: 26 }}>{title}</Text>
        {actions}
        {scanner ? <IconButton icon={QrCode} label="Scan a code" testID="header-scan" onPress={() => router.push("/scan")} /> : null}
        {!actions && !scanner ? <View style={{ width: fitTitle ? 14 : TARGET }} /> : null}
      </Glass>
    </View>
  );
}
