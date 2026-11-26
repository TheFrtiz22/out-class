import { useCanDismiss, useIsFocused, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "~/components/glass";
import { ArrowLeft, Bell, QrCode } from "~/components/icons";
import { Text } from "~/components/text";
import { IconButton, TARGET, useScreenGutters } from "~/components/ui";
import { useApiQuery } from "~/lib/query";
import { fonts, useTheme } from "~/lib/theme";
import type { HomeView } from "~/lib/types";

export const HEADER_HEIGHT = 56;
/** A fitted title never drops below 10pt (half of 20pt), which a 45-character name needs on a 320pt-wide phone. */
const TITLE_MIN_SCALE = 0.5;
/** Top inset a screen's scroll content needs to clear the floating header. */
export function useHeaderInset() {
  return useSafeAreaInsets().top + HEADER_HEIGHT + 8;
}

/**
 * The floating glass header. Tab screens show their title with the Inbox bell (with the unread count)
 * and the scanner entry point (tap to scan; the long-press app-icon shortcut opens the same screen).
 * Pushed screens show Back.
 *
 * A tab opened from a pushed screen (Update profile in a draft) is a second copy of the tabs on top
 * of the stack, with no way back but the swipe. Its tab headers show Back too, which closes that copy.
 *
 * Home (`root`) never shows Back, wherever it is: it is the bottom of the app, and a Back there had
 * nothing safe to go back to.
 *
 * `fitTitle` shrinks a long title (a club's full name) to fit the bar on one line instead of
 * cutting it off.
 */
export function Header({ title, back, root, actions, scanner = !back, fitTitle }: { title: string; back?: boolean; root?: boolean; actions?: ReactNode; scanner?: boolean; fitTitle?: boolean }) {
  const insets = useSafeAreaInsets();
  const gutters = useScreenGutters(12);
  const router = useRouter();
  const focused = useIsFocused();
  const canDismiss = useCanDismiss();
  // Read while focused only: a focused tab's own copy of the tabs is the top of the root stack, so
  // something to dismiss means it was opened over another screen. (Unfocused, it is a screen above it.)
  // A hook, not navigation.getState(): reading navigation state during render is stale and warns.
  const stacked = !back && !root && focused && canDismiss;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 4, left: gutters.left, right: gutters.right, zIndex: 20 }}>
      <Glass radius={HEADER_HEIGHT / 2} style={{ height: HEADER_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 2 }}>
        {back && !root ? <IconButton icon={ArrowLeft} label="Back" testID="header-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
          // `dismiss` pops the whole copy of the tabs; `back` would first step through the tabs' own history.
          : stacked ? <IconButton icon={ArrowLeft} label="Back" testID="header-back" onPress={() => (router.canDismiss() ? router.dismiss() : router.dismissTo("/"))} />
            : <View style={{ width: 12 }} />}
        {/* The bar has a fixed height, so the title scales less than body text and truncates rather than clips. */}
        <Text variant="section" accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.35} adjustsFontSizeToFit={fitTitle} minimumFontScale={fitTitle ? TITLE_MIN_SCALE : undefined} style={{ flex: 1, fontSize: 20, lineHeight: 26 }}>{title}</Text>
        {actions}
        {scanner ? <InboxBell /> : null}
        {scanner ? <IconButton icon={QrCode} label="Scan a code" testID="header-scan" onPress={() => router.push("/scan")} /> : null}
        {!actions && !scanner ? <View style={{ width: fitTitle ? 14 : TARGET }} /> : null}
      </Glass>
    </View>
  );
}

/**
 * The Inbox, opened from the bell. The badge is the Inbox's own unread count, so marking everything
 * read there clears it. (`unread`, the web's bell count, also counts task notifications the Inbox
 * doesn't list; an older server sends only that.)
 */
function InboxBell() {
  const router = useRouter();
  const { colors } = useTheme();
  const home = useApiQuery<HomeView>("home.view", undefined, { staleTime: 30_000 });
  const unread = Math.max(0, Number(home.data?.inboxUnread ?? home.data?.unread) || 0);
  return (
    <View>
      <IconButton icon={Bell} label={unread ? `Inbox, ${unread} unread` : "Inbox"} testID="header-inbox" onPress={() => router.push("/inbox")} />
      {unread ? (
        <View pointerEvents="none" testID="header-inbox-badge" style={{ position: "absolute", top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.destructive, borderWidth: 1.5, borderColor: colors.card, alignItems: "center", justifyContent: "center" }}>
          <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.sansBold, fontSize: 10, lineHeight: 13, color: colors.destructiveForeground }}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      ) : null}
    </View>
  );
}
