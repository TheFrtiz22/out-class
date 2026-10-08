import { clubRecruitment } from "@/lib/recruitment-presentation"
import type { DiscoverClub } from "@/lib/data"
export type DirectoryClub = DiscoverClub & {
  applicationDeadline?: string | null
  rounds?: { id: string; name: string; order: number }[]
  marketing?: unknown
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
  recruitment: string
}
export const emptyDirectoryFilters: DirectoryFilters = {
  query: "",
  category: "all",
  time: "all",
  aum: "all",
  acceptance: "all",
  sort: "name",
  recruitment: "all",
}
export function filterDirectory(clubs: DirectoryClub[], filters: DirectoryFilters, now = Date.now()) {
  const words = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const deadlineOrder = (club: DirectoryClub) => {
    const recruitment = clubRecruitment(club, now)
    return recruitment.available && recruitment.deadline ? +recruitment.deadline : Infinity
  }
  return clubs
    .filter((club) => {
      const text = [club.name, club.category, club.pitch, club.description || "", ...club.tags]
        .join(" ")
        .toLocaleLowerCase()
      if (!words.every((word) => text.includes(word))) return false
      if (filters.category !== "all" && club.category.toLowerCase() !== filters.category.toLowerCase()) return false
      const recruitment = clubRecruitment(club, now)
      if (filters.recruitment === "open" && !recruitment.available) return false
      if (filters.recruitment === "closing" && !recruitment.closingSoon) return false
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
        (filters.sort === "deadline"
          ? deadlineOrder(a) - deadlineOrder(b)
          : filters.sort === "acceptance"
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

const filterParams: Record<keyof DirectoryFilters, string> = { query: "q", category: "category", time: "time", aum: "aum", acceptance: "acceptance", sort: "sort", recruitment: "recruitment" }
export function directoryFiltersFromParams(params: { get: (key: string) => string | null }): DirectoryFilters {
  const values = { ...emptyDirectoryFilters }
  for (const key of Object.keys(filterParams) as (keyof DirectoryFilters)[]) values[key] = params.get(filterParams[key]) || values[key]
  if (!["name", "acceptance", "deadline"].includes(values.sort)) values.sort = "name"
  if (!["all", "open", "closing"].includes(values.recruitment)) values.recruitment = "all"
  if (!["all", "1-3", "3-5", "5+"].includes(values.time)) values.time = "all"
  if (!["all", "small", "medium", "large"].includes(values.aum)) values.aum = "all"
  if (!["all", "5", "10", "25", "50", "100"].includes(values.acceptance)) values.acceptance = "all"
  return values
}
export function directoryFilterParams(params: URLSearchParams, filters: DirectoryFilters) {
  const next = new URLSearchParams(params)
  for (const key of Object.keys(filterParams) as (keyof DirectoryFilters)[]) {
    if (filters[key] === emptyDirectoryFilters[key]) next.delete(filterParams[key])
    else next.set(filterParams[key], filters[key])
  }
  return next
}
