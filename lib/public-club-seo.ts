import { cache } from "react"
import { unstable_cache } from "next/cache"
import { prisma } from "@/utils/prisma"

// Separate from recruitment projections: SEO never selects questions, applicants,
// memberships, contact details, events, or any other account data.
const publicSeoFields = { id: true, name: true, description: true, claimedAt: true, isDiscoverable: true } as const
export type PublicClubSeo = { id: string; name: string; description: string; claimedAt: Date | null; isDiscoverable?: boolean }

export function isIndexableClub(club: PublicClubSeo | null): boolean {
  return !!club?.claimedAt && club.isDiscoverable !== false && club.description.trim().length >= 80 &&
    !club.description.includes("Club leadership has not yet claimed this profile.")
}

export const getPublicClubSeo = cache(async (id: string): Promise<PublicClubSeo | null> => {
  try {
    return await prisma.club.findFirst({ where: { OR: [{ id }, { slug: id }], suspendedAt: null }, select: publicSeoFields })
  } catch {
    return null
  }
})

export const getIndexableClubs = unstable_cache(async () => {
  try {
    const clubs = await prisma.club.findMany({ where: { claimedAt: { not: null }, isDiscoverable: true, suspendedAt: null }, select: publicSeoFields, orderBy: { id: "asc" } })
    return clubs.filter(isIndexableClub)
  } catch {
    // Database outages must never cause fictional fixtures to enter the sitemap.
    return []
  }
}, ["public-club-sitemap"], { revalidate: 600, tags: ["club-directory"] })
