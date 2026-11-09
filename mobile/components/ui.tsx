import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Bell, MagnifyingGlass } from "phosphor-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import { lockupOnLight, lockupOnNavy } from "@/assets/brand/logos";
import { font, hit, navyDepth, navyGradient, radius, space, text, useTheme } from "@/theme/tokens";

/* Building blocks that reproduce the web's surfaces. Colors come only from the theme. */

export function Logo({ onNavy, width = 132 }: { onNavy?: boolean; width?: number }) {
  const t = useTheme();
  const light = onNavy || t.scheme === "dark";
  return <SvgXml accessibilityLabel="OutClass" xml={light ? lockupOnNavy : lockupOnLight} width={width} height={width * (light ? 258 / 1079 : 141 / 457)} />;
}

export function Eyebrow({ children, color, style }: { children: ReactNode; color?: string; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[text.eyebrow, { color: color ?? t.muted }, style]}>{children}</Text>;
}

export function Display({ children, size = "title", style, color }: { children: ReactNode; size?: "hero" | "title" | "cardTitle"; style?: TextStyle; color?: string }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[text[size], { color: color ?? t.ink }, style]}>{children}</Text>;
}

/** Ivory card: the web's page card (raised ivory, white top edge, soft navy shadow). */
export function Surface({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.surface, { backgroundColor: t.surface, borderColor: t.edge, boxShadow: t.shadow }, padded && { padding: space.xl }, style]}>
      {children}
    </View>
  );
}

/** Navy glass panel, as on the web dock and the sign-in sample card. */
export function NavyPanel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.navyPanel, { boxShadow: navyDepth }, style]}>
      <LinearGradient colors={navyGradient} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(147,188,224,0.18)", "rgba(147,188,224,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 0.5 }} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, loading, arrow = true }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; arrow?: boolean }) {
  const t = useTheme();
  const ivory = t.scheme === "dark";
  const fg = ivory ? "#142d45" : "#fff9f1";
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || loading }} disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.55 : 1, transform: [{ scale: pressed ? 0.985 : 1 }], boxShadow: disabled ? undefined : navyDepth }]}>
      <LinearGradient colors={disabled ? ["#8793a0", "#7d8996"] : ivory ? ["#fffdf8", "#ece8df"] : navyGradient} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={styles.buttonRow}>
          <Text style={[text.bodyStrong, { color: fg }]}>{label}</Text>
          {arrow ? <ArrowRight size={15} color={fg} weight="bold" /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** Raised ivory pill, as on "Agenda & resources" / "Explore clubs". */
export function SecondaryButton({ label, onPress, icon, compact }: { label: string; onPress: () => void; icon?: ReactNode; compact?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={compact ? hit(38) : undefined}
      style={({ pressed }) => [styles.button, compact && styles.compact, { backgroundColor: t.raised, borderColor: t.edge, borderWidth: 1, boxShadow: t.shadowRaised, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      <View style={styles.buttonRow}>{icon}<Text style={[text.bodyStrong, { color: t.ink }]}>{label}</Text></View>
    </Pressable>
  );
}

export function TextLink({ label, onPress, arrow = true, color }: { label: string; onPress: () => void; arrow?: boolean; color?: string }) {
  const t = useTheme();
  const c = color ?? t.ink;
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={styles.link}>
      <Text style={[text.label, { color: c, fontSize: 15 }]}>{label}</Text>
      {arrow ? <ArrowRight size={15} color={c} /> : null}
    </Pressable>
  );
}

/** Round ivory header button, as in the web's top-right cluster. */
export function RoundButton({ label, children, onPress, dot }: { label: string; children: ReactNode; onPress?: () => void; dot?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={hit(38)}
      style={[styles.round, { backgroundColor: t.raised, borderColor: t.edge, boxShadow: t.shadowRaised }]}>
      {children}
      {dot ? <View style={[styles.dot, { backgroundColor: t.accent, borderColor: t.raised }]} /> : null}
    </Pressable>
  );
}

export function Initials({ name, size = 40 }: { name: string; size?: number }) {
  const t = useTheme();
  const letters = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.scheme === "dark" ? t.raised : "#e6e9e5" }]}>
      <Text style={{ fontFamily: font.textSemibold, fontSize: size * 0.36, color: t.inkSoft }}>{letters}</Text>
    </View>
  );
}

