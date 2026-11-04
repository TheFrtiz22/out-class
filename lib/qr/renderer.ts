/**
 * OutClass Universal Branded QR Code Rendering Engine
 *
 * Implements high-precision vector SVG rendering with:
 * - Error correction level H (30% recovery)
 * - Deep OutClass navy branding
 * - Organic rounded modules with smooth connected pill/capsule shapes
 * - Concentric circular finder patterns (1:1:3:1:1 radial ratio)
 * - Centered OutClass OC monogram in an Apple-style squircle badge
 * - Dynamic badge scaling and pattern protection
 * - 4-module quiet zone
 * - Lightweight memoized generation
 */

import * as QRCodeNamespace from "qrcode";
import type { QRCode as QRCodeType } from "qrcode";

const QRCode =
  (QRCodeNamespace as unknown as { default?: typeof QRCodeNamespace }).default ||
  QRCodeNamespace;
import {
  BRAND_NAVY,
  BRAND_IVORY,
  DEFAULT_QUIET_ZONE_MODULES,
  ERROR_CORRECTION_LEVEL,
  APP_ICON_CORNER_RADIUS_RATIO,
  OC_MONOGRAM_PATHS,
} from "@/lib/qr/constants";

export interface QRCodeRenderOptions {
  fgColor?: string;
  bgColor?: string;
  margin?: number;
  showLogo?: boolean;
  badgeSize?: number;
  badgeBgColor?: string;
  badgeFgColor?: string;
  roundedModules?: boolean;
  moduleRadius?: number;
  circularFinders?: boolean;
  title?: string;
  ariaLabel?: string;
}

export interface QRCodeMatrixData {
  size: number;
  margin: number;
  totalSize: number;
  badgeSize: number;
  badgeStart: number;
  qr: QRCodeType;
}

/** Cache matrix calculations to ensure lightweight, instantaneous rendering */
const matrixCache = new Map<string, QRCodeType>();
const MAX_CACHE_SIZE = 100;

function getCachedQRCode(payload: string): QRCodeType {
  const cached = matrixCache.get(payload);
  if (cached) return cached;

  const qr = QRCode.create(payload, {
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
  });

  if (matrixCache.size >= MAX_CACHE_SIZE) {
    const firstKey = matrixCache.keys().next().value;
    if (firstKey) matrixCache.delete(firstKey);
  }
  matrixCache.set(payload, qr);
  return qr;
}

/**
 * Calculate the safest odd-sized badge dimension based on matrix size.
 * Keeps logo area under ~5% of matrix modules while strictly protecting
 * finder patterns, separators, format information, and timing tracks.
 */
export function getSafeBadgeSize(size: number): number {
  if (size <= 21) return 3;
  if (size <= 29) return 5;
  if (size <= 45) return 7;
  return 9;
}

/**
 * Check if module coordinate (r, c) belongs to one of the three 7x7 finder patterns.
 */
export function isFinderPattern(r: number, c: number, size: number): boolean {
  if (r < 7 && c < 7) return true; // Top-left
  if (r < 7 && c >= size - 7) return true; // Top-right
  if (r >= size - 7 && c < 7) return true; // Bottom-left
  return false;
}

/**
 * Generate a single module cell path with individualized corner radii.
 * When neighboring modules connect, shared edges have radius 0 for seamless merging.
 */
function generateCellPath(
  x: number,
  y: number,
  w: number,
  h: number,
  rTL: number,
  rTR: number,
  rBR: number,
  rBL: number,
): string {
  let d = `M ${x + rTL} ${y} `;
  d += `L ${x + w - rTR} ${y} `;
  if (rTR > 0) d += `A ${rTR} ${rTR} 0 0 1 ${x + w} ${y + rTR} `;
  d += `L ${x + w} ${y + h - rBR} `;
  if (rBR > 0) d += `A ${rBR} ${rBR} 0 0 1 ${x + w - rBR} ${y + h} `;
  d += `L ${x + rBL} ${y + h} `;
  if (rBL > 0) d += `A ${rBL} ${rBL} 0 0 1 ${x} ${y + h - rBL} `;
  d += `L ${x} ${y + rTL} `;
  if (rTL > 0) d += `A ${rTL} ${rTL} 0 0 1 ${x + rTL} ${y} `;
  d += "Z";
  return d;
}

/**
 * Renders concentric circular finder pattern (1:1:3:1:1 radial ratio).
 */
function renderCircularFinder(
  originX: number,
  originY: number,
  margin: number,
  fgColor: string,
  bgColor: string,
): string {
  const cx = originX + margin + 3.5;
  const cy = originY + margin + 3.5;
  return `
    <circle cx="${cx}" cy="${cy}" r="3.5" fill="${fgColor}" />
    <circle cx="${cx}" cy="${cy}" r="2.5" fill="${bgColor}" />
    <circle cx="${cx}" cy="${cy}" r="1.5" fill="${fgColor}" />
  `;
}

