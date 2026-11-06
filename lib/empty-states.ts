// Empty-state copy and the single next action each one may offer.
// Rule: say why the view is empty, and only offer an action that leads somewhere different.
// A "clear" action appears only when a filter is actually narrowing the view and something exists outside it.

export type EmptyCopy<Action extends string> = { title: string; description: string; action: Action | null }

export type EventBoardEmptyFilters = { query?: string; period?: string; category?: string; clubId?: string; date?: string; location?: string; required?: boolean; savedOnly?: boolean }

export function eventBoardEmptyState(filters: EventBoardEmptyFilters, signedIn: boolean): EmptyCopy<"show-all"> {
  const saved = signedIn && filters.savedOnly
  const search = !!filters.query
  const narrowed = !!(filters.category || filters.clubId || filters.date || filters.location || filters.required || (filters.period ?? "All") !== "All")
  if (search && !narrowed) return { title: "No events match your search.", description: `No approved ${saved ? "saved " : ""}events mention “${(filters.query ?? "").trim()}”.`, action: "show-all" }
  if (search || narrowed) return { title: "No events match your filters.", description: `No approved ${saved ? "saved " : ""}events fit these choices. Try another date or show every event.`, action: "show-all" }
  if (saved) return { title: "No saved events here yet.", description: "Save an event to find it here. Your saved events follow you between views.", action: "show-all" }
  return { title: "No upcoming events yet.", description: "Events appear here once a club posts one and OutClass approves it.", action: null }
}

export function directoryEmptyState(totalClubs: number, activeFilters: number): EmptyCopy<"clear"> {
  if (!totalClubs) return { title: "No clubs available yet.", description: "Club profiles will appear here as organizations are added.", action: null }
  return { title: "No clubs match this search.", description: "Try a broader keyword or remove a filter.", action: activeFilters > 0 ? "clear" : null }
}

export function personalTasksEmptyState({ assigned, query, filter }: { assigned: number; query: string; filter: string }): EmptyCopy<"clear" | "clear-search" | "view-all"> {
  if (!assigned) return { title: "No tasks assigned yet.", description: "When a club leader assigns you work, it will appear here.", action: null }
  if (query.trim() || filter !== "open") return { title: "No tasks match your filters.", description: "Try another search or clear the filters.", action: filter === "all" ? "clear-search" : "clear" }
  return { title: "You're all caught up.", description: "No tasks need your attention. You can still view earlier work.", action: "view-all" }
}

export function meetingListEmptyState({ period, audience, inPeriod, otherPeriod }: { period: "upcoming" | "past"; audience: string; inPeriod: number; otherPeriod: number }): EmptyCopy<"all-audiences" | "other-period"> {
  if (audience !== "ALL" && inPeriod > 0) return { title: `No ${period} meetings for this audience`, description: `Your club has ${period} meetings for other audiences.`, action: "all-audiences" }
  if (period === "upcoming") return { title: "No upcoming meetings", description: otherPeriod ? "Nothing is scheduled yet. Earlier agendas and recaps are in Past." : "Nothing is scheduled yet. Meetings appear here once a club leader posts one.", action: otherPeriod ? "other-period" : null }
  return { title: "No past meetings", description: otherPeriod ? "Agendas and recaps appear here after a meeting ends. Upcoming meetings are in Upcoming." : "Agendas and recaps appear here after a meeting ends.", action: otherPeriod ? "other-period" : null }
}

export function memberDirectoryEmptyState({ invitations, history, filtered }: { invitations: boolean; history: boolean; filtered: boolean }): EmptyCopy<"clear"> {
  if (filtered) return { title: invitations ? "No invitations match these filters." : "No members match these filters.", description: "", action: "clear" }
  if (invitations) return { title: history ? "No invitations have been sent yet." : "No pending invitations.", description: "", action: null }
  return { title: "No members yet.", description: "", action: null }
}
