import type { SessionCoverage } from "@/lib/availability"

/** Maximum distinct interviewers assignable to a simultaneous set of sessions.
 * A union count alone misses shortages within subsets of candidate pools. */
export function simultaneousStaffing(slots: SessionCoverage[]) {
  const positions = slots.flatMap(slot => Array.from({ length: slot.required }, () => slot.availableMemberIds))
  const matched = new Map<string, number>()
  function assign(position: number, visited: Set<string>): boolean {
    for (const member of positions[position]) {
      if (visited.has(member)) continue
      visited.add(member)
      const previous = matched.get(member)
      if (previous === undefined || assign(previous, visited)) { matched.set(member, position); return true }
    }
    return false
  }
  let filled = 0
  for (let position = 0; position < positions.length; position++) if (assign(position, new Set())) filled++
  return { required: positions.length, filled, shortage: positions.length - filled }
}

/** A capacity warning, not a panel proposal. Auto-Fill also checks transfer buffers,
 * locked positions, duty limits and workload across the complete window. */
export function staffingShortageSessionIds(slots: SessionCoverage[]) {
  const active = slots.filter(slot => slot.active).map(slot => ({ slot, start: +new Date(slot.startTime), end: +new Date(slot.endTime) + (slot.buffer ?? 0) * 60_000 })).sort((a, b) => a.start - b.start)
  const shortages = new Set<string>()
  let simultaneous: typeof active = []
  for (let index = 0; index < active.length;) {
    const start = active[index].start
    simultaneous = simultaneous.filter(item => item.end > start)
    while (index < active.length && active[index].start === start) simultaneous.push(active[index++])
    if (simultaneousStaffing(simultaneous.map(item => item.slot)).shortage) simultaneous.forEach(item => shortages.add(item.slot.id))
  }
  return shortages
}
