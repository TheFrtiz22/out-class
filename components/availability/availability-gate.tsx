import { cache, type ReactNode } from "react"
import { cookies } from "next/headers"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { emptySchedule, parseSchedule, type AvailabilityDocument } from "@/lib/availability"
import { availabilityGateDecision, availabilityGateIdentity } from "@/lib/availability-requirement"
import { getSessionUser } from "@/utils/auth"
import { platformViewSession } from "@/utils/platform-view-as"
import { prisma } from "@/utils/prisma"
import { loadAvailabilityRequirement } from "@/utils/availability-requirement"
import { AvailabilityRequirementScreen } from "./availability-requirement-screen"

// One SQL statement per request, however many times the layout tree asks.
const loadRequirement = cache((userId: string) => loadAvailabilityRequirement(prisma, userId))

function reportGateFailure(error: unknown) {
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) void import("@sentry/nextjs").then(Sentry => { Sentry.captureException(error, { tags: { gate: "availability-requirement" } }) }).catch(() => {})
}

/**
 * Wraps signed-in route groups after the Terms screen. A student (any school) with a profile who has not
 * saved weekly availability (lib/availability-requirement.ts) gets the required step rendered on the
 * server in place of the workspace: new signups right after the onboarding interest survey, existing
 * accounts on their next visit. The step offers sign-out, and "no regular free time" finishes it.
 */
export async function AvailabilityGate({ children }: { children: ReactNode }) {
  const jar = await cookies()
  const identity = await availabilityGateIdentity({
    demoCookie: jar.get(DEMO_COOKIE)?.value,
    hasViewCookie: jar.has(PLATFORM_VIEW_COOKIE),
    viewSession: platformViewSession,
    sessionUser: async () => { const { data: { user }, error } = await getSessionUser(); return error ? null : user },
  })
  const decision = await availabilityGateDecision({ ...identity, load: loadRequirement, onError: reportGateFailure })
  if (decision === "pass" || !identity.userId) return children
  // Only an asked student pays for the editor's starting document.
  const saved = await prisma.userAvailability.findUnique({ where: { userId: identity.userId }, select: { schedule: true, revision: true } }).catch(() => null)
  let schedule = emptySchedule()
  try { if (saved) schedule = parseSchedule(saved.schedule) } catch { schedule = emptySchedule() }
  const initial: AvailabilityDocument = { accountId: identity.userId, schedule, revision: saved?.revision ?? 0 }
  return <AvailabilityRequirementScreen initial={initial} />
}
