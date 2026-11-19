import { Text as NativeText, type TextProps as NativeTextProps, type TextStyle } from "react-native";
import { fonts, useTheme } from "~/lib/theme";

/**
 * The type scale from styles/tokens.css and styles/typography.css. Caslon for titles and names,
 * Source Sans for everything operational. Text scales with Dynamic Type / Android font scale;
 * display sizes cap sooner so a large setting never pushes a title off the screen.
 */
export type TextVariant = "display" | "title" | "section" | "card" | "body" | "bodyStrong" | "small" | "smallStrong" | "caption" | "eyebrow" | "metric" | "button";
type Props = NativeTextProps & { variant?: TextVariant; color?: string; align?: TextStyle["textAlign"] };

export function Text({ variant = "body", color, align, style, maxFontSizeMultiplier, ...rest }: Props) {
  const theme = useTheme();
  const { text, tracking, leading, colors } = theme;
  const styles: Record<TextVariant, TextStyle> = {
    display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 32 * leading.display, letterSpacing: 32 * tracking.display, color: colors.foreground },
    title: { fontFamily: fonts.display, fontSize: text.title, lineHeight: text.title * leading.heading, letterSpacing: text.title * tracking.title, color: colors.foreground },
    section: { fontFamily: fonts.display, fontSize: text.section, lineHeight: text.section * leading.subheading, letterSpacing: text.section * tracking.section, color: colors.foreground },
    card: { fontFamily: fonts.sansSemibold, fontSize: text.card, lineHeight: text.card * leading.subheading, letterSpacing: text.card * tracking.card, color: colors.foreground },
    body: { fontFamily: fonts.sans, fontSize: text.body, lineHeight: text.body * leading.body, color: colors.foreground },
    bodyStrong: { fontFamily: fonts.sansSemibold, fontSize: text.body, lineHeight: text.body * leading.compact, color: colors.foreground },
    small: { fontFamily: fonts.sans, fontSize: text.small, lineHeight: text.small * leading.compact, color: colors.mutedForeground },
    smallStrong: { fontFamily: fonts.sansSemibold, fontSize: text.small, lineHeight: text.small * leading.compact, color: colors.foreground },
    caption: { fontFamily: fonts.sans, fontSize: text.caption, lineHeight: text.caption * leading.compact, color: colors.mutedForeground },
    eyebrow: { fontFamily: fonts.sansSemibold, fontSize: text.caption, lineHeight: text.caption * leading.compact, letterSpacing: text.caption * tracking.caps, textTransform: "uppercase", color: colors.mutedForeground },
    metric: { fontFamily: fonts.display, fontSize: text.metric, lineHeight: text.metric * leading.heading, color: colors.foreground, fontVariant: ["tabular-nums"] },
    button: { fontFamily: fonts.sansSemibold, fontSize: text.body, lineHeight: text.body * leading.compact, color: colors.foreground },
  };
  const large = variant === "display" || variant === "title" || variant === "metric";
  return (
    <NativeText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (large ? 1.5 : 2.2)}
      {...rest}
      style={[styles[variant], color ? { color } : null, align ? { textAlign: align } : null, style]}
    />
  );
}
