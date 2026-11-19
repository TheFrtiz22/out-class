import { type ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, type PressableProps, RefreshControl, ScrollView, type ScrollViewProps, StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import type { IconComponent } from "~/components/icon-factory";
import { Text } from "~/components/text";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { spring } from "~/lib/motion";
import { fonts, useTheme } from "~/lib/theme";

/** Space the floating dock takes at the bottom of a tab screen (dock height + its inset). */
export const DOCK_CLEARANCE = 92;
/** Minimum touch target (44pt, Apple HIG; 48dp on Android is met by the same padding). */
export const TARGET = 44;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pressable that settles slightly while held, as web controls do (styles/pressed-states.css). */
export function Press({ children, style, large, onPressIn, onPressOut, disabled, ...rest }: PressableProps & { large?: boolean; style?: ViewStyle | ViewStyle[] }) {
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - (large ? theme.press.scaleLarge : theme.press.scale)) }],
    // The animated value owns opacity, so the disabled dim is folded in here rather than in a static style.
    opacity: (disabled ? 0.5 : 1) * (1 - pressed.value * 0.08),
  }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      {...rest}
      onPressIn={event => { pressed.value = theme.a11y.reduceMotion ? 1 : withTiming(1, { duration: theme.duration.pressIn }); onPressIn?.(event); }}
      onPressOut={event => { pressed.value = spring(0, { kind: "quick", reduceMotion: theme.a11y.reduceMotion }); onPressOut?.(event); }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Presses closer together than this are one press: a double tap never submits twice. */
const REPEAT_GUARD_MS = 450;
/** `onPress`, ignoring a repeat that lands within the guard window (the second tap of a double tap). */
function useSinglePress(onPress?: () => void) {
  const last = useRef(0);
  if (!onPress) return undefined;
  return () => {
    const now = Date.now();
    if (now - last.current < REPEAT_GUARD_MS) return;
    last.current = now;
    onPress();
  };
}

type ButtonProps = { label: string; onPress?: () => void; variant?: "primary" | "secondary" | "ghost" | "destructive" | "accent"; size?: "default" | "compact" | "large"; icon?: IconComponent; loading?: boolean; disabled?: boolean; full?: boolean; accessibilityHint?: string; testID?: string; style?: ViewStyle };
export function Button({ label, onPress, variant = "primary", size = "default", icon: Icon, loading, disabled, full, accessibilityHint, testID, style }: ButtonProps) {
  const { colors, radius, controlHeight } = useTheme();
  const palette = {
    primary: { background: colors.primary, text: colors.primaryForeground, border: colors.primary },
    secondary: { background: colors.card, text: colors.foreground, border: colors.border },
    ghost: { background: "transparent", text: colors.foreground, border: "transparent" },
    destructive: { background: colors.destructive, text: colors.destructiveForeground, border: colors.destructive },
    accent: { background: colors.brandSubtle, text: colors.brandInk, border: colors.brandSubtle },
  }[variant];
  const height = Math.max(TARGET, size === "large" ? controlHeight.large + 4 : size === "compact" ? controlHeight.compact : controlHeight.large);
  const press = useSinglePress(onPress);
  return (
    <Press
      testID={testID}
      onPress={press}
      disabled={disabled || loading}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      hitSlop={size === "compact" ? 6 : undefined}
      style={[{ minHeight: height, paddingHorizontal: size === "compact" ? 14 : 18, paddingVertical: 6, borderRadius: radius.full, backgroundColor: palette.background, borderColor: palette.border, borderWidth: StyleSheet.hairlineWidth * 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: full ? "stretch" : "flex-start", maxWidth: "100%" }, ...(style ? [style] : [])]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.text} /> : Icon ? <Icon size={18} color={palette.text} /> : null}
      <Text variant="button" color={palette.text} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Text>
    </Press>
  );
}

