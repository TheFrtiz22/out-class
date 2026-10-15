/** Shared art direction. Sizes and cropping belong here, never in individual pages. */
export const campusIllustrations = {
  "lawn-archways": { asset: "lawn-archways", viewBox: "0 0 321 185", scale: "wide", aspectRatio: "321 / 185" },
  "rotunda": { asset: "rotunda", viewBox: "0 0 229 176", scale: "wide", aspectRatio: "229 / 176" },
  "jefferson": { asset: "jefferson", viewBox: "0 0 157 177", scale: "portrait", aspectRatio: "157 / 177" },
  "monticello": { asset: "monticello", viewBox: "0 0 247 156", scale: "wide", aspectRatio: "247 / 156" },
  "homer": { asset: "homer", viewBox: "0 0 186 175", scale: "portrait", aspectRatio: "186 / 175" },
  "lamp-posts-grounds": { asset: "lamp-posts-grounds", viewBox: "0 0 220 188", scale: "grounds", aspectRatio: "220 / 188" },
  columns: { asset: "rotunda", viewBox: "53 39 132 115", scale: "columns", aspectRatio: "132 / 115" },
} as const
export type CampusIllustrationVariant = keyof typeof campusIllustrations
export type CampusIllustrationOptions = {
  variant: CampusIllustrationVariant
  treatment?: "standard" | "quiet"
  accent?: boolean
  presentation?: "standard" | "compact" | "prominent"
  motion?: "none" | "entrance"
}
