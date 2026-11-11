import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { getSessionUser, requireAuth } from "@/utils/auth"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"

/**
 * Server gate for a signed-in route. The frame (product shell or public header) is drawn once by
 * `app/(workspace)/layout.tsx`, so navigating between workspaces never remounts it; this component
 * keeps each route's own access rule and renders only the page content.
 * `optional` pages render for signed-out visitors (the group layout puts them in the public frame).
 */
export async function AuthenticatedPageLayout({ children, optional = false, allowDemo = false }: { children: ReactNode; optional?: boolean; allowDemo?: boolean }) {
  if (optional || allowDemo) {
    const [{ data: { user }, error }, jar] = await Promise.all([getSessionUser(), cookies()])
    // Public discovery and client-backed meetings retain their existing demo flows.
    // Settings always uses live authorization here. Invitations, club claims and club access are
    // `optional` so signed-out visitors get a sign-in card; each of those PAGES calls requireAuth
    // (or requireClubPermission) itself for any session. An `optional` route must do the same.
    if (!jar.has(PLATFORM_VIEW_COOKIE) && jar.get(DEMO_COOKIE)?.value === "1" && canAccessDemo(error || !user?.email_confirmed_at ? undefined : user.email)) return <>{children}</>
    if (optional && !jar.has(PLATFORM_VIEW_COOKIE) && (error || !user?.email_confirmed_at)) return <>{children}</>
  }
  await requireAuth()
  return <>{children}</>
}
