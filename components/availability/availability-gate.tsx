import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { isUvaEmail } from "@/lib/auth"
import { emptySchedule, type AvailabilityDocument } from "@/lib/availability"
import { availabilityGateDecision, type AvailabilityRequirementAccount } from "@/lib/availability-requirement"
import { getSessionUser } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { loadAvailabilityRequirement } from "@/utils/availability-requirement"
import { AvailabilityRequirementScreen } from "./availability-requirement-screen"

/**
 * Wraps signed-in route groups after the Terms screen. A student who has not saved weekly availability
 * (lib/availability-requirement.ts) sees the required availability step instead of product pages: new
 * signups land here right after the onboarding interest survey, existing accounts on their next visit.
 * Account settings and sign-in steps stay reachable (the client screen checks the path).
 */
export async function AvailabilityGate({ children }: { children: ReactNode }) {
  const jar = await cookies()
  const demo = jar.get(DEMO_COOKIE)?.value === "1", impersonating = jar.has(PLATFORM_VIEW_COOKIE)
  let userId: string | null = null
  if (!demo && !impersonating) {
    const { data: { user }, error } = await getSessionUser()
    if (!error && user?.email_confirmed_at && user.email && isUvaEmail(user.email)) userId = user.id
  }
  let account: AvailabilityRequirementAccount | null = null
  const decision = await availabilityGateDecision({ demo, impersonating, userId, load: async id => (account = await loadAvailabilityRequirement(prisma, id)) })
  if (decision === "pass" || !userId) return children
  const loaded = account as AvailabilityRequirementAccount | null
  const initial: AvailabilityDocument = { accountId: userId, schedule: loaded?.schedule ?? emptySchedule(), revision: loaded?.revision ?? 0 }
  return <AvailabilityRequirementScreen initial={initial}>{children}</AvailabilityRequirementScreen>
}