/** A round icon-only control with a 44pt target. `label` is required: it is the accessible name. */
export function IconButton({ icon: Icon, label, onPress, onLongPress, tone = "plain", selected, disabled, accessibilityHint, testID }: { icon: IconComponent; label: string; onPress?: () => void; onLongPress?: () => void; tone?: "plain" | "surface"; selected?: boolean; disabled?: boolean; accessibilityHint?: string; testID?: string }) {
  const { colors } = useTheme();
  const press = useSinglePress(onPress);
  return (
    <Press testID={testID} onPress={press} onLongPress={onLongPress} disabled={disabled} accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{ selected: !!selected, disabled: !!disabled }} hitSlop={6}
      style={{ width: TARGET, height: TARGET, borderRadius: TARGET / 2, alignItems: "center", justifyContent: "center", backgroundColor: tone === "surface" ? colors.card : "transparent", borderWidth: tone === "surface" ? StyleSheet.hairlineWidth : 0, borderColor: colors.border }}>
      <Icon size={22} weight={selected ? "fill" : "regular"} color={selected ? colors.brandInk : colors.foreground} />
    </Press>
  );
}

export function Card({ children, style, padded = true, tone = "card", ...rest }: ViewProps & { padded?: boolean; tone?: "card" | "soft" | "brand" | "blue" | "sage" | "lilac" | "warm" }) {
  const { colors, radius, space, dark } = useTheme();
  const background = { card: colors.card, soft: colors.contentSoft, brand: colors.brandSubtle, blue: colors.surfaceBlue, sage: colors.surfaceSage, lilac: colors.surfaceLilac, warm: colors.surfaceWarm }[tone];
  return (
    <View {...rest} style={[{ backgroundColor: background, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: padded ? space.content - 4 : 0, shadowColor: colors.schoolPrimary, shadowOpacity: dark || tone !== "card" ? 0 : 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 0 }, style]}>
      {children}
    </View>
  );
}

export type ChipTone = "neutral" | "brand" | "success" | "warning" | "info" | "error" | "interview";
export function Chip({ label, tone = "neutral", icon: Icon }: { label: string; tone?: ChipTone; icon?: IconComponent }) {
  const { colors, radius } = useTheme();
  const palette: Record<ChipTone, [string, string]> = {
    neutral: [colors.secondary, colors.secondaryForeground], brand: [colors.brandSubtle, colors.brandInk], success: [colors.successSubtle, colors.success],
    warning: [colors.warningSubtle, colors.warning], info: [colors.infoSubtle, colors.info], error: [colors.errorSubtle, colors.destructive], interview: [colors.interviewSubtle, colors.interview],
  };
  const [background, text] = palette[tone];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: background, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
      {Icon ? <Icon size={13} color={text} /> : null}
      <Text variant="caption" color={text} style={{ fontFamily: fonts.sansSemibold }}>{label}</Text>
    </View>
  );
}

/** The tone the web gives each application status (student-facing labels come from the server). */
export function statusTone(code: string): ChipTone {
  return ({ DRAFTING: "warning", SUBMITTED: "info", IN_REVIEW: "info", INTERVIEWING: "interview", ACCEPTED: "success", REJECTED: "neutral", WAITLISTED: "neutral" } as Record<string, ChipTone>)[code] ?? "neutral";
}

