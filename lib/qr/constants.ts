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
 * Exact vector paths for the interlocking OutClass OC Monogram
 * Extracted directly from public/icon.svg.
 */
export const OC_MONOGRAM_PATHS = [
  // Interlocking "C" component
  "M101.141 53H136.632C151.023 53 162.689 64.6662 162.689 79.0573V112.904H148.112V79.0573C148.112 78.7105 148.098 78.3662 148.072 78.0251L112.581 112.898C112.701 112.902 112.821 112.904 112.941 112.904H148.112V126.672H112.941C98.5504 126.672 86.5638 114.891 86.5638 100.5V66.7434H101.141V100.5C101.141 101.15 101.191 101.792 101.289 102.422L137.56 66.7816C137.255 66.7563 136.945 66.7434 136.632 66.7434H101.141V53Z",
  // Interlocking "O" component
  "M65.2926 124.136L14 66.7372H34.6355L64.7495 100.436V66.7372H80.1365V118.47C80.1365 126.278 70.4953 129.958 65.2926 124.136Z",
] as const;

/**
 * Allowed domains for short-link resolution and open-redirect protection.
 */
export const ALLOWED_SHORTLINK_DOMAINS = [
  "out-class.net",
  "www.out-class.net",
  "localhost",
  "127.0.0.1",
] as const;
