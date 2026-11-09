import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DOCK_SPACE } from "./dock";
import { space, useTheme } from "@/theme/tokens";

/** Page frame for every tab: ivory page, safe-area top, room for the dock. */
export function Screen({ children, refreshing, onRefresh }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.xl, paddingBottom: DOCK_SPACE + insets.bottom }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.muted} /> : undefined}
      >
        {children}
      </ScrollView>
    </View>
  );
}
