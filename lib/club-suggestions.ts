import type { DirectoryClub } from "@/lib/club-directory"
import { CLUB_GOALS, INTEREST_CHIPS, SELECTIVE_ACCEPTANCE_RATE, weeklyHoursCommitment, type InterestAnswers } from "@/lib/interest-survey"

/**
 * "Suggested for you": public directory clubs ranked by how closely they match the clubs a
 * student saved, their own club-interest survey answers and the major on their profile. Pure and
 * deterministic; it reads only public directory fields, so nothing private is indexed or sent anywhere.
 *
 * Weights: a saved club in the same category (16) outweighs everything the survey can add (at most
 * 10 for interests plus 4 for goals), and a survey interest (8) outweighs the major (at most 6).
 * Time and selectivity answers only re-order clubs that already match, and only when the club
 * publishes the matching field (timeCommitment, acceptanceRate).
 */
export type ClubSuggestion = { club: DirectoryClub; reason: string; score: number }
export type SuggestionInput = {
  saved: Pick<DirectoryClub, "id" | "name" | "category" | "tags">[]
  major?: string | null
  survey?: InterestAnswers | null
  exclude?: readonly string[]
}

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

const SAVED_WEIGHT = 4
const INTEREST_FIRST = 8, INTEREST_MORE = 2, INTEREST_MAX = 10
const GOAL_EACH = 2, GOAL_MAX = 4
const MAJOR_EACH = 3, MAJOR_MAX = 6

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

type Matcher = { terms: readonly string[]; categories?: readonly string[] }
/** Whether a survey chip or goal describes a club, from its public category and tags only. */
export function surveyOptionMatches(option: Matcher, club: Pick<DirectoryClub, "category" | "tags">, terms = clubTerms(club)) {
  if (option.categories?.length) {
    const labels = [club.category, ...(club.tags ?? [])].map(label => label.trim().toLocaleLowerCase())
    if (labels.some(label => option.categories!.includes(label))) return true
  }
  return option.terms.some(term => terms.has(term))
}

export function suggestClubs(directory: readonly DirectoryClub[], { saved, major, survey, exclude = [] }: SuggestionInput, limit = 6): ClubSuggestion[] {
  const skip = new Set([...exclude, ...saved.map(club => club.id)])
  const savedProfiles = saved.map(club => ({ club, category: club.category.trim().toLocaleLowerCase(), terms: clubTerms(club), tags: new Set((club.tags ?? []).map(tag => tag.toLocaleLowerCase())) }))
  const interests = majorInterests(major)
  const majorLabel = (major ?? "").trim()
  const chips = INTEREST_CHIPS.filter(chip => survey?.interests.includes(chip.id))
  const goals = CLUB_GOALS.filter(goal => survey?.goals.includes(goal.id))
  const commitment = survey?.weeklyHours ? weeklyHoursCommitment[survey.weeklyHours] : null
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
      savedScore += SAVED_WEIGHT * score
      if (SAVED_WEIGHT * score > best.score) best = { score: SAVED_WEIGHT * score, name: other.club.name }
    }
    const matchedChips = chips.filter(chip => surveyOptionMatches(chip, club, terms))
    const interestScore = matchedChips.length ? Math.min(INTEREST_MAX, INTEREST_FIRST + INTEREST_MORE * (matchedChips.length - 1)) : 0
    const matchedGoals = goals.filter(goal => surveyOptionMatches(goal, club, terms))
    const goalScore = Math.min(GOAL_MAX, GOAL_EACH * matchedGoals.length)
    const majorScore = interests.size ? Math.min(MAJOR_MAX, MAJOR_EACH * [...terms].filter(term => interests.has(term)).length) : 0
    let score = savedScore + interestScore + goalScore + majorScore
    if (score <= 0) continue
    // Fit adjustments: never add a club on their own, never drop a matching one.
    if (commitment && club.timeCommitment) score += club.timeCommitment === commitment ? 1 : -1
    const selective = club.acceptanceRate != null && club.acceptanceRate <= SELECTIVE_ACCEPTANCE_RATE
    if (selective && survey?.selectivity === "no") score -= 3
    if (selective && survey?.selectivity === "yes") score += 1
    score = Math.max(1, score)
    // The strongest single signal explains the suggestion; ties prefer what the student chose most explicitly.
    const reasons: [number, string][] = [
      [best.score, best.name ? `Similar to ${best.name}` : ""],
      [interestScore, matchedChips[0] ? `Because you picked ${matchedChips[0].label}` : ""],
      [majorScore, majorLabel ? `Fits your ${majorLabel} major` : ""],
      [goalScore, matchedGoals[0] ? `Because you want ${matchedGoals[0].phrase}` : ""],
    ]
    const reason = reasons.reduce((top, next) => next[1] && next[0] > top[0] ? next : top, [0, ""] as [number, string])[1]
    results.push({ club, reason, score })
  }
  return results.sort((a, b) => b.score - a.score || a.club.name.localeCompare(b.club.name, "en-US")).slice(0, limit)
}
