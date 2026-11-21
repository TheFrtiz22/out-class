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
  // Liquid Glass alone is clear enough that text scrolling underneath competes with the labels on top;
  // a light wash of the surface colour keeps the header and dock legible, as the web's glass tint does.
  if (liquid) return (
    <GlassView {...rest} glassEffectStyle="regular" style={[shape, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: dark ? "rgba(22,38,56,0.46)" : "rgba(255,254,250,0.58)" }]} />
      {children}
    </GlassView>
  );
  // Android's BlurView draws only a translucent wash unless it is given a separate blur target, so text
  // scrolling under the dock showed through the labels. A near-solid surface keeps it legible there.
  if (Platform.OS === "android") return (
    <View {...rest} style={[shape, edge, { backgroundColor: dark ? "rgba(22,38,56,0.94)" : "rgba(255,254,250,0.94)" }, style]}>
      {children}
    </View>
  );
  return (
    <View {...rest} style={[shape, edge, style]}>
      <BlurView intensity={48} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: dark ? "rgba(22,38,56,0.62)" : "rgba(255,254,250,0.66)" }]} />
      {children}
    </View>
  );
}
