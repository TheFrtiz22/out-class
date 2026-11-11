import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { isUvaEmail } from "@/lib/auth"
import { TERMS_ACCEPTANCE_REQUIRED } from "@/lib/legal-versions"
import { getSessionUser } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { hasCurrentTermsAcceptance } from "@/utils/terms-acceptance"
import { TermsAcceptanceScreen } from "./terms-acceptance-screen"

/** Server decision for the one-time Terms screen; exported for tests. */
export async function termsGateDecision(deps: {
  required: boolean
  demo: boolean
  impersonating: boolean
  userId: string | null
  accepted: (userId: string) => Promise<boolean>
}): Promise<"pass" | "ask"> {
  // Demo Mode has no live account; a support session must never be shown, or answer, the user's prompt.
  if (!deps.required || deps.demo || deps.impersonating || !deps.userId) return "pass"
  try {
    return await deps.accepted(deps.userId) ? "pass" : "ask"
  } catch (error) {
    // A database fault must not take the product down; the next request asks again.
    console.error("Terms acceptance check failed", error instanceof Error ? error.name : "unknown")
    return "pass"
  }
}

/**
 * Wraps signed-in route groups. While acceptance is required (legal pages public), a signed-in
 * account holder who has not accepted the current versions sees a calm one-time screen instead
 * of product pages. Account settings and sign-in steps stay reachable (the client screen checks
 * the path), and the screen itself offers sign-out. Off (the default today) it costs nothing.
 */
export async function TermsGate({ children }: { children: ReactNode }) {
  if (!TERMS_ACCEPTANCE_REQUIRED) return children
  const jar = await cookies()
  const demo = jar.get(DEMO_COOKIE)?.value === "1", impersonating = jar.has(PLATFORM_VIEW_COOKIE)
  let userId: string | null = null
  if (!demo && !impersonating) {
    const { data: { user }, error } = await getSessionUser()
    if (!error && user?.email_confirmed_at && user.email && isUvaEmail(user.email)) userId = user.id
  }
  const decision = await termsGateDecision({ required: true, demo, impersonating, userId, accepted: id => hasCurrentTermsAcceptance(prisma, id) })
  return decision === "ask" ? <TermsAcceptanceScreen>{children}</TermsAcceptanceScreen> : children
}