/** The header every tab shares: actions top-right, serif title, optional line below. */
export function ScreenHeader({ title, eyebrow, subtitle, accountName }: { title: string; eyebrow?: string; subtitle?: string; accountName?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: space.lg }}>
      <View style={styles.actions}>
        <View style={{ flex: 1 }}><Logo width={104} /></View>
        <RoundButton label="Search"><MagnifyingGlass size={18} color={t.ink} /></RoundButton>
        <RoundButton label="Notifications" dot><Bell size={18} color={t.ink} /></RoundButton>
        {accountName ? <Initials name={accountName} size={38} /> : null}
      </View>
      {eyebrow ? <Eyebrow style={{ marginBottom: space.sm }}>{eyebrow}</Eyebrow> : null}
      <Display size="hero">{title}</Display>
      {subtitle ? <Text style={[text.body, { color: t.muted, marginTop: space.sm }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={[text.section, { color: t.ink }]}>{title}</Text>
      {action}
    </View>
  );
}

/** Navy calendar tile, as on the web's meeting rows. */
export function DateTile({ date, size = 50 }: { date: Date; size?: number }) {
  return (
    <View style={[styles.dateTile, { width: size, height: size }]}>
      <LinearGradient colors={navyGradient} style={StyleSheet.absoluteFill} />
      <Text style={{ fontFamily: font.textSemibold, fontSize: size * 0.2, color: "#fff9f1", letterSpacing: 0.6 }}>{date.toLocaleDateString("en-US", { month: "short", timeZone: "America/New_York" }).toUpperCase()}</Text>
      <Text style={{ fontFamily: font.display, fontSize: size * 0.4, lineHeight: size * 0.46, color: "#fff9f1" }}>{date.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/New_York" })}</Text>
    </View>
  );
}

/** Club mark: logo image when set, otherwise an ivory tile with the club's initials. */
export function ClubTile({ name, logoText, size = 56 }: { name: string; logoText?: string; size?: number }) {
  const t = useTheme();
  const letters = (logoText || name.split(/\s+/).map((w) => w[0]).join("")).slice(0, 3).toUpperCase();
  return (
    <View style={[styles.clubTile, { width: size, height: size, borderRadius: size * 0.27, backgroundColor: t.scheme === "dark" ? t.raised : "#fffdf8", borderColor: t.hairline, boxShadow: t.shadowRaised }]}>
      <Text style={{ fontFamily: font.textSemibold, fontSize: size * 0.3, color: t.ink, letterSpacing: 0.4 }}>{letters}</Text>
    </View>
  );
}

export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" | "success" | "info" | "outline" }) {
  const t = useTheme();
  const [bg, fg] = {
    neutral: [t.scheme === "dark" ? t.raised : "#eceee9", t.inkSoft],
    accent: [t.accentSubtle, t.accentInk],
    success: [t.successSubtle, t.success],
    info: [t.infoSubtle, t.info],
    outline: ["transparent", t.inkSoft],
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }, tone === "outline" && { borderWidth: 1, borderColor: t.hairline }]}>
      <Text style={[text.label, { color: fg, fontSize: 12 }]}>{label}</Text>
    </View>
  );
}

/** Segmented control: ivory track, navy glass selection (web Board/List, All Events). */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: t.raised, borderColor: t.edge, boxShadow: t.shadowRaised }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} hitSlop={hit(36)} style={[styles.segment, on && { boxShadow: navyDepth }]}>
            {on ? <LinearGradient colors={navyGradient} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} /> : null}
            <Text style={[text.label, { fontSize: 14, color: on ? "#fff9f1" : t.ink }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: radius.lg, borderWidth: 1, borderCurve: "continuous" },
  navyPanel: { borderRadius: radius.lg, overflow: "hidden", padding: space.xl, borderCurve: "continuous" },
  button: { minHeight: 46, borderRadius: radius.pill, overflow: "hidden", alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  compact: { minHeight: 38, alignSelf: "flex-start", paddingHorizontal: space.lg },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  link: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  round: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 7, right: 8, width: 8, height: 8, borderRadius: 5, borderWidth: 1.5 },
  initials: { alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xl },
  sectionRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm },
  dateTile: { borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  clubTile: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderCurve: "continuous" },
  pill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  segmented: { flexDirection: "row", padding: 4, borderRadius: radius.pill, borderWidth: 1 },
  segment: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, overflow: "hidden" },
});
