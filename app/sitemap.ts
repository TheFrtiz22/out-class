import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"
import { getIndexableClubs } from "@/lib/public-club-seo"
import { LEGAL_PAGES_PUBLIC } from "@/lib/legal-content"

export const revalidate = 600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const clubs = await getIndexableClubs()
  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/uva` },
    { url: `${SITE_URL}/about` },
    { url: `${SITE_URL}/request-school` },
    ...(LEGAL_PAGES_PUBLIC ? ["privacy", "terms", "cookies", "legal"].map(page => ({ url: `${SITE_URL}/${page}` })) : []),
    ...clubs.map(club => ({ url: `${SITE_URL}/club/${encodeURIComponent(club.id)}` })),
  ]
}
