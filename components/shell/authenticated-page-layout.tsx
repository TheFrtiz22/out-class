import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { getSessionUser, requireAuth } from "@/utils/auth"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"
import { RouteWorkspaceShell } from "@/components/shell/route-workspace-shell"

/** Route layouts reuse the product shell; pages provide only their content. */
export async function AuthenticatedPageLayout({ children, optional = false, allowDemo = false }: { children: ReactNode; optional?: boolean; allowDemo?: boolean }) {
  if (optional || allowDemo) {
    const [{ data: { user }, error }, jar] = await Promise.all([getSessionUser(), cookies()])
    // Public discovery and client-backed meetings retain their existing demo flows.
    // Settings, invitations, claims and access editors always use live authorization.
    if (!jar.has(PLATFORM_VIEW_COOKIE) && jar.get(DEMO_COOKIE)?.value === "1" && canAccessDemo(error || !user?.email_confirmed_at ? undefined : user.email)) {
      return <RouteWorkspaceShell>{children}</RouteWorkspaceShell>
    }
    if (optional && !jar.has(PLATFORM_VIEW_COOKIE) && (error || !user?.email_confirmed_at)) return children
  }
  await requireAuth()
  return <RouteWorkspaceShell>{children}</RouteWorkspaceShell>
}
