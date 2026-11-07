import "server-only"
import { getClubDirectory } from "@/actions/club-directory"
import { emptyDirectoryFilters, filterDirectory, type DirectoryClub } from "@/lib/club-directory"
import { clubRecruitment } from "@/lib/recruitment-presentation"

/**
 * Signed-out Explore reads the existing public club projection (actions/club-directory: explicit
 * public fields, discoverable and unsuspended clubs only) and keeps only claimed clubs. The page is
 * a Server Component: this list is rendered to HTML and never sent to the browser as data, and
 * search runs here over the projection (no search keys reach the client).
 */
export type PublicExploreClub = {
  id: string
  name: string
  logoText: string
  logoUrl: string | null
  color: string
  category: string
  pitch: string
  /** Only the logo presentation keys; no statistics, placements or other marketing fields. */
  logo: { logoOnBrand?: unknown; logoBackground?: unknown }
  applicationsOpen: boolean
  deadline: string | null
}

export function toPublicExploreClub(club: DirectoryClub, now = Date.now()): PublicExploreClub {
  const recruitment = clubRecruitment(club, now)
  const marketing = (club.marketing && typeof club.marketing === "object" ? club.marketing : {}) as Record<string, unknown>
  return {
    id: club.id, name: club.name, logoText: club.logoText, logoUrl: club.logoUrl ?? null, color: club.color,
    category: club.category, pitch: club.pitch,
    logo: { logoOnBrand: marketing.logoOnBrand, logoBackground: marketing.logoBackground },
    applicationsOpen: recruitment.available,
    deadline: recruitment.available && recruitment.deadline ? recruitment.deadline.toISOString() : null,
  }
}

export function publicExploreSelection(clubs: DirectoryClub[], query: string, category: string, now = Date.now()) {
  const listed = clubs.filter(club => club.source === "database" && club.claimed === true)
  const categories = [...new Set(listed.map(club => club.category).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const chosen = categories.find(c => c.toLowerCase() === category.toLowerCase()) ?? "all"
  const results = filterDirectory(listed, { ...emptyDirectoryFilters, query: query.slice(0, 100), category: chosen }, now).map(club => toPublicExploreClub(club, now))
  return { results, categories, category: chosen, total: listed.length }
}

export async function getPublicExplore(query: string, category: string) {
  const { clubs, error } = await getClubDirectory()
  return { ...publicExploreSelection(clubs, query, category), error }
}
