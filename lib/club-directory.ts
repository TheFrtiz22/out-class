import type { DiscoverClub } from "@/lib/data"
export type DirectoryClub = DiscoverClub & {
  testRequirement?: string
  claimed?: boolean
  campusKey?: string
  directorySource?: string | null
  source?: "database" | "preview"
  description?: string
  bannerUrl?: string | null
  applicationAvailable?: boolean
  requirements?: string[]
  publicEvents?: {
    id: string
    title: string
    date: string
    location: string
    description: string | null
  }[]
}
export type DirectoryFilters = {
  query: string
  category: string
  time: string
  aum: string
  acceptance: string
  sort: string
}
export const emptyDirectoryFilters: DirectoryFilters = {
  query: "",
  category: "all",
  time: "all",
  aum: "all",
  acceptance: "all",
  sort: "name",
}
export function filterDirectory(clubs: DirectoryClub[], filters: DirectoryFilters) {
  const words = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return clubs
    .filter((club) => {
      const text = [club.name, club.category, club.pitch, club.description || "", ...club.tags]
        .join(" ")
        .toLocaleLowerCase()
      if (!words.every((word) => text.includes(word))) return false
      if (filters.category !== "all" && club.category !== filters.category) return false
      if (filters.time !== "all" && club.timeCommitment !== filters.time) return false
      if (
        filters.acceptance !== "all" &&
        (club.acceptanceRate == null || club.acceptanceRate > Number(filters.acceptance))
      )
        return false
      if (filters.aum !== "all") {
        if (club.aumValue == null) return false
        if (filters.aum === "small" && club.aumValue > 50000) return false
        if (filters.aum === "medium" && (club.aumValue <= 50000 || club.aumValue > 250000))
          return false
        if (filters.aum === "large" && club.aumValue <= 250000) return false
      }
      return true
    })
    .sort(
      (a, b) =>
        (filters.sort === "acceptance"
          ? (a.acceptanceRate ?? Infinity) - (b.acceptanceRate ?? Infinity)
          : 0) || a.name.localeCompare(b.name),
    )
}
export function recruitmentStage(status: string) {
  const normalized = status.toUpperCase().replaceAll("_", " ")
  if (["DRAFT", "DRAFTING"].includes(normalized)) return -1
  if (["SUBMITTED", "APPLIED"].includes(normalized)) return 0
  if (["IN REVIEW", "REVIEW"].includes(normalized)) return 1
  if (normalized.includes("INTERVIEW") || ["ROUND 1", "ROUND 2"].includes(normalized)) return 2
  if (["ACCEPTED", "REJECTED", "WAITLISTED", "DECISION", "DECISION PENDING"].includes(normalized))
    return 3
  return -1
}