/**
 * Renders the centered OutClass OC monogram badge.
 */
function renderCenterBadge(
  badgeStart: number,
  badgeSize: number,
  margin: number,
  badgeBgColor: string,
  badgeFgColor: string,
): string {
  if (badgeSize <= 0) return "";
  const bx = badgeStart + margin;
  const by = badgeStart + margin;
  const bw = badgeSize;
  const bh = badgeSize;
  const rx = bw * APP_ICON_CORNER_RADIUS_RATIO;
  const scale = bw / 180;

  return `
    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${rx}" fill="${badgeBgColor}" />
    <g transform="translate(${bx}, ${by}) scale(${scale})">
      <g style="transform: scale(95%); transform-origin: center">
        <path fill="${badgeFgColor}" d="${OC_MONOGRAM_PATHS[0]}" />
        <path fill="${badgeFgColor}" d="${OC_MONOGRAM_PATHS[1]}" />
      </g>
    </g>
  `;
}

/**
 * Generate the complete branded SVG string for a given payload.
 */
export function generateOutClassQRSVG(
  payload: string,
  options: QRCodeRenderOptions = {},
): string {
  if (!payload) {
    throw new Error("Payload is required to generate a QR code.");
  }

  const fg = options.fgColor || BRAND_NAVY;
  const bg = options.bgColor || BRAND_IVORY;
  const margin =
    options.margin !== undefined
      ? options.margin
      : DEFAULT_QUIET_ZONE_MODULES;
  const showLogo = options.showLogo !== false;
  const rounded = options.roundedModules !== false;
  const radius = options.moduleRadius !== undefined ? options.moduleRadius : 0.45;
  const circularFinders = options.circularFinders !== false;

  const qr = getCachedQRCode(payload);
  const size = qr.modules.size;
  const total = size + margin * 2;

  // Determine badge dimensions
  const badgeSize = showLogo
    ? options.badgeSize || getSafeBadgeSize(size)
    : 0;
  const badgeStart = Math.floor((size - badgeSize) / 2);
  const badgeEnd = badgeStart + badgeSize;

  const isBadge = (r: number, c: number): boolean => {
    if (!showLogo || badgeSize === 0) return false;
    return r >= badgeStart && r < badgeEnd && c >= badgeStart && c < badgeEnd;
  };

  const isDark = (r: number, c: number): boolean => {
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
    if (isFinderPattern(r, c, size) || isBadge(r, c)) return false;
    return qr.modules.get(r, c) === 1;
  };

  const modulePaths: string[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isDark(r, c)) continue;

      if (!rounded) {
        modulePaths.push(
          `M ${c + margin} ${r + margin} h 1 v 1 h -1 Z`,
        );
        continue;
      }

      const top = isDark(r - 1, c);
      const bottom = isDark(r + 1, c);
      const left = isDark(r, c - 1);
      const right = isDark(r, c + 1);

      const rTL = !top && !left ? radius : 0;
      const rTR = !top && !right ? radius : 0;
      const rBR = !bottom && !right ? radius : 0;
      const rBL = !bottom && !left ? radius : 0;

      modulePaths.push(
        generateCellPath(c + margin, r + margin, 1, 1, rTL, rTR, rBR, rBL),
      );
    }
  }

  // Finder pattern rendering
  let findersSvg = "";
  if (circularFinders) {
    findersSvg += renderCircularFinder(0, 0, margin, fg, bg);
    findersSvg += renderCircularFinder(size - 7, 0, margin, fg, bg);
    findersSvg += renderCircularFinder(0, size - 7, margin, fg, bg);
  } else {
    // Standard square finders fallback
    const renderSquareFinder = (ox: number, oy: number) => {
      const x = ox + margin;
      const y = oy + margin;
      return `
        <rect x="${x}" y="${y}" width="7" height="7" fill="${fg}" />
        <rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="${bg}" />
        <rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="${fg}" />
      `;
    };
    findersSvg += renderSquareFinder(0, 0);
    findersSvg += renderSquareFinder(size - 7, 0);
    findersSvg += renderSquareFinder(0, size - 7);
  }

  // Badge rendering
  const badgeSvg = showLogo
    ? renderCenterBadge(
        badgeStart,
        badgeSize,
        margin,
        options.badgeBgColor || fg,
        options.badgeFgColor || bg,
      )
    : "";

  const titleElem = options.title ? `<title>${escapeXml(options.title)}</title>` : "";
  const descElem = options.ariaLabel
    ? `<desc>${escapeXml(options.ariaLabel)}</desc>`
    : `<desc>Branded OutClass QR Code</desc>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="100%" height="100%" role="img" aria-label="${escapeXml(options.ariaLabel || options.title || "OutClass QR Code")}">
  ${titleElem}
  ${descElem}
  <rect width="${total}" height="${total}" fill="${bg}" />
  <path d="${modulePaths.join(" ")}" fill="${fg}" />
  ${findersSvg}
  ${badgeSvg}
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
