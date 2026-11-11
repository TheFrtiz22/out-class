/**
 * Corkboard empty state: say why nothing shows and offer one action that changes the view.
 * Never offer "show all" when everything is already shown.
 */
export type EventBoardFilterState = { query?: string; period?: string; category?: string; clubId?: string; date?: string; location?: string; required?: boolean; savedOnly?: boolean }
export type EventBoardEmpty = { title: string; description: string; action: { kind: "clear-filters" | "show-all-events" | "explore-clubs"; label: string } }

export function eventBoardEmpty(filters: EventBoardFilterState): EventBoardEmpty {
  const narrowed = !!(filters.query || filters.category || filters.clubId || filters.date || filters.location || filters.required || (filters.period ?? "All") !== "All")
  if (narrowed) return {
    title: filters.query ? `No events match “${filters.query}”.` : "No events match these filters.",
    description: filters.savedOnly ? "None of your saved events fit the current search or filters." : "Nothing approved fits the current search or filters.",
    action: { kind: "clear-filters", label: "Clear filters" },
  }
  if (filters.savedOnly) return {
    title: "You haven’t saved any events yet.",
    description: "Save an event from the board to keep it here.",
    action: { kind: "show-all-events", label: "Browse all events" },
  }
  return {
    title: "No upcoming campus events yet.",
    description: "Clubs haven’t published upcoming events. Browse clubs to see what they do.",
    action: { kind: "explore-clubs", label: "Explore clubs" },
  }
}
