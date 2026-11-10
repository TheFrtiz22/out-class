import { z } from "zod"
import { logoBackgroundSchema } from "@/lib/club-logo-background"
import { clubAssetReference } from "@/lib/club-assets"
import { presentPublicMarketing } from "@/lib/public-club-content"

const text = (max: number) => z.string().trim().max(max)

/** A club's optional navigation nickname: trimmed; blank clears it (null). 2–8 letters, digits, "&", "-" or spaces.
 * Mirrors the "Club_shortName_format" CHECK constraint. Clubs may share a short name. */
export const CLUB_SHORT_NAME_MAX = 8
export const clubShortNameSchema = z.preprocess(
  value => typeof value === "string" ? value.trim() || null : value ?? null,
  z.string()
    .min(2, "Use at least 2 characters for the short name.")
    .max(CLUB_SHORT_NAME_MAX, `Use ${CLUB_SHORT_NAME_MAX} characters or fewer for the short name.`)
    .regex(/^[A-Za-z0-9& -]+$/, "Use letters, numbers, spaces, \"&\" or \"-\" in the short name.")
    .nullable(),
)
export const publicUrl = z.string().trim().max(2000).refine(v => !v || /^https?:\/\//i.test(v) && (() => { try { return !!new URL(v).hostname } catch { return false } })(), "Use a full https:// link.")
export const profileImage = z.string().max(350000).refine(v => !v || clubAssetReference.safeParse(v).success || /^\/logos\/[a-zA-Z0-9_.-]+$/.test(v) || publicUrl.safeParse(v).success || /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v), "Use an image URL or upload a PNG, JPEG, or WebP.")
export const marketingSchema = z.object({
  sections: z.array(z.object({
    title: text(100).min(1), kind: z.enum(["about", "programs", "people", "impact", "recruitment"]).default("programs"),
    visible: z.boolean().default(true), body: text(5000).default(""),
    cards: z.array(z.object({ title: text(150), description: text(2000), url: publicUrl.default(""), image: profileImage.default("") })).max(12).default([]),
  })).max(12).default([]),
  bannerPosition: z.object({ x: z.number().min(0).max(100).default(50), y: z.number().min(0).max(100).default(50) }).default({ x: 50, y: 50 }),
  logoOnBrand: z.boolean().default(false),
  logoBackground: logoBackgroundSchema.optional(),
  acceptanceNote: text(180).default(""), acceptanceSource: publicUrl.default(""),
  acceptanceApproximate: z.boolean().default(false),
  outcomesNote: text(300).default(""),
  memberCount: z.number().int().min(0).max(1000000).nullable().default(null),
  showAcceptance: z.boolean().default(true), showAum: z.boolean().default(true), showMembers: z.boolean().default(true),
  placements: z.array(text(100)).max(20).default([]), accolades: z.array(text(200)).max(20).default([]),
  benefits: z.array(text(250)).max(12).default([]),
  metrics: z.array(z.object({ label: text(60), value: text(60) })).max(6).default([]),
  links: z.array(z.object({ label: text(60), url: publicUrl })).max(12).default([]),
  email: z.union([z.literal(""), z.string().email().max(254)]).default(""),
  website: publicUrl.default(""), linkedin: publicUrl.default(""), instagram: publicUrl.default(""),
  commitment: text(150).default(""), eligibility: text(500).default(""), dues: text(150).default(""),
  videoUrl: publicUrl.default(""),
  faqs: z.array(z.object({ question: text(200), answer: text(1500) })).max(12).default([]),
  features: z.array(z.object({ title: text(100), description: text(1000), url: publicUrl })).max(8).default([]),
  gallery: z.array(z.object({ url: profileImage, caption: text(180) })).max(6).default([]),
})
export type ClubMarketing = z.infer<typeof marketingSchema>
export function readMarketing(value: unknown): ClubMarketing {
  const parsed = marketingSchema.safeParse(value ?? {})
  return parsed.success ? parsed.data : marketingSchema.parse({})
}
export const clubProfileSchema = z.object({
  name: text(150).min(1), shortName: clubShortNameSchema.optional(), tagline: text(300), description: text(10000),
  category: text(100).min(1), color: z.string().regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color."),
  logoUrl: profileImage.nullable(), bannerUrl: profileImage.nullable(),
  acceptanceRate: z.number().min(0).max(100).nullable(), aumValue: z.number().min(0).max(1e15).nullable(),
  marketing: marketingSchema,
})
export type ClubProfileDraft = z.infer<typeof clubProfileSchema>
export function profileDraft(club: { name: string; shortName?: string | null; description?: string; tagline?: string; category?: string; color?: string; logoUrl?: string | null; bannerUrl?: string | null; acceptanceRate?: number | null; aumValue?: number | null; marketing?: unknown }): ClubProfileDraft {
  return { name: club.name, shortName: club.shortName ?? null, description: club.description ?? "", tagline: club.tagline ?? "", category: club.category || "Other", color: club.color || "#232D4B", logoUrl: club.logoUrl ?? null, bannerUrl: club.bannerUrl ?? null, acceptanceRate: club.acceptanceRate ?? null, aumValue: club.aumValue ?? null, marketing: readMarketing(club.marketing) }
}

/** Visibility and context are shared by cards, public profiles and editor previews.
 * Unknown values are omitted rather than shown as "Not disclosed"; every figure is self-reported
 * by the club, so each carries a "Club-reported" detail. No source links are rendered. */
export function profileStatistics(profile: { acceptanceRate?: number | null; aumValue?: number | null; marketing?: unknown }) {
  const m = readMarketing(profile.marketing)
  const note = presentPublicMarketing({ acceptanceNote: m.acceptanceNote }).acceptanceNote
  const reported = (detail?: string) => detail ? /club-reported/i.test(detail) ? detail : `${detail} · Club-reported` : "Club-reported"
  return [
    ...(m.showAcceptance && profile.acceptanceRate != null ? [{ label: "Club acceptance", value: `${m.acceptanceApproximate ? "~" : ""}${profile.acceptanceRate}%`, detail: reported(note) }] : []),
    ...(m.showAum && profile.aumValue != null ? [{ label: "AUM", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" }).format(profile.aumValue), detail: reported() }] : []),
    ...(m.showMembers && m.memberCount != null ? [{ label: "Members", value: String(m.memberCount), detail: reported() }] : []),
    ...presentPublicMarketing({ metrics: m.metrics }).metrics.filter(s => s.label && s.value).map(s => ({ ...s, detail: reported() })),
  ]
}

/** The marketing fields Explore's list, cards, logos and filters read
 * (banner position, logo background, compact statistics and member outcomes).
 * The full profile (sections, FAQs, links, gallery) loads when a club is opened. */
export const DIRECTORY_MARKETING_KEYS = ["bannerPosition", "logoOnBrand", "logoBackground", "placements", "showAcceptance", "acceptanceApproximate", "acceptanceNote", "acceptanceSource", "showAum", "showMembers", "memberCount", "metrics"] as const
export function directoryMarketing(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  return Object.fromEntries(DIRECTORY_MARKETING_KEYS.filter(key => key in source).map(key => [key, source[key]]))
}
