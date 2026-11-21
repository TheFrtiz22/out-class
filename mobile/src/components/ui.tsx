import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, type PressableProps, RefreshControl, ScrollView, type ScrollViewInstance, type ScrollViewProps, StyleSheet, Switch, View, type ViewProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import type { IconComponent } from "~/components/icon-factory";
import { CalendarClock, CheckCircle2, Circle, Clock, Eye, FilePenLine, Send, XCircle } from "~/components/icons";
import { Text } from "~/components/text";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { useAndroidKeyboardInset } from "~/lib/keyboard";
import { spring } from "~/lib/motion";
import { usePullRefresh } from "~/lib/pull-refresh";
import { fonts, useTheme } from "~/lib/theme";

/** Space the floating dock takes at the bottom of a tab screen (dock height + its inset). */
export const DOCK_CLEARANCE = 92;
/** Minimum touch target (44pt, Apple HIG; 48dp on Android is met by the same padding). */
export const TARGET = 44;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A pressable that settles slightly while held, as web controls do (styles/pressed-states.css).
 * The second tap of a double tap is dropped here, so no row, card or button opens a screen twice.
 */
// A toggle (a checkbox, radio, tab or switch) takes every tap: a quick second tap is the person changing
// their mind, and toggling twice repeats nothing. Only actions that open or submit something are guarded.
const TOGGLE_ROLES = new Set(["checkbox", "radio", "tab", "switch"]);

export function Press({ children, style, large, onPressIn, onPressOut, onPress, disabled, ...rest }: PressableProps & { large?: boolean; style?: ViewStyle | ViewStyle[] }) {
  const theme = useTheme();
  const guarded = useSinglePress(onPress ?? undefined);
  const press = rest.accessibilityRole && TOGGLE_ROLES.has(rest.accessibilityRole) ? onPress ?? undefined : guarded;
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
      onPress={press}
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
export function useSinglePress<A extends unknown[]>(onPress?: (...args: A) => void) {
  const last = useRef(0);
  if (!onPress) return undefined;
  return (...args: A) => {
    const now = Date.now();
    if (now - last.current < REPEAT_GUARD_MS) return;
    last.current = now;
    onPress(...args);
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
  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      hitSlop={size === "compact" ? 6 : undefined}
      style={[{ minHeight: height, paddingHorizontal: size === "compact" ? 14 : 18, paddingVertical: 6, borderRadius: radius.full, backgroundColor: palette.background, borderColor: palette.border, borderWidth: StyleSheet.hairlineWidth * 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: full ? "stretch" : "flex-start", maxWidth: "100%" }, ...(style ? [style] : [])]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.text} /> : Icon ? <Icon size={18} color={palette.text} /> : null}
      {/* Two lines before cutting off, so a label still reads at the largest text sizes. */}
      <Text variant="button" color={palette.text} numberOfLines={2} style={{ flexShrink: 1, textAlign: "center" }}>{label}</Text>
    </Press>
  );
}

/** A round icon-only control with a 44pt target. `label` is required: it is the accessible name. */
export function IconButton({ icon: Icon, label, onPress, onLongPress, tone = "plain", selected, disabled, accessibilityHint, testID }: { icon: IconComponent; label: string; onPress?: () => void; onLongPress?: () => void; tone?: "plain" | "surface"; selected?: boolean; disabled?: boolean; accessibilityHint?: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Press testID={testID} onPress={onPress} onLongPress={onLongPress} disabled={disabled} accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{ selected: !!selected, disabled: !!disabled }} hitSlop={6}
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
const toneIcons: Record<ChipTone, IconComponent> = { neutral: Circle, brand: Circle, success: CheckCircle2, warning: Clock, info: Clock, error: XCircle, interview: CalendarClock };
function useToneColor() {
  const { colors } = useTheme();
  return (tone: ChipTone) => ({ neutral: colors.mutedForeground, brand: colors.brandInk, success: colors.success, warning: colors.warning, info: colors.info, error: colors.destructive, interview: colors.interview } as Record<ChipTone, string>)[tone];
}

/**
 * A status label as the web draws it (components/ui/status-pill.tsx `.oc-status-pill`): a tinted
 * icon and plain text, no filled capsule. The icon carries the tone, so the state reads by shape
 * as well as colour; the label stays in the text colour.
 */
export function Chip({ label, tone = "neutral", icon, testID }: { label: string; tone?: ChipTone; icon?: IconComponent; testID?: string }) {
  const { colors } = useTheme();
  const toneColor = useToneColor();
  const Icon = icon ?? toneIcons[tone];
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", flexShrink: 1, maxWidth: "100%", paddingVertical: 2 }}>
      <Icon size={16} weight={tone === "brand" ? "fill" : "regular"} color={toneColor(tone)} />
      <Text variant="caption" color={colors.foreground} numberOfLines={1} style={{ fontFamily: fonts.sansMedium, flexShrink: 1 }}>{label}</Text>
    </View>
  );
}