const CLUB_ASSET = /^club-assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/;
/** A colour value React Native can draw: a club colour is free text on the server, and an unknown one warns. */
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** A club's mark: its logo when it has one, otherwise its initials on the club colour. */
export function ClubMark({ name, color, logoUrl, size = 44 }: { name: string; color?: string | null; logoUrl?: string | null; size?: number }) {
  const { radius } = useTheme();
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const latin = words.filter(word => /^[A-Za-z0-9]/.test(word));
  const initials = (latin.length ? latin : words).slice(0, 2).map(word => Array.from(word)[0]!.toUpperCase()).join("");
  const [failed, setFailed] = useState("");
  // An uploaded logo is a stored reference the site serves publicly (lib/club-assets.ts clubAssetSource); an address is used as is.
  const logo = !logoUrl ? null : CLUB_ASSET.test(logoUrl) ? `${config.apiUrl}/api/club-assets?reference=${encodeURIComponent(logoUrl)}`
    : logoUrl.startsWith("/") && !logoUrl.startsWith("//") ? `${config.apiUrl}${logoUrl}` : /^https?:\/\//i.test(logoUrl) ? logoUrl : null;
  return (
    <View accessible={false} style={{ width: size, height: size, borderRadius: Math.min(radius.md, size / 3.4), backgroundColor: color && HEX_COLOR.test(color.trim()) ? color.trim() : "#142d4e", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {logo && failed !== logo ? <Image source={{ uri: logo }} style={{ width: size, height: size }} contentFit="cover" transition={150} onError={() => setFailed(logo)} />
        : <Text maxFontSizeMultiplier={1} style={{ fontFamily: fonts.displayStrong, fontSize: size * 0.36, lineHeight: size * 0.44, color: "#ffffff" }}>{initials}</Text>}
    </View>
  );
}

/** A skeleton block. Shapes match the final layout so content replaces it without a jump. */
export function Skeleton({ width, height = 14, radius: corner, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle }) {
  const { colors, radius, a11y } = useTheme();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (a11y.reduceMotion) { pulse.value = 1; return; }
    pulse.value = withRepeat(withTiming(0.45, { duration: 900 }), -1, true);
  }, [a11y.reduceMotion, pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width: width ?? "100%", height, borderRadius: corner ?? radius.sm, backgroundColor: colors.muted }, animated, style]} />;
}
export function SkeletonRows({ count = 4, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          {avatar ? <Skeleton width={44} height={44} radius={10} /> : null}
          <View style={{ flex: 1, gap: 8 }}><Skeleton width="62%" height={16} /><Skeleton width="88%" /></View>
        </Card>
      ))}
    </View>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon?: IconComponent; title: string; body?: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 24, gap: 10 }}>
      {Icon ? <Icon size={30} color={colors.mutedForeground} /> : null}
      <Text variant="section" align="center">{title}</Text>
      {body ? <Text variant="small" align="center">{body}</Text> : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

/** A failed load, with the server's own message and a retry. `offline` uses the offline wording. */
export function ErrorState({ message, onRetry, offline }: { message: string; onRetry?: () => void; offline?: boolean }) {
  return (
    <View accessibilityRole="alert" style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 24, gap: 10 }}>
      <Text variant="section" align="center">{offline ? "You're offline" : "This didn't load"}</Text>
      <Text variant="small" align="center">{message}</Text>
      {onRetry ? <View style={{ marginTop: 8 }}><Button label="Try again" variant="secondary" onPress={onRetry} /></View> : null}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32 }}>
      <Text variant="section" accessibilityRole="header" style={{ flex: 1 }}>{title}</Text>
      {action}
    </View>
  );
}

/** A list row inside a card: leading mark, title, detail, optional trailing content. */
export function Row({ leading, title, detail, trailing, onPress, accessibilityLabel, testID }: { leading?: ReactNode; title: string; detail?: string; trailing?: ReactNode; onPress?: () => void; accessibilityLabel?: string; testID?: string }) {
  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: TARGET + 8, paddingVertical: 8 }}>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={2}>{title}</Text>
        {detail ? <Text variant="small" numberOfLines={2}>{detail}</Text> : null}
      </View>
      {trailing}
    </View>
  );
  if (!onPress) return content;
  return <Press large testID={testID} onPress={onPress} accessibilityLabel={accessibilityLabel ?? (detail ? `${title}, ${detail}` : title)}>{content}</Press>;
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; label: string }) {
  const { colors, radius } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: "row", backgroundColor: colors.muted, borderRadius: radius.full, padding: 3 }}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={option.label}
            onPress={() => { if (!selected) { haptics.tick(); onChange(option.value); } }}
            style={{ flex: 1, minHeight: TARGET - 6, alignItems: "center", justifyContent: "center", borderRadius: radius.full, backgroundColor: selected ? colors.card : "transparent", paddingHorizontal: 10 }}>
            <Text variant="smallStrong" color={selected ? colors.foreground : colors.mutedForeground} numberOfLines={1}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The scrolling body of a screen: canvas colour, safe areas, pull-to-refresh, dock clearance. */
export function ScreenScroll({ children, refreshing, onRefresh, dock, top = 0, contentStyle, ...rest }: ScrollViewProps & { refreshing?: boolean; onRefresh?: () => void; dock?: boolean; top?: number; contentStyle?: ViewStyle }) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[{ paddingTop: top + space.control, paddingHorizontal: 16, paddingBottom: insets.bottom + (dock ? DOCK_CLEARANCE : 24), gap: space.content - 4 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      // The scroll bar runs between the floating header and the dock, not under them.
      scrollIndicatorInsets={{ top, bottom: dock ? DOCK_CLEARANCE : 0 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.mutedForeground} colors={[colors.primary]} progressBackgroundColor={colors.card} progressViewOffset={top} /> : undefined}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
