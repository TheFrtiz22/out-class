import { z } from "zod"

export const memberGroupSplitSchema = z.object({
  mode: z.enum(["SIZE", "COUNT"]),
  amount: z.number().int().min(1).max(500),
  seed: z.string().uuid(),
}).strict()
export type MemberGroupSplit = z.infer<typeof memberGroupSplitSchema>
export type GroupableMember = { id: string; status: string; joinedAt: Date | string; accessRole: string; isOwner: boolean; groups: string[]; user: { disabledAt: Date | string | null; studentProfile: { academicYear?: string } | null } }
export type MemberGroupCriteria = { everyone: boolean; years: string[]; roles: string[]; groups: string[]; recent: boolean; people: string[]; match: "ANY" | "ALL" }
export function selectGroupMembers<T extends GroupableMember>(members: T[], criteria: MemberGroupCriteria, now = Date.now()): T[] {
  return members.filter(member => {
    if (member.status !== "ACTIVE" || member.user.disabledAt) return false
    if (criteria.everyone) return true
    const tests = [
      criteria.years.length ? criteria.years.includes(member.user.studentProfile?.academicYear?.replace(/\*$/, "") ?? "") : null,
      criteria.roles.length ? criteria.roles.includes(member.isOwner ? "OWNER" : member.accessRole) : null,
      criteria.groups.length ? member.groups.some(group => criteria.groups.includes(group)) : null,
      criteria.recent ? +new Date(member.joinedAt) <= now && +new Date(member.joinedAt) >= now - 30 * 86400000 : null,
      criteria.people.length ? criteria.people.includes(member.id) : null,
    ].filter((test): test is boolean => test !== null)
    return tests.length > 0 && (criteria.match === "ALL" ? tests.every(Boolean) : tests.some(Boolean))
  })
}
/** A seeded preview is the exact partition persisted by the server, independent of roster order. */
export function planMemberGroups(ids: string[], name: string, split: MemberGroupSplit | null) {
  const members = [...new Set(ids)].sort()
  if (!members.length) throw new Error("Choose at least one member.")
  if (!split) return [{ name, memberIds: members }]
  if (!Number.isInteger(split.amount) || split.amount < 1 || split.amount > 500) throw new Error("Enter a whole number from 1 to 500.")
  const count = split.mode === "COUNT" ? split.amount : Math.ceil(members.length / split.amount)
  if (count > members.length || count > 100) throw new Error("Choose between 1 and 100 groups, with at least one member per group.")
  let seed = 2166136261
  for (const character of split.seed) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
  for (let index = members.length - 1; index > 0; index--) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
    const other = (seed >>> 0) % (index + 1)
    ;[members[index], members[other]] = [members[other], members[index]]
  }
  const groups = Array.from({ length: count }, (_, index) => ({ name: `${name} / ${index + 1}`, memberIds: [] as string[] }))
  members.forEach((id, index) => groups[index % count].memberIds.push(id))
  return groups
}
