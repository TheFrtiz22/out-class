import { Tabs, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "~/components/glass";
import type { IconComponent } from "~/components/icon-factory";
import { CalendarDays, Compass, FilePenLine, Home, UserRound, Users } from "~/components/icons";
import { Text } from "~/components/text";
import { haptics } from "~/lib/haptics";
import { DOCK_ICON, DOCK_PADDING, DOCK_TAB_HEIGHT, restingSlot, slotAt } from "~/lib/dock";
import { useKeyboardShown } from "~/lib/keyboard";
import { spring } from "~/lib/motion";
import { useMiddleTab } from "~/lib/middle-tab";
import { fonts, useTheme } from "~/lib/theme";

type Tab = { name: string; label: string; icon: IconComponent; href: "/" | "/explore" | "/clubs" | "/calendar" | "/profile" };
// Five tabs. The middle one is Apply while an application is still open and My Clubs once they are all
// settled (lib/middle-tab.ts). The Inbox is the bell in the header; Events are in Explore; Settings in Profile.
const tabs: Tab[] = [
  { name: "index", href: "/", label: "Home", icon: Home },
  { name: "explore", href: "/explore", label: "Explore", icon: Compass },
  { name: "clubs", href: "/clubs", label: "Apply", icon: FilePenLine },
  { name: "calendar", href: "/calendar", label: "Calendar", icon: CalendarDays },
  { name: "profile", href: "/profile", label: "Profile", icon: UserRound },
];
const middle = { apply: { label: "Apply", icon: FilePenLine }, clubs: { label: "My Clubs", icon: Users } } as const;


/** How far a finger moves sideways before the dock treats a touch as a drag rather than a tap. */
const DRAG_SLOP = 8;
/** How much the selection pill grows while it is held, as the system tab bars do. */
const LIFT_SCALE = 0.08;

/**
 * The round glass dock (styles/navigation-glass.css `.oc-dock`), floating above the content.
 * Tap a tab to switch; or hold and slide along the dock: the selection pill follows the finger,
 * ticks as it crosses each tab, and on release locks onto the tab under the finger (as Instagram's
 * and Apple Music's tab bars do).
 */
type DockProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => unknown; getParent?: () => { getState?: () => { index?: number } | undefined } | undefined } };
function Dock({ state, navigation }: DockProps) {
  const router = useRouter();
  const { colors, radius, a11y } = useTheme();
  const insets = useSafeAreaInsets();
  // The dock steps aside for the keyboard rather than riding on top of it.
  const keyboard = useKeyboardShown();
  const mode = useMiddleTab();
  const shape = (name: string) => {
    const tab = tabs.find(item => item.name === name)!;
    return tab.name === "clubs" ? { ...tab, ...middle[mode] } : tab;
  };

  const routes = state.routes.filter(route => tabs.some(tab => tab.name === route.name));
  const current = Math.max(0, routes.findIndex(route => route.key === state.routes[state.index]?.key));
  const count = routes.length;
  const [width, setWidth] = useState(0);
  // The tab the pill is over while a finger drags it; null when nothing is held.
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? current;

  const position = useSharedValue(current);
  const lift = useSharedValue(0);
  const dockWidth = useSharedValue(0);
  const hovered = useSharedValue(-1);
  const reduceMotion = a11y.reduceMotion;

  // A tab change from anywhere (a tap, a link, a release) glides the pill to it, unless a finger holds it.
  const holding = useRef(false);
  // A drag ends with the finger lifting over some tab; that lift must not also count as a tap on it.
  const droppedAt = useRef(0);
  useEffect(() => { if (!holding.current) position.value = spring(current, { reduceMotion }); }, [current, position, reduceMotion]);

  const go = (index: number) => {
    const tab = tabs.find(item => item.name === routes[index]?.name);
    if (!tab || index === current) return;
    // In a copy of the tabs opened over another screen, Home is the real Home underneath: close the
    // copy rather than show Home inside it, where it would need a Back arrow.
    if (tab.href === "/" && (navigation.getParent?.()?.getState?.()?.index ?? 0) > 0) router.dismissTo("/");
    else router.navigate(tab.href);
  };
  const onGrab = (index: number) => { holding.current = true; haptics.grab(); setHover(index); };
  const onCross = (index: number) => { haptics.tick(); setHover(index); };
  const onRelease = (index: number) => { holding.current = false; droppedAt.current = Date.now(); setHover(null); if (index !== current) haptics.save(); go(index); };
  const onCancel = () => { holding.current = false; droppedAt.current = Date.now(); setHover(null); };

  const drag = Gesture.Pan()
    .withTestId("tab-dock-drag")
    .enabled(count > 1)
    .activeOffsetX([-DRAG_SLOP, DRAG_SLOP])
    .onStart(event => {
      const at = slotAt(event.x, dockWidth.value, count);
      hovered.value = Math.round(at);
      position.value = spring(at, { kind: "quick", reduceMotion });
      lift.value = spring(1, { kind: "quick", reduceMotion });
      runOnJS(onGrab)(hovered.value);
    })
    .onUpdate(event => {
      const at = slotAt(event.x, dockWidth.value, count);
      position.value = at;
      const index = Math.round(at);
      if (index !== hovered.value) { hovered.value = index; runOnJS(onCross)(index); }
    })
    .onEnd((_event, success) => {
      const index = restingSlot(position.value, success, current);
      position.value = spring(index, { reduceMotion });
      lift.value = spring(0, { kind: "quick", reduceMotion });
      hovered.value = -1;
      if (success) runOnJS(onRelease)(index); else runOnJS(onCancel)();
    });

  const slot = width > DOCK_PADDING * 2 && count ? (width - DOCK_PADDING * 2) / count : 0;
  const pill = useAnimatedStyle(() => {
    const step = dockWidth.value > DOCK_PADDING * 2 && count ? (dockWidth.value - DOCK_PADDING * 2) / count : 0;
    return { transform: [{ translateX: position.value * step }, { scale: 1 + lift.value * LIFT_SCALE }] };
  });

  if (keyboard) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 10), alignItems: "stretch" }}>
      {/* The shadow sits on a wrapper: the glass clips its own corners, which would clip a shadow drawn on it. */}
      <View style={{ marginHorizontal: 12, borderRadius: radius.full, shadowColor: colors.schoolPrimary, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <GestureDetector gesture={drag}>
          <Glass radius={radius.full} accessibilityRole="tablist" testID="tab-dock" onLayout={event => { const next = event.nativeEvent.layout.width; dockWidth.value = next; setWidth(next); }} style={{ flexDirection: "row", padding: DOCK_PADDING }}>
            {slot ? <Animated.View pointerEvents="none" testID="tab-selection" style={[{ position: "absolute", top: DOCK_PADDING, bottom: DOCK_PADDING, left: DOCK_PADDING, width: slot, borderRadius: radius.full, backgroundColor: colors.primary }, pill]} /> : null}
            {routes.map((route, index) => {
              const tab = shape(route.name);
              const selected = current === index;
              // The icon and label read as selected under the pill, which during a drag is where the finger is.
              const lit = shown === index;
              const Icon = tab.icon;
              return (
                <Pressable
                  key={route.key}
                  testID={`tab-${tab.name === "clubs" ? `clubs-${mode}` : tab.label.toLowerCase()}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={tab.label}
                  onPress={() => {
                    // Another tab switches at once, with a tick. The tab you are on gets the navigator's own
                    // tabPress, which its list answers by scrolling to the top (useScrollToTop), as iOS tab bars do.
                    if (holding.current || Date.now() - droppedAt.current < 400) return;
                    if (!selected) { haptics.tick(); go(index); }
                    else navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  }}
                  style={({ pressed }) => ({ flex: 1, minWidth: 64, minHeight: DOCK_TAB_HEIGHT, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: radius.full, backgroundColor: !slot && selected ? colors.primary : pressed && !lit ? colors.muted : "transparent" })}
                >
                  <Icon size={DOCK_ICON} weight={lit ? "fill" : "regular"} color={lit ? colors.primaryForeground : colors.foreground} />
                  <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontFamily: lit ? fonts.sansSemibold : fonts.sansMedium, fontSize: 12, lineHeight: 15, color: lit ? colors.primaryForeground : colors.foreground }}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </Glass>
        </GestureDetector>
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
