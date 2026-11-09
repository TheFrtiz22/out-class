/** Up to three clubs in the same categories as the clubs a student has saved,
 * applied to, joined or attended, excluding those clubs themselves. Open
 * applications break ties. Pure and explainable: no other student's data. */
export type SuggestionCandidate = { id: string; name: string; category: string; recruiting: boolean }
export function suggestClubs(candidates: readonly SuggestionCandidate[], signals: readonly { clubId: string; category: string }[], limit = 3) {
  const engaged = new Set(signals.map(s => s.clubId))
  const weight = new Map<string, number>()
  for (const s of signals) if (s.category) weight.set(s.category.toLowerCase(), (weight.get(s.category.toLowerCase()) ?? 0) + 1)
  return candidates
    .filter(c => !engaged.has(c.id) && weight.has(c.category.toLowerCase()))
    .map(c => ({ ...c, score: weight.get(c.category.toLowerCase())! * 2 + (c.recruiting ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(c => c.id)
}
