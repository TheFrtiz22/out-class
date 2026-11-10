import "server-only"
import { cache } from "react"
import { prisma } from "@/utils/prisma"
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
  const club = await prisma.club.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], suspendedAt: null }, select: shareFields })
  return club && { ...club, summary: shareSummary(club.tagline, club.description) }
})
export type ClubShareProfile = NonNullable<Awaited<ReturnType<typeof loadClubShareProfile>>>

/** For metadata: an outage only drops the club-specific text. */
export async function getClubShareProfile(idOrSlug: string) {
  try { return await loadClubShareProfile(idOrSlug) } catch { return null }
}
