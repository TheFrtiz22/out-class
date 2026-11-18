/**
 * The OutClass branded QR code, as pure geometry: a React-Native-safe port of lib/qr/constants.ts and
 * lib/qr/renderer.ts (the web source; tests/shared-qr.test.cjs keeps the two in step). No DOM, no SVG
 * string: the native app draws these shapes with react-native-svg (mobile/src/components/qr-code.tsx).
 *
 * Rules carried over unchanged: error correction level H, a 4-module quiet zone, navy modules on a white
 * surface, rounded modules that merge with their neighbours, concentric circular finders (radii 3.5, 2.5,
 * 1.5 modules), and the OC monogram on a squircle badge whose modules are cleared.
 */
// The package's own matrix generator, the same one the web's `QRCode.create` calls (no canvas, no Node APIs).
// @ts-expect-error qrcode ships no types for its core entry; the shape used is declared below.
import * as core from "qrcode/lib/core/qrcode";

type CoreMatrix = { size: number; data: Uint8Array; get: (row: number, col: number) => number };
type Create = (payload: string, options: { errorCorrectionLevel: "L" | "M" | "Q" | "H" }) => { modules: CoreMatrix };
const create = ((core as { create?: Create; default?: { create: Create } }).create ?? (core as { default: { create: Create } }).default.create);

export const QR_NAVY = "#142d4e";
export const QR_IVORY = "#ffffff";
export const QR_QUIET_ZONE_MODULES = 4;
export const QR_ERROR_CORRECTION_LEVEL = "H" as const;
export const QR_MODULE_RADIUS = 0.45;
/** Proportions of the app-icon squircle the badge follows. */
export const QR_BADGE_VIEWBOX = 180;
export const QR_BADGE_CORNER_RADIUS_RATIO = 37 / 180;
/** The monogram is drawn at 95% of the badge, about its centre. */
export const QR_BADGE_ART_SCALE = 0.95;

/** The interlocking OC monogram (public/icon.svg), in the 180-unit badge box. Same paths as lib/qr/constants.ts. */
export const QR_MONOGRAM_PATHS = [
  "M101.141 53H136.632C151.023 53 162.689 64.6662 162.689 79.0573V112.904H148.112V79.0573C148.112 78.7105 148.098 78.3662 148.072 78.0251L112.581 112.898C112.701 112.902 112.821 112.904 112.941 112.904H148.112V126.672H112.941C98.5504 126.672 86.5638 114.891 86.5638 100.5V66.7434H101.141V100.5C101.141 101.15 101.191 101.792 101.289 102.422L137.56 66.7816C137.255 66.7563 136.945 66.7434 136.632 66.7434H101.141V53Z",
  "M65.2926 124.136L14 66.7372H34.6355L64.7495 100.436V66.7372H80.1365V118.47C80.1365 126.278 70.4953 129.958 65.2926 124.136Z",
] as const;

/** The raw module matrix for a payload at error correction H: `data[row * size + col]` is 1 for a dark module. */
export function qrModules(payload: string): { size: number; data: Uint8Array } {
  if (!payload) throw new Error("Payload is required to generate a QR code.");
  const { modules } = create(payload, { errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL });
  return { size: modules.size, data: modules.data };
}

/** The odd badge size, in modules, that stays clear of finders, format information and timing tracks. */
export function qrBadgeSize(size: number): number {
  if (size <= 21) return 3;
  if (size <= 29) return 5;
  if (size <= 45) return 7;
  return 9;
}

/** Whether a module belongs to one of the three 7x7 finder patterns. */
export function isQrFinder(row: number, col: number, size: number): boolean {
  if (row < 7 && col < 7) return true;
  if (row < 7 && col >= size - 7) return true;
  if (row >= size - 7 && col < 7) return true;
  return false;
}

// One module as a path, each corner rounded only where no neighbour joins it (lib/qr/renderer.ts generateCellPath).
function cellPath(x: number, y: number, rTL: number, rTR: number, rBR: number, rBL: number): string {
  let d = `M ${x + rTL} ${y} `;
  d += `L ${x + 1 - rTR} ${y} `;
  if (rTR > 0) d += `A ${rTR} ${rTR} 0 0 1 ${x + 1} ${y + rTR} `;
  d += `L ${x + 1} ${y + 1 - rBR} `;
  if (rBR > 0) d += `A ${rBR} ${rBR} 0 0 1 ${x + 1 - rBR} ${y + 1} `;
  d += `L ${x + rBL} ${y + 1} `;
  if (rBL > 0) d += `A ${rBL} ${rBL} 0 0 1 ${x} ${y + 1 - rBL} `;
  d += `L ${x} ${y + rTL} `;
  if (rTL > 0) d += `A ${rTL} ${rTL} 0 0 1 ${x + rTL} ${y} `;
  d += "Z";
  return d;
}

export type BrandedQr = {
  /** Modules per side, without the quiet zone. */
  size: number;
  margin: number;
  /** Side of the drawing in module units, quiet zone included: the SVG viewBox is `0 0 total total`. */
  total: number;
  /** Every data module (finders and the badge area excluded) as one path. */
  modulePath: string;
  /** Centres of the three finders; each is drawn as circles of radius 3.5 (dark), 2.5 (light), 1.5 (dark). */
  finders: { cx: number; cy: number }[];
  /** The monogram badge: a rounded square at (x, y) and the scale from the 180-unit monogram box. Null without a logo. */
  badge: { x: number; y: number; size: number; cornerRadius: number; scale: number } | null;
};

/** The branded code for a payload, in module units. Matches `generateOutClassQRSVG` with its default options. */
export function brandedQr(payload: string, options: { showLogo?: boolean; margin?: number } = {}): BrandedQr {
  const { size, data } = qrModules(payload);
  const margin = options.margin ?? QR_QUIET_ZONE_MODULES;
  const showLogo = options.showLogo !== false;
  const badgeSize = showLogo ? qrBadgeSize(size) : 0;
  const badgeStart = Math.floor((size - badgeSize) / 2);
  const badgeEnd = badgeStart + badgeSize;
  const dark = (row: number, col: number) => {
    if (row < 0 || row >= size || col < 0 || col >= size) return false;
    if (isQrFinder(row, col, size)) return false;
    if (badgeSize > 0 && row >= badgeStart && row < badgeEnd && col >= badgeStart && col < badgeEnd) return false;
    return data[row * size + col] === 1;
  };
  const paths: string[] = [];
  const radius = QR_MODULE_RADIUS;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!dark(row, col)) continue;
      const top = dark(row - 1, col), bottom = dark(row + 1, col), left = dark(row, col - 1), right = dark(row, col + 1);
      paths.push(cellPath(col + margin, row + margin, !top && !left ? radius : 0, !top && !right ? radius : 0, !bottom && !right ? radius : 0, !bottom && !left ? radius : 0));
    }
  }
  const finder = (originX: number, originY: number) => ({ cx: originX + margin + 3.5, cy: originY + margin + 3.5 });
  return {
    size,
    margin,
    total: size + margin * 2,
    modulePath: paths.join(" "),
    finders: [finder(0, 0), finder(size - 7, 0), finder(0, size - 7)],
    badge: badgeSize > 0 ? { x: badgeStart + margin, y: badgeStart + margin, size: badgeSize, cornerRadius: badgeSize * QR_BADGE_CORNER_RADIUS_RATIO, scale: badgeSize / QR_BADGE_VIEWBOX } : null,
  };
}
