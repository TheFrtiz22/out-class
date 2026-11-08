import type { ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { radius, space, type, useTheme } from "@/theme/tokens";

/** Small shared building blocks. Colors always come from the theme so light and dark stay in step. */

export function Title({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[type.largeTitle, { color: t.foreground }, style]}>{children}</Text>;
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Text accessibilityRole="header" style={[type.title, { color: t.foreground }]}>{title}</Text>
        {action}
      </View>
      {subtitle ? <Text style={[type.body, { color: t.mutedForeground, marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

export function Chip({ label, tone = "muted" }: { label: string; tone?: "muted" | "brand" | "success" | "info" }) {
  const t = useTheme();
  const colors = {
    muted: [t.muted, t.secondaryForeground],
    brand: [t.brandSubtle, t.brandInk],
    success: [t.successSubtle, t.success],
    info: [t.infoSubtle, t.info],
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: colors[0] }]}>
      <Text style={[type.caption, { color: colors[1] }]}>{label}</Text>
    </View>
  );
}

export function Button({ label, onPress, disabled, loading, variant = "primary" }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: "primary" | "secondary" }) {
  const t = useTheme();
  const bg = variant === "primary" ? t.primary : t.secondary;
  const fg = variant === "primary" ? t.primaryForeground : t.secondaryForeground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[type.headline, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

/** Club logo, or its initials on the club color when no logo is set. */
export function ClubMark({ name, logoUrl, color, size = 48 }: { name: string; logoUrl?: string | null; color?: string | null; size?: number }) {
  const t = useTheme();
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 3).join("");
  const frame = { width: size, height: size, borderRadius: size * 0.28, borderColor: t.border };
  if (logoUrl) return <Image accessibilityIgnoresInvertColors source={{ uri: logoUrl }} style={[styles.mark, frame, { backgroundColor: "#fff" }]} />;
  return (
    <View style={[styles.mark, frame, { backgroundColor: color || t.primary }]}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.32 }}>{initials}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[type.headline, { color: t.foreground, textAlign: "center" }]}>{title}</Text>
      {body ? <Text style={[type.body, { color: t.mutedForeground, textAlign: "center", marginTop: space.sm }]}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl, marginBottom: space.md },
  sectionRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  chip: { alignSelf: "flex-start", paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.sm },
  button: { minHeight: 50, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  mark: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  empty: { paddingVertical: space.xxl, paddingHorizontal: space.xl },
});
