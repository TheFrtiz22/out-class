import { Tabs, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "~/components/glass";
import type { IconComponent } from "~/components/icon-factory";
import { CalendarDays, Compass, Home, Inbox, UserRound } from "~/components/icons";
import { Text } from "~/components/text";
import { haptics } from "~/lib/haptics";
import { useKeyboardShown } from "~/lib/keyboard";
import { useApiQuery } from "~/lib/query";
import { fonts, useTheme } from "~/lib/theme";
import type { HomeView } from "~/lib/types";

// The same five tabs as the phone-width site (lib/navigation.ts): Home holds To-do, Tasks,
// Applications and My Clubs; Explore holds Events; Settings is reached from Profile.
const tabs: { name: string; label: string; icon: IconComponent; href: "/" | "/explore" | "/inbox" | "/calendar" | "/profile" }[] = [
  { name: "index", href: "/", label: "Home", icon: Home },
  { name: "explore", href: "/explore", label: "Explore", icon: Compass },
  { name: "inbox", href: "/inbox", label: "Inbox", icon: Inbox },
  { name: "calendar", href: "/calendar", label: "Calendar", icon: CalendarDays },
  { name: "profile", href: "/profile", label: "Profile", icon: UserRound },
];

/** The round glass dock (styles/navigation-glass.css `.oc-dock`), floating above the content. */
type DockProps = { state: { index: number; routes: { key: string; name: string }[] } };
function Dock({ state }: DockProps) {
  const router = useRouter();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  // The dock steps aside for the keyboard rather than riding on top of it.
  const keyboard = useKeyboardShown();
  const home = useApiQuery<HomeView>("home.view", undefined, { staleTime: 30_000 });
  const unread = Math.max(0, Number(home.data?.unread) || 0);
  if (keyboard) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 10), alignItems: "center" }}>
      {/* The shadow sits on a wrapper: the glass clips its own corners, which would clip a shadow drawn on it. */}
      <View style={{ marginHorizontal: 14, borderRadius: radius.full, shadowColor: colors.schoolPrimary, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <Glass radius={radius.full} accessibilityRole="tablist" style={{ flexDirection: "row", padding: 6 }}>
          {state.routes.map((route, index) => {
            const tab = tabs.find(item => item.name === route.name);
            if (!tab) return null;
            const selected = state.index === index;
            const Icon = tab.icon;
            const badge = tab.name === "inbox" && unread > 0 ? unread : 0;
            return (
              <Pressable
                key={route.key}
                testID={`tab-${tab.label.toLowerCase()}`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={badge ? `${tab.label}, ${badge} unread` : tab.label}
                onPress={() => {
                  // Selecting the tab you are on does nothing; another tab switches at once, with a tick.
                  if (!selected) { haptics.tick(); router.navigate(tab.href); }
                }}
                style={({ pressed }) => ({ flex: 1, minWidth: 62, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: radius.full, backgroundColor: selected ? colors.primary : pressed ? colors.muted : "transparent" })}
              >
                <View>
                  <Icon size={22} weight={selected ? "fill" : "regular"} color={selected ? colors.primaryForeground : colors.foreground} />
                  {badge ? (
                    <View style={{ position: "absolute", top: -5, right: -11, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.schoolAccent, alignItems: "center", justifyContent: "center" }}>
                      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.sansBold, fontSize: 10, lineHeight: 13, color: "#ffffff" }}>{badge > 99 ? "99+" : badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ fontFamily: selected ? fonts.sansSemibold : fonts.sansMedium, fontSize: 11, lineHeight: 14, color: selected ? colors.primaryForeground : colors.foreground }}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </Glass>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs tabBar={props => <Dock {...(props as unknown as DockProps)} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}>
      {tabs.map(tab => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />)}
    </Tabs>
  );
}
