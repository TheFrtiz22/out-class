import { View } from "react-native";
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath } from "react-native-svg";
import { PrivateImage } from "~/components/private-image";
import { Text } from "~/components/text";
import { fonts, useTheme } from "~/lib/theme";
import type { LetterContent } from "~/lib/types";

const MINOR_WORDS = new Set(["of", "the", "and", "at", "for", "in", "a", "an", "&"]);
/** Up to three initials for the seal, skipping minor words ("Club of Investing" -> "CI"). */
function clubMonogram(name: string) {
  const words = name.split(/\s+/).filter(word => word && !MINOR_WORDS.has(word.toLowerCase()));
  return (words.length ? words : [name]).slice(0, 3).map(word => Array.from(word.replace(/[^\p{L}\p{N}]/gu, ""))[0] ?? "").join("").toUpperCase() || "OC";
}

/** Seal beside the signature: club initials inside a ring of the club name. Decorative. */
function LetterSeal({ clubName, color }: { clubName: string; color: string }) {
  const ring = `${clubName.length > 34 ? clubName.slice(0, 33) + "…" : clubName} · Recruitment · `.toUpperCase();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={92} height={92} viewBox="0 0 120 120">
        <Defs><Path id="seal-ring" d="M60 60 m-43 0 a43 43 0 1 1 86 0 a43 43 0 1 1 -86 0" /></Defs>
        <Circle cx={60} cy={60} r={57} fill="none" stroke={color} strokeWidth={1.5} />
        <Circle cx={60} cy={60} r={52} fill="none" stroke={color} strokeWidth={0.75} />
        <Circle cx={60} cy={60} r={33} fill="none" stroke={color} strokeWidth={0.75} />
        <SvgText fill={color} fontSize={8.5} fontFamily={fonts.sansSemibold} letterSpacing={1.2}>
          <TextPath href="#seal-ring" startOffset="0%">{ring}</TextPath>
        </SvgText>
        <SvgText x={60} y={68} textAnchor="middle" fill={color} fontSize={22} fontFamily={fonts.display}>{clubMonogram(clubName)}</SvgText>
      </Svg>
    </View>
  );
}

/**
 * The formal decision letter (web: LetterPaper in components/communications/decision-letter.tsx).
 * The published letter is structured text: title, body paragraphs separated by blank lines,
 * closing, signer and footer, rendered natively.
 */
export function LetterPaper({ content, logo }: { content: LetterContent; logo?: { applicationId: string; letterId: string } }) {
  const { colors, radius, dark } = useTheme();
  // The club's accent marks the letter on paper; on the dark surface it would not be legible.
  const accent = !dark && /^#[\da-f]{6}$/i.test(content.accent) ? content.accent : colors.foreground;
  return (
    <View accessibilityLabel="Formal decision letter" testID="decision-letter" style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 22, paddingVertical: 28, gap: 18 }}>
      <View style={{ alignItems: "center", gap: 4 }}>
        {/* The logo published with this letter (web: /api/decision-letter-assets). Nothing shows when there is none. */}
        {logo && content.logoReference ? <PrivateImage kind="decision-letter-assets" params={logo} contentFit="contain" accessibilityLabel={`${content.clubName} logo`} style={{ width: 72, height: 72, borderRadius: radius.md, marginBottom: 8 }} /> : null}
        <Text variant="eyebrow" align="center" color={accent}>{content.clubName}</Text>
        <Text variant="caption" align="center">Recruitment correspondence</Text>
        <View style={{ width: 56, height: 2, backgroundColor: accent, marginTop: 10 }} />
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="small">{content.date}</Text>
        <Text variant="small"><Text variant="eyebrow">To  </Text>{content.studentName}</Text>
      </View>
      <Text variant="title" accessibilityRole="header">{content.title}</Text>
      <Text variant="body">Dear {content.studentName},</Text>
      <View style={{ gap: 14 }}>
        {content.body.split(/\n\s*\n/).map((paragraph, index) => <Text key={index} variant="body" selectable style={{ lineHeight: 26 }}>{paragraph}</Text>)}
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 6 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text variant="body">{content.closing}</Text>
          <View style={{ height: 1, width: 150, maxWidth: "100%", backgroundColor: colors.border, marginTop: 22 }} />
          {content.signer ? <Text variant="card" style={{ fontFamily: fonts.display }}>{content.signer}</Text> : null}
        </View>
        <LetterSeal clubName={content.clubName} color={accent} />
      </View>
      {content.footer ? <Text variant="small">{content.footer}</Text> : null}
      <Text variant="caption" align="center" style={{ marginTop: 4 }}>Delivered securely through OutClass</Text>
    </View>
  );
}
