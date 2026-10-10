import { z } from "zod"
import { clubAssetReference } from "@/lib/club-assets"

const text = (max: number) => z.string().trim().max(max)
export const publicUrl = z.string().trim().max(2000).refine(v => !v || /^https?:\/\//i.test(v) && (() => { try { return !!new URL(v).hostname } catch { return false } })(), "Use a full https:// link.")
export const profileImage = z.string().max(350000).refine(v => !v || clubAssetReference.safeParse(v).success || /^\/logos\/[a-zA-Z0-9_.-]+$/.test(v) || publicUrl.safeParse(v).success || /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v), "Use an image URL or upload a PNG, JPEG, or WebP.")
export const marketingSchema = z.object({
  sections: z.array(z.object({
    title: text(100).min(1), kind: z.enum(["about", "programs", "people", "impact", "recruitment"]).default("programs"),
    visible: z.boolean().default(true), body: text(5000).default(""),
    cards: z.array(z.object({ title: text(150), description: text(2000), url: publicUrl.default(""), image: profileImage.default("") })).max(12).default([]),
  })).max(12).default([]),
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
  name: text(150).min(1), tagline: text(300), description: text(10000),
  category: text(100).min(1), color: z.string().regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color."),
  logoUrl: profileImage.nullable(), bannerUrl: profileImage.nullable(),
  acceptanceRate: z.number().min(0).max(100).nullable(), aumValue: z.number().min(0).max(1e15).nullable(),
  marketing: marketingSchema,
})
export type ClubProfileDraft = z.infer<typeof clubProfileSchema>
export function profileDraft(club: { name: string; description?: string; tagline?: string; category?: string; color?: string; logoUrl?: string | null; bannerUrl?: string | null; acceptanceRate?: number | null; aumValue?: number | null; marketing?: unknown }): ClubProfileDraft {
  return { name: club.name, description: club.description ?? "", tagline: club.tagline ?? "", category: club.category || "Other", color: club.color || "#232D4B", logoUrl: club.logoUrl ?? null, bannerUrl: club.bannerUrl ?? null, acceptanceRate: club.acceptanceRate ?? null, aumValue: club.aumValue ?? null, marketing: readMarketing(club.marketing) }
}
