import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";
import { useTheme } from "~/lib/theme";

const liquid = Platform.OS === "ios" && (() => { try { return isLiquidGlassAvailable(); } catch { return false; } })();

/**
 * The OutClass glass material (styles/navigation-glass.css) on native: Liquid Glass where the
 * system has it, a blur elsewhere, and a solid surface under Reduce Transparency. The header and
 * dock sit on this; content surfaces stay solid.
 */
export function Glass({ children, style, radius, ...rest }: ViewProps & { radius?: number }) {
  const { colors, dark, a11y } = useTheme();
  const shape = { borderRadius: radius ?? 0, overflow: "hidden" as const };
  const edge = { borderWidth: StyleSheet.hairlineWidth, borderColor: dark ? "rgba(255,255,255,0.14)" : "rgba(35,45,75,0.10)" };
  if (a11y.reduceTransparency) return <View {...rest} style={[shape, edge, { backgroundColor: colors.card }, style]}>{children}</View>;
  if (liquid) return <GlassView {...rest} glassEffectStyle="regular" style={[shape, style]}>{children}</GlassView>;
  return (
    <View {...rest} style={[shape, edge, style]}>
      <BlurView intensity={Platform.OS === "android" ? 28 : 48} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? "rgba(22,38,56,0.62)" : "rgba(255,254,250,0.66)" }]} />
      {children}
    </View>
  );
}
