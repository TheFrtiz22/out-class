import { z } from "zod";
export const clubAssetReference = z.string().regex(/^club-assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/);
export function clubAssetSource(value: string | null | undefined, preview = false) {
  return value && clubAssetReference.safeParse(value).success ? `/api/club-assets?reference=${encodeURIComponent(value)}${preview ? "&preview=1" : ""}` : value || "";
}
/** Only known public image fields are asset references, never arbitrary prose/links. */
export function clubProfileImages(value: { logoUrl?: string | null; bannerUrl?: string | null; marketing?: unknown }, publicOnly = false): string[] {
  const m = value.marketing as { gallery?: { url?: string }[]; sections?: { visible?: boolean; cards?: { image?: string }[] }[] } | null;
  return [value.logoUrl, value.bannerUrl, ...(Array.isArray(m?.gallery) ? m.gallery.map(g => g.url) : []), ...(Array.isArray(m?.sections) ? m.sections.filter(s => !publicOnly || s.visible !== false).flatMap(s => Array.isArray(s.cards) ? s.cards.map(c => c.image) : []) : [])].filter((s): s is string => typeof s === "string" && !!s);
}
