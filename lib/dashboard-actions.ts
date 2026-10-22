export type ActionUrgency = "critical" | "soon" | "normal"
export type DashboardAction = {
  id: string
  title: string
  description: string
  urgency: ActionUrgency
  href: string
  count?: number
  dueAt?: string | Date | null
}
const urgencyRank: Record<ActionUrgency, number> = { critical: 0, soon: 1, normal: 2 }

/** Only source-backed, authorized work belongs in this queue. No invented activity or AI calls. */
export function prioritizeDashboardActions(actions: DashboardAction[], limit = 5): DashboardAction[] {
  return actions
    .filter(action => Boolean(action.href) && Boolean(action.title) && (action.count === undefined || action.count > 0))
    .sort((a, b) => {
      const urgency = urgencyRank[a.urgency] - urgencyRank[b.urgency]
      if (urgency !== 0) return urgency
      const aDate = a.dueAt ? +new Date(a.dueAt) : Number.POSITIVE_INFINITY
      const bDate = b.dueAt ? +new Date(b.dueAt) : Number.POSITIVE_INFINITY
      if (aDate !== bDate) return aDate - bDate
      return a.id.localeCompare(b.id)
    }).slice(0, Math.max(0, limit))
}
