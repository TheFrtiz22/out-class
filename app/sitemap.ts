import type { MetadataRoute } from "next"
import { SITE_URL, clubPath } from "@/lib/seo"
import { getIndexableClubs } from "@/lib/public-club-seo"
import { LEGAL_PAGES_PUBLIC } from "@/lib/legal-content"
import { DEFAULT_SCHOOL, schoolOrigin } from "@/lib/school-host"
import { resolveHostSchool } from "@/utils/school-scope"

// Per host (school), so it renders per request and is never prerendered as the launch school's only.
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Each host lists only its own school's clubs: the main domain the launch school, `<key>.out-class.net` its school.
  const school = await resolveHostSchool()
  const clubs = await getIndexableClubs(school.id)
  if (school.id !== DEFAULT_SCHOOL.id) {
    const origin = schoolOrigin(school)
    return [{ url: `${origin}/` }, ...clubs.map(club => ({ url: `${origin}${clubPath(club)}` }))]
  }
  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/uva` },
    { url: `${SITE_URL}/about` },
    { url: `${SITE_URL}/security` },
    { url: `${SITE_URL}/copyright` },
    { url: `${SITE_URL}/request-school` },
    ...(LEGAL_PAGES_PUBLIC ? ["privacy", "terms", "cookies", "legal"].map(page => ({ url: `${SITE_URL}/${page}` })) : []),
    ...clubs.map(club => ({ url: `${SITE_URL}${clubPath(club)}` })),
  ]
}
