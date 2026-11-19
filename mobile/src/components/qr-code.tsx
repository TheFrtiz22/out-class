import { QR_BADGE_ART_SCALE, QR_BADGE_VIEWBOX, QR_IVORY, QR_MONOGRAM_PATHS, QR_NAVY, brandedQr } from "@outclass/shared/qr";
import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { Text } from "~/components/text";
import { useTheme } from "~/lib/theme";

/**
 * The OutClass branded QR code (components/qr/outclass-qr-code.tsx, compact variant): level-H modules in
 * brand navy with rounded, merging corners, circular finders, and the OC monogram on its squircle badge.
 * It always sits on its own white surface with a 12pt frame, in light and dark mode alike, so it scans.
 * Geometry comes from packages/shared/src/qr.ts, the port of the web's lib/qr.
 */
export function QrCode({ value, size = 240, label, showLogo = true, testID }: { value: string; size?: number; label: string; showLogo?: boolean; testID?: string }) {
  const qr = useMemo(() => { try { return value ? brandedQr(value, { showLogo }) : null; } catch { return null; } }, [value, showLogo]);
  const { colors } = useTheme();
  const inner = size - 24;
  const centre = QR_BADGE_VIEWBOX / 2;
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={label}
      style={{ width: size, height: size, padding: 12, borderRadius: 16, backgroundColor: QR_IVORY, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
      {qr ? (
        <Svg width={inner} height={inner} viewBox={`0 0 ${qr.total} ${qr.total}`}>
          <Rect width={qr.total} height={qr.total} fill={QR_IVORY} />
          <Path d={qr.modulePath} fill={QR_NAVY} />
          {qr.finders.map(({ cx, cy }) => (
            <G key={`${cx}:${cy}`}>
              <Circle cx={cx} cy={cy} r={3.5} fill={QR_NAVY} />
              <Circle cx={cx} cy={cy} r={2.5} fill={QR_IVORY} />
              <Circle cx={cx} cy={cy} r={1.5} fill={QR_NAVY} />
            </G>
          ))}
          {qr.badge ? (
            <>
              <Rect x={qr.badge.x} y={qr.badge.y} width={qr.badge.size} height={qr.badge.size} rx={qr.badge.cornerRadius} fill={QR_NAVY} />
              <G transform={`translate(${qr.badge.x} ${qr.badge.y}) scale(${qr.badge.scale}) translate(${centre} ${centre}) scale(${QR_BADGE_ART_SCALE}) translate(${-centre} ${-centre})`}>
                {QR_MONOGRAM_PATHS.map(d => <Path key={d} d={d} fill={QR_IVORY} />)}
              </G>
            </>
          ) : null}
        </Svg>
      ) : <Text variant="caption" color={QR_NAVY} accessibilityRole="text">Preparing QR code…</Text>}
    </View>
  );
}
