import type { BottomTabBarProps } from "expo-router/js-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarBlank, Compass, House, Tray, UserCircle, type Icon } from "phosphor-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, navyDepth, navyGradient } from "@/theme/tokens";

/** The web's floating navy dock (components/shell/floating-dock.css), as the app's tab bar. */
const items: Record<string, { label: string; icon: Icon }> = {
  index: { label: "Home", icon: House },
  explore: { label: "Explore", icon: Compass },
  inbox: { label: "Inbox", icon: Tray },
  calendar: { label: "Calendar", icon: CalendarBlank },
  profile: { label: "Profile", icon: UserCircle },
};

export const DOCK_SPACE = 112;

export function Dock({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom - 6, 14) }]}>
      <View style={[styles.dock, { boxShadow: navyDepth }]}>
        <LinearGradient colors={navyGradient} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(147,188,224,0.20)", "rgba(147,188,224,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0.45, y: 0.9 }} style={StyleSheet.absoluteFill} />
        {state.routes.map((route, index) => {
          const item = items[route.name];
          if (!item) return null;
          const focused = state.index === index;
          const Icon = item.icon;
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={item.label}
              onPress={() => { if (!focused) navigateToTab(route.key); }}
              style={[styles.item, focused && styles.itemOn]}>
              {focused ? <View style={styles.marker} /> : null}
              <Icon size={23} color={focused ? "#fff9f1" : "rgba(255,249,241,0.74)"} weight={focused ? "fill" : "regular"} />
              <Text style={[styles.label, { color: focused ? "#fff9f1" : "rgba(255,249,241,0.74)", fontFamily: focused ? font.textSemibold : font.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14 },
  dock: { flexDirection: "row", borderRadius: 30, overflow: "hidden", padding: 7, borderWidth: 1, borderColor: "rgba(191,216,238,0.25)", borderCurve: "continuous" },
  item: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 10, paddingBottom: 8, borderRadius: 22, gap: 3 },
  itemOn: { backgroundColor: "rgba(255,249,241,0.10)" },
  marker: { position: "absolute", top: 3, width: 18, height: 3, borderRadius: 2, backgroundColor: "#e8793e" },
  label: { fontSize: 12, letterSpacing: 0.1 },
});