/** The tone the web gives each application status (student-facing labels come from the server). */
export function statusTone(code: string): ChipTone {
  return ({ DRAFTING: "neutral", SUBMITTED: "neutral", IN_REVIEW: "info", INTERVIEWING: "interview", ACCEPTED: "success", REJECTED: "error", WAITLISTED: "warning" } as Record<string, ChipTone>)[code] ?? "neutral";
}
/** One glyph per application state, as on the web (status-pill.tsx `statusIcons`). */
const statusIcons: Record<string, IconComponent> = { DRAFTING: FilePenLine, SUBMITTED: Send, IN_REVIEW: Eye, INTERVIEWING: CalendarClock, ACCEPTED: CheckCircle2, REJECTED: XCircle, WAITLISTED: Clock };
/** An application's state: Draft, Submitted, In review, Interview, Accepted, Not selected, Waitlisted. */
export function StatusChip({ label, code, testID }: { label: string; code: string; testID?: string }) {
  return <Chip label={label} tone={statusTone(code)} icon={statusIcons[code]} testID={testID} />;
}

const CLUB_ASSET = /^club-assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/;
/** A colour value React Native can draw: a club colour is free text on the server, and an unknown one warns. */
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** A club's mark: its logo when it has one, otherwise its initials on the club colour. */
/**
 * Navy or white initials, whichever reads on the club colour. A club types its own colour, and the web's own
 * "Rotunda Orange" (#EAAA00) or a white is too light for white initials.
 */
