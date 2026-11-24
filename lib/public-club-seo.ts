import { cache } from "react"
import { unstable_cache } from "next/cache"
import { prisma } from "@/utils/prisma"
import { resolveViewerSchool } from "@/utils/school-scope"
import { DEFAULT_SCHOOL } from "@/lib/school-host"

// Separate from recruitment projections: SEO never selects questions, applicants,
// memberships, contact details, events, or any other account data.
const publicSeoFields = { id: true, slug: true, schoolId: true, name: true, description: true, claimedAt: true, isDiscoverable: true } as const
export type PublicClubSeo = { id: string; slug?: string | null; schoolId?: string | null; name: string; description: string; claimedAt: Date | null; isDiscoverable?: boolean }

/**
 * Search title for a club profile. Launch-school clubs say "at UVA" (how students search for them)
 * unless the name already does; the H1 stays the bare club name.
 */
export function clubSearchTitle(club: Pick<PublicClubSeo, "name" | "schoolId">) {
  const name = club.name.trim()
  return club.schoolId === DEFAULT_SCHOOL.id && !/\bUVA\b|University of Virginia/i.test(name) ? `${name} at UVA` : name
}

export function isIndexableClub(club: PublicClubSeo | null): boolean {
  return !!club?.claimedAt && club.isDiscoverable !== false && club.description.trim().length >= 80 &&
    !club.description.includes("Club leadership has not yet claimed this profile.")
}

// Scoped to the viewer's school like the page itself, so another school's club yields no title or description.
export const getPublicClubSeo = cache(async (id: string): Promise<PublicClubSeo | null> => {
  try {
    const school = await resolveViewerSchool()
    return await prisma.club.findFirst({ where: { OR: [{ id }, { slug: id }], schoolId: school.id, suspendedAt: null }, select: publicSeoFields })
  } catch {
    return null
  }
})

/** One school's indexable clubs; the school id argument is part of the cache key. */
export const getIndexableClubs = unstable_cache(async (schoolId: string) => {
  try {
    const clubs = await prisma.club.findMany({ where: { schoolId, claimedAt: { not: null }, isDiscoverable: true, suspendedAt: null }, select: publicSeoFields, orderBy: { id: "asc" } })
    return clubs.filter(isIndexableClub)
  } catch {
    // Database outages must never cause fictional fixtures to enter the sitemap.
    return []
  }
}, ["public-club-sitemap-v2"], { revalidate: 600, tags: ["club-directory"] })
