import type { getClubWorkspaceOverview } from "@/lib/workspace-api"
export type MemberOverviewData = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
/** The member date format shared by dashboards. Members see club home (components/manager-overview.tsx),
 * which gates every card by the overview's permission-scoped data. */
export const memberDate = (value: Date | string) => new Date(value).toLocaleString([], { month: "short", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" })