export function clubInk(hex: string): string {
  const raw = hex.replace("#", "");
  const full = raw.length <= 4 ? raw.slice(0, 3).split("").map(c => c + c).join("") : raw.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map(i => { const v = parseInt(full.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.4 ? "#232d4b" : "#ffffff";
}
export function ClubMark({ name, color, logoUrl, size = 44 }: { name: string; color?: string | null; logoUrl?: string | null; size?: number }) {
  const { radius, colors } = useTheme();
  const background = color && HEX_COLOR.test(color.trim()) ? color.trim() : "#142d4e";
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const latin = words.filter(word => /^[A-Za-z0-9]/.test(word));
  const initials = (latin.length ? latin : words).slice(0, 2).map(word => Array.from(word)[0]!.toUpperCase()).join("");
  const [failed, setFailed] = useState("");
  // An uploaded logo is a stored reference the site serves publicly (lib/club-assets.ts clubAssetSource); an address is used as is.
  const logo = !logoUrl ? null : CLUB_ASSET.test(logoUrl) ? `${config.apiUrl}/api/club-assets?reference=${encodeURIComponent(logoUrl)}`
    : logoUrl.startsWith("/") && !logoUrl.startsWith("//") ? `${config.apiUrl}${logoUrl}` : /^https?:\/\//i.test(logoUrl) ? logoUrl : null;
  return (
    <View accessible={false} style={{ width: size, height: size, borderRadius: Math.min(radius.md, size / 3.4), backgroundColor: background, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
      {/* "contain": the whole logo shows inside the box, never cropped; a non-square logo sits on the club colour. */}
      {logo && failed !== logo ? <Image source={{ uri: logo }} style={{ width: size, height: size }} contentFit="contain" transition={150} onError={() => setFailed(logo)} />
        : <Text maxFontSizeMultiplier={1} style={{ fontFamily: fonts.displayStrong, fontSize: size * 0.36, lineHeight: size * 0.44, color: clubInk(background) }}>{initials}</Text>}
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

/** A refresh that failed while loaded data is on screen: the data stays, with this one quiet line instead of an error page. */
export function StaleNote() {
  return <Text variant="small" accessibilityRole="alert" testID="stale-note">Couldn’t refresh. Showing saved data.</Text>;
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
          <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={option.label} hitSlop={{ top: 3, bottom: 3 }}
            onPress={() => { if (!selected) { haptics.tick(); onChange(option.value); } }}
            style={{ flex: 1, minHeight: TARGET - 6, alignItems: "center", justifyContent: "center", borderRadius: radius.full, backgroundColor: selected ? colors.card : "transparent", paddingHorizontal: 10 }}>
            <Text variant="smallStrong" color={selected ? colors.foreground : colors.mutedForeground} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ textAlign: "center" }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The one on/off switch. On must read as on at a glance in both themes: the navy track the web uses
 * in light mode, and the school accent in dark mode, where the light primary under a white thumb
 * looked the same as off. Off is a quiet grey track. Every switch in the app goes through this.
 */
export function toggleTrack({ colors, dark }: Pick<ReturnType<typeof useTheme>, "colors" | "dark">) {
  return { on: dark ? colors.schoolAccent : colors.primary, off: dark ? colors.input : colors.muted };
}
export function Toggle({ value, onValueChange, disabled, accessibilityLabel, testID }: { value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean; accessibilityLabel: string; testID?: string }) {
  const { on, off } = toggleTrack(useTheme());
  return (
    <Switch testID={testID} accessibilityLabel={accessibilityLabel} accessibilityRole="switch" accessibilityState={{ checked: value, disabled: !!disabled }}
      value={value} disabled={disabled} onValueChange={next => { haptics.tick(); onValueChange(next); }}
      trackColor={{ true: on, false: off }} ios_backgroundColor={off} thumbColor="#ffffff" />
  );
}

const noRefresh = () => undefined;
/**
 * The pull-to-refresh control every screen and list uses. It spins only while the person's own pull runs:
 * `onRefresh` should return the refetches' promise, and the spinner stays until it settles. A query's own
 * background reloads (opening a screen, returning to it, after a save) never show it.
 * Pass `undefined` for a screen that can't be refreshed right now.
 */
export function usePullControl(onRefresh: (() => unknown) | undefined, top = 0) {
  const { colors } = useTheme();
  const pull = usePullRefresh(onRefresh ?? noRefresh);
  return onRefresh ? <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.mutedForeground} colors={[colors.primary]} progressBackgroundColor={colors.card} progressViewOffset={top} /> : undefined;
}

/**
 * The scrolling body of a screen: canvas colour, safe areas, pull-to-refresh, dock clearance, and a
 * focused field kept above the keyboard on both platforms.
 */
export function ScreenScroll({ children, onRefresh, dock, top = 0, contentStyle, ref, ...rest }: ScrollViewProps & { onRefresh?: () => unknown; dock?: boolean; top?: number; contentStyle?: ViewStyle; ref?: Ref<ScrollViewInstance> }) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useAndroidKeyboardInset();
  const refreshControl = usePullControl(onRefresh, top);
  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1, backgroundColor: colors.background, marginBottom: keyboard ? keyboard + insets.bottom : 0 }}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      contentContainerStyle={[{ paddingTop: top + space.control, paddingHorizontal: 16, paddingBottom: insets.bottom + (dock ? DOCK_CLEARANCE : 24), gap: space.content - 4 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      // The scroll bar runs between the floating header and the dock, not under them.
      scrollIndicatorInsets={{ top, bottom: dock ? DOCK_CLEARANCE : 0 }}
      refreshControl={refreshControl}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
