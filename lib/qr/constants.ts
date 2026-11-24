/**
 * Brand constants and design tokens for the OutClass Branded QR Code System.
 * Derived from OutClass design tokens and the official OC app icon artwork.
 */

// Deep OutClass Navy from primary design token and brand vector assets
export const BRAND_NAVY = "#142d4e";
export const BRAND_NAVY_DEEP = "#022557";

// Warm ivory / white background tokens
export const BRAND_IVORY = "#ffffff";
export const BRAND_WARM_IVORY = "#f8f7f4";

// QR Specification constants
export const DEFAULT_QUIET_ZONE_MODULES = 4;
export const ERROR_CORRECTION_LEVEL = "H" as const;

// Proportions matching the official Apple squircle app icon
export const APP_ICON_VIEWBOX = 180;
export const APP_ICON_CORNER_RADIUS_RATIO = 37 / 180; // ~0.2055

/**
 * The OutClass mark: the interlocking serif OC monogram, all ivory on a navy tile, exactly as in the
 * active app icon (public/brand/premium-board/11_app_icon_white.svg, also public/icon.svg). One
 * even-odd path in its own source coordinates; OC_MARK_TRANSFORM places it on the 180-unit badge.
 */
export const OC_MARK_PATH =
  "M102.27 141.01 C89.79 138.36 80.47 130.62 76.44 119.57 C75.5 117.01 74.62 116.49 69.24 115.4 C60.83 113.68 56.3 111.35 50.89 105.97 C44.54 99.64 41.66 92.01 41.66 81.5 C41.66 71.35 44.37 64.03 50.74 56.94 C59.41 47.31 67.45 43.88 81.46 43.88 C99.18 43.87 110 51.18 114.65 66.29 L116.34 71.76 121.52 72.37 C124.37 72.71 128.64 73.67 131.01 74.5 C134.94 75.89 135.48 75.88 137.16 74.35 C138.18 73.43 139.17 72.86 139.37 73.09 C140.24 74.1 140.88 96.13 140.03 95.83 C139.52 95.65 137.39 92.12 135.3 88 C131.11 79.73 126.2 75.39 119.87 74.37 L116.28 73.78 115.79 81.36 C114.92 94.99 106.2 107.82 94.55 112.64 C90.6 114.28 90.15 114.78 90.66 116.99 C96.83 143.72 126.26 147.1 138.23 122.46 C140.66 117.47 142.36 116.56 141.43 120.75 C139.4 129.95 137.76 134.11 135.6 135.52 C128.26 140.33 111.82 143.04 102.27 141.01 Z M74.6 106.25 C74.73 96.89 76.99 91.13 83.18 84.42 C87.63 79.59 96.22 74.03 99.25 74.01 C102.92 73.99 100.2 61.34 94.98 54.13 C84.64 39.85 66.7 43.64 60.07 61.49 C54.4 76.77 56.32 98.46 64.21 108.12 C65.76 110.02 72.05 113.99 73.5 113.99 C74.07 113.99 74.54 110.68 74.6 106.25 Z M94.53 107.13 C98.74 100.77 101.08 93.23 101.69 84.08 L102.25 75.5 98.1 79.48 C95.06 82.4 93.44 85.09 92.1 89.48 C88.83 100.16 88.31 111 91.05 111 C91.56 111 93.12 109.26 94.53 107.13 Z";

/** The mark's centre in its source coordinates (the app icon's own transform uses the same centre). */
export const OC_MARK_CENTER = { x: 91.65, y: 92.75 } as const;

/** The mark fills the badge as it fills the app icon: 1.168 x 100 units of mark on a 175-unit tile. */
export const OC_MARK_SCALE = (APP_ICON_VIEWBOX / 175) * 1.168;

/** Places OC_MARK_PATH, centred and scaled, inside the APP_ICON_VIEWBOX badge box. */
export const OC_MARK_TRANSFORM = `translate(${APP_ICON_VIEWBOX / 2} ${APP_ICON_VIEWBOX / 2}) scale(${OC_MARK_SCALE}) translate(${-OC_MARK_CENTER.x} ${-OC_MARK_CENTER.y})`;

/**
 * Allowed domains for short-link resolution and open-redirect protection.
 */
export const ALLOWED_SHORTLINK_DOMAINS = [
  "out-class.net",
  "www.out-class.net",
  "localhost",
  "127.0.0.1",
] as const;
