import type { Applicant } from "@/lib/data"

export type ApplicantSortKey = "name" | "year" | "major" | "gpa" | "satScore" | "status" | "score"
export type SortConfig = { key: ApplicantSortKey | null; direction: "ascending" | "descending" }
export type ApplicantScores = Record<string, Record<string, number>>

const YEAR_ORDER: Record<string, number> = {
  freshman: 1, freshmen: 1, "first year": 1, "1st year": 1,
  sophomore: 2, "second year": 2, "2nd year": 2,
  junior: 3, "third year": 3, "3rd year": 3,
  senior: 4, "fourth year": 4, "4th year": 4,
}

export function averageApplicantScore(id: string, fallback: number, scores: ApplicantScores) {
  const values = Object.values(scores[id] ?? {})
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback
}

export function nextApplicantSort(previous: SortConfig, key: ApplicantSortKey): SortConfig {
  return {
    key,
    direction: previous.key === key && previous.direction === "descending" ? "ascending" : "descending",
  }
}

export function sortApplicants(applicants: Applicant[], config: SortConfig, scores: ApplicantScores = {}) {
  const sorted = [...applicants]
  const { key, direction } = config
  if (!key) return sorted
  const multiplier = direction === "ascending" ? 1 : -1
  return sorted.sort((a, b) => {
    if (key === "name" || key === "major" || key === "status") {
      return multiplier * a[key].localeCompare(b[key])
    }
    if (key === "year") {
      const rank = (year: string) => YEAR_ORDER[year.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim()]
      const left = rank(a.year)
      const right = rank(b.year)
      // Unknown class years stay below the recognized undergraduate years.
      if (left === undefined) return right === undefined ? multiplier * a.year.localeCompare(b.year) : 1
      if (right === undefined) return -1
      return multiplier * (left - right)
    }
    const value = (applicant: Applicant) => key === "score"
      ? averageApplicantScore(applicant.id, applicant.score, scores)
      : Number(applicant[key])
    return multiplier * (value(a) - value(b))
  })
}
