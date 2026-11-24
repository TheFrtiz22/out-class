/**
 * The OutClass branded QR code, as pure geometry: a React-Native-safe port of lib/qr/constants.ts and
 * lib/qr/renderer.ts (the web source; tests/shared-qr.test.cjs keeps the two in step). No DOM, no SVG
 * string: the native app draws these shapes with react-native-svg (mobile/src/components/qr-code.tsx).
 *
 * Rules carried over unchanged: error correction level H, a 4-module quiet zone, navy modules on a white
 * surface, rounded modules that merge with their neighbours, concentric circular finders (radii 3.5, 2.5,
 * 1.5 modules), and the OutClass mark (the app icon's OC monogram) on a squircle badge whose modules are cleared.
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
/**
 * The OutClass mark (public/brand/premium-board/11_app_icon_white.svg, the app icon's ivory OC monogram) as one
 * even-odd path in its own coordinates, and the transform that centres it in the 180-unit badge box. Same values as
 * lib/qr/constants.ts OC_MARK_PATH and OC_MARK_TRANSFORM.
 */
export const QR_MARK_PATH =
  "M102.27 141.01 C89.79 138.36 80.47 130.62 76.44 119.57 C75.5 117.01 74.62 116.49 69.24 115.4 C60.83 113.68 56.3 111.35 50.89 105.97 C44.54 99.64 41.66 92.01 41.66 81.5 C41.66 71.35 44.37 64.03 50.74 56.94 C59.41 47.31 67.45 43.88 81.46 43.88 C99.18 43.87 110 51.18 114.65 66.29 L116.34 71.76 121.52 72.37 C124.37 72.71 128.64 73.67 131.01 74.5 C134.94 75.89 135.48 75.88 137.16 74.35 C138.18 73.43 139.17 72.86 139.37 73.09 C140.24 74.1 140.88 96.13 140.03 95.83 C139.52 95.65 137.39 92.12 135.3 88 C131.11 79.73 126.2 75.39 119.87 74.37 L116.28 73.78 115.79 81.36 C114.92 94.99 106.2 107.82 94.55 112.64 C90.6 114.28 90.15 114.78 90.66 116.99 C96.83 143.72 126.26 147.1 138.23 122.46 C140.66 117.47 142.36 116.56 141.43 120.75 C139.4 129.95 137.76 134.11 135.6 135.52 C128.26 140.33 111.82 143.04 102.27 141.01 Z M74.6 106.25 C74.73 96.89 76.99 91.13 83.18 84.42 C87.63 79.59 96.22 74.03 99.25 74.01 C102.92 73.99 100.2 61.34 94.98 54.13 C84.64 39.85 66.7 43.64 60.07 61.49 C54.4 76.77 56.32 98.46 64.21 108.12 C65.76 110.02 72.05 113.99 73.5 113.99 C74.07 113.99 74.54 110.68 74.6 106.25 Z M94.53 107.13 C98.74 100.77 101.08 93.23 101.69 84.08 L102.25 75.5 98.1 79.48 C95.06 82.4 93.44 85.09 92.1 89.48 C88.83 100.16 88.31 111 91.05 111 C91.56 111 93.12 109.26 94.53 107.13 Z";
const QR_MARK_CENTER = { x: 91.65, y: 92.75 };
const QR_MARK_SCALE = (QR_BADGE_VIEWBOX / 175) * 1.168;
export const QR_MARK_TRANSFORM = `translate(${QR_BADGE_VIEWBOX / 2} ${QR_BADGE_VIEWBOX / 2}) scale(${QR_MARK_SCALE}) translate(${-QR_MARK_CENTER.x} ${-QR_MARK_CENTER.y})`;

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
