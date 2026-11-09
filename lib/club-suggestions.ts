import type { DirectoryClub } from "@/lib/club-directory"

/**
 * "Suggested for you": public directory clubs ranked by how closely they match the clubs a
 * student saved and the major on their profile. Pure and deterministic; it reads only public
 * directory fields, so nothing private is indexed or sent anywhere.
 */
export type ClubSuggestion = { club: DirectoryClub; reason: string; score: number }
export type SuggestionInput = { saved: Pick<DirectoryClub, "id" | "name" | "category" | "tags">[]; major?: string | null; exclude?: readonly string[] }

const STOP = new Set(["and", "the", "for", "club", "clubs", "group", "society", "association", "organization", "uva", "virginia", "university", "student", "students", "at", "of", "in"])

// Majors rarely share words with club categories; these bridge the common UVA cases.
const MAJOR_INTERESTS: [RegExp, string[]][] = [
  [/commerce|business|management/, ["business", "consulting", "finance", "investing", "accounting", "marketing", "entrepreneurship"]],
  [/econ/, ["finance", "investing", "consulting", "economics", "policy"]],
  [/financ|accounting/, ["finance", "investing", "accounting", "banking"]],
  [/computer|software|data|cs\b|statistic|math/, ["technology", "tech", "software", "engineering", "data", "entrepreneurship"]],
  [/engineer/, ["engineering", "technology", "tech", "design", "entrepreneurship"]],
  [/politic|government|public policy|foreign affairs|law/, ["policy", "politics", "law", "debate", "government", "service"]],
  [/biolog|chemist|neuro|health|nursing|pre-?med|kinesiology/, ["health", "medicine", "medical", "science", "research", "service"]],
  [/english|writing|media|journalism|rhetoric/, ["writing", "media", "journalism", "publication", "communication"]],
  [/music|drama|theat|art|dance/, ["arts", "music", "performance", "dance", "theater", "a cappella"]],
]

export function interestTerms(text: string) {
  return text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 2 && !STOP.has(word))
}

function clubTerms(club: Pick<DirectoryClub, "category" | "tags">) {
  return new Set(interestTerms([club.category, ...(club.tags ?? [])].join(" ")))
}

export function majorInterests(major: string | null | undefined) {
  const value = (major ?? "").toLocaleLowerCase().trim()
  if (!value) return new Set<string>()
  const terms = new Set(interestTerms(value))
  for (const [pattern, interests] of MAJOR_INTERESTS) if (pattern.test(value)) interests.forEach(term => terms.add(term))
  return terms
}

export function suggestClubs(directory: readonly DirectoryClub[], { saved, major, exclude = [] }: SuggestionInput, limit = 6): ClubSuggestion[] {
  const skip = new Set([...exclude, ...saved.map(club => club.id)])
  const savedProfiles = saved.map(club => ({ club, category: club.category.trim().toLocaleLowerCase(), terms: clubTerms(club), tags: new Set((club.tags ?? []).map(tag => tag.toLocaleLowerCase())) }))
  const interests = majorInterests(major)
  const majorLabel = (major ?? "").trim()
  const results: ClubSuggestion[] = []
  for (const club of directory) {
    if (skip.has(club.id)) continue
    const category = club.category.trim().toLocaleLowerCase()
    const terms = clubTerms(club)
    let savedScore = 0, best = { score: 0, name: "" }
    for (const other of savedProfiles) {
      let score = 0
      if (category && category === other.category) score += 4
      else score += 2 * [...terms].filter(term => other.terms.has(term)).length
      score += 2 * (club.tags ?? []).filter(tag => other.tags.has(tag.toLocaleLowerCase())).length
      savedScore += score
      if (score > best.score) best = { score, name: other.club.name }
    }
    const majorScore = interests.size ? 3 * [...terms].filter(term => interests.has(term)).length : 0
    const score = savedScore + majorScore
    if (score <= 0) continue
    const reason = best.score >= majorScore && best.name ? `Similar to ${best.name}` : `Fits your ${majorLabel} major`
    results.push({ club, reason, score })
  }
  return results.sort((a, b) => b.score - a.score || a.club.name.localeCompare(b.club.name)).slice(0, limit)
}
