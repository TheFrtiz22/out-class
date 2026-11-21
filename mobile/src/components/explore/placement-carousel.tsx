import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Text } from "~/components/text";
import { fonts, useTheme } from "~/lib/theme";

/**
 * "Where members go" as drifting rails of raised pills: the native counterpart of the web's
 * components/clubs/employer-carousel.tsx. Firm names only (no employer logos). Up to three rails
 * in alternating directions at the web's speed; touching a rail holds it still (the web slows on
 * hover), a horizontal drag moves it and flicks it with momentum, and vertical scrolling passes
 * through. Reduce Motion (and short lists) show the plain wrapped list.
 */
const SPEED = 28; // points per second, as on the web
const MAX_ROWS = 3;
const MIN_PER_ROW = 3;
const COPIES = 3;
const GAP = 10;
const FADE = 28;

export function PlacementCarousel({ names }: { names: string[] }) {
  const { a11y } = useTheme();
  if (a11y.reduceMotion || names.length < 6) return <PillList names={names} />;
  const rowCount = Math.max(1, Math.min(MAX_ROWS, Math.floor(names.length / MIN_PER_ROW)));
  const rows = Array.from({ length: rowCount }, (_, r) => names.filter((_, i) => i % rowCount === r));
  return (
    <View accessible accessibilityRole="list" accessibilityLabel={`Where members go: ${names.join(", ")}`} style={{ gap: 6 }}>
      {rows.map((row, i) => <Rail key={i} names={row} direction={i % 2 === 0 ? -1 : 1} />)}
      <EdgeFade side="left" />
      <EdgeFade side="right" />
    </View>
  );
}

function PillList({ names }: { names: string[] }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{names.map(name => <Pill key={name} name={name} />)}</View>;
}

function Pill({ name }: { name: string }) {
  const { colors, radius, dark } = useTheme();
  return (
    <View style={{ minHeight: 40, paddingHorizontal: 16, justifyContent: "center", borderRadius: radius.full, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 2, borderColor: colors.border, shadowColor: colors.schoolPrimary, shadowOpacity: dark ? 0 : 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.displayStrong, fontSize: 15, lineHeight: 20 }}>{name}</Text>
    </View>
  );
}

function Rail({ names, direction }: { names: string[]; direction: 1 | -1 }) {
  const offset = useSharedValue(0);
  const momentum = useSharedValue(0);
  const dragging = useSharedValue(false);
  const width = useSharedValue(0);

  // Always registered as running: Reanimated reads `autostart` only on the first render, so a rail
  // that waited for its measurement never moved. Until the width is known the wrap below is skipped.
  const drift = useFrameCallback(frame => {
    "worklet";
    const dt = Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 0.05);
    if (!dragging.value) {
      offset.value += direction * SPEED * dt + momentum.value * dt;
      momentum.value *= Math.pow(0.04, dt); // a flick settles back to the drift within about a second
      if (Math.abs(momentum.value) < 1) momentum.value = 0;
    }
    const w = width.value;
    if (w > 0) offset.value = ((offset.value % w) + w) % w - w;
  });
  // Stop drawing frames while another screen covers this one.
  useFocusEffect(useCallback(() => {
    drift.setActive(true);
    return () => drift.setActive(false);
  }, [drift]));

  const drag = Gesture.Pan().activeOffsetX([-10, 10]).failOffsetY([-8, 8])
    .onBegin(() => { dragging.value = true; momentum.value = 0; })
    .onChange(event => { offset.value += event.changeX; })
    .onEnd(event => { momentum.value = Math.max(-2400, Math.min(2400, event.velocityX)); })
    .onFinalize(() => { dragging.value = false; });

  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const measure = (event: LayoutChangeEvent) => {
    width.value = event.nativeEvent.layout.width + GAP; // one set plus the gap before the next copy
  };

  return (
    <GestureDetector gesture={drag}>
      <View collapsable={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ overflow: "hidden", paddingVertical: 4 }}>
        <Animated.View style={[{ flexDirection: "row", gap: GAP, alignSelf: "flex-start" }, trackStyle]}>
          {Array.from({ length: COPIES }, (_, c) => (
            <View key={c} onLayout={c === 0 ? measure : undefined} style={{ flexDirection: "row", gap: GAP }}>
              {names.map(name => <Pill key={name} name={name} />)}
            </View>
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** A card-coloured fade over one edge, so pills drift in and out instead of being clipped. */
function EdgeFade({ side }: { side: "left" | "right" }) {
  const { colors } = useTheme();
  const id = `placement-fade-${side}`;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, width: FADE, [side]: 0 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.card} stopOpacity={side === "left" ? 1 : 0} />
            <Stop offset="1" stopColor={colors.card} stopOpacity={side === "left" ? 0 : 1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
