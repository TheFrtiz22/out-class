/** Shared art direction. Sizes and cropping belong here, never in individual pages. */
export const campusIllustrations = {
  "lawn-archways": { asset: "lawn-archways", viewBox: "0 0 600 340", scale: "wide" },
  rotunda: { asset: "rotunda", viewBox: "0 0 600 340", scale: "wide" },
  jefferson: { asset: "jefferson", viewBox: "175 35 235 300", scale: "portrait" },
  monticello: { asset: "monticello", viewBox: "0 0 600 340", scale: "wide" },
  homer: { asset: "homer", viewBox: "185 20 225 320", scale: "portrait" },
  columns: { asset: "rotunda", viewBox: "165 130 270 155", scale: "columns" },
} as const
export type CampusIllustrationVariant = keyof typeof campusIllustrations
export type CampusIllustrationOptions = {
  variant: CampusIllustrationVariant
  treatment?: "standard" | "quiet"
  accent?: boolean
  motion?: "none" | "entrance"
}

/** Legacy leader views and the club workspace share the same motifs. */
export function clubCampusIllustration(section: string): CampusIllustrationVariant {
  if (["applicants", "leader-dashboard"].includes(section)) return "homer"
  if (["interviews", "interview-scheduler", "interviewer-dashboard", "interview-workspace"].includes(section)) return "columns"
  if (["settings", "members", "club-manager", "club-branding-editor", "club-management-portal"].includes(section)) return "monticello"
  return "rotunda"
}
