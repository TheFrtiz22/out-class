import "server-only"
import { cache } from "react"
import { prisma } from "@/utils/prisma"
import { resolveHostSchool } from "@/utils/school-scope"
import { shareSummary } from "@/lib/club-share-text"

/**
 * Link-preview ("share card") data for a public club profile. Same lookup as the public page
 * (id or slug, not suspended) and only fields the page already shows publicly; never members,
 * applicants, contacts, events or research notes. Kept apart from the renderer so the club page's
 * metadata does not pull sharp/next/og into its bundle.
 */
const shareFields = {
  id: true, name: true, tagline: true, description: true, category: true, color: true,
  logoUrl: true, bannerUrl: true, marketing: true, suspendedAt: true, school: { select: { name: true } },
} as const

/** Throws on database errors so callers can tell "no such club" (null) from "couldn't check". */
export const loadClubShareProfile = cache(async (idOrSlug: string) => {
  // The host's school, never the viewer's: the card images are CDN-cached for everyone (lib/share-card.tsx CACHE),
  // so a signed-in and a signed-out request on one host must get the same card. Another school's club is "not found".
  const school = await resolveHostSchool()
  const club = await prisma.club.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], schoolId: school.id, suspendedAt: null }, select: shareFields })
  return club && { ...club, summary: shareSummary(club.tagline, club.description) }
})
export type ClubShareProfile = NonNullable<Awaited<ReturnType<typeof loadClubShareProfile>>>

/** For metadata: an outage only drops the club-specific text. */
export async function getClubShareProfile(idOrSlug: string) {
  try { return await loadClubShareProfile(idOrSlug) } catch { return null }
}
