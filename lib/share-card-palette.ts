/**
 * Colours for the server-rendered link-preview card. The image renderer (next/og) cannot read
 * CSS custom properties, so these mirror the brand palette (public/brand/premium-board/README.md)
 * and the glass tokens (styles/navigation-glass.css).
 */
export const SHARE_CARD_COLORS = {
  navy: "#0F2E56",
  orange: "#F26522",
  ivory: "#FFF9F1",
  mist: "#DCE4EC",
  white: "#FFFFFF",
  body: "#46556A",
} as const
