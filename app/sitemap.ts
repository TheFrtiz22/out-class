import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"
import { getIndexableClubs } from "@/lib/public-club-seo"

export const revalidate = 600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const clubs = await getIndexableClubs()
  return [
    { url: `${SITE_URL}/` },
    ...clubs.map(club => ({ url: `${SITE_URL}/club/${encodeURIComponent(club.id)}` })),
  ]
}
