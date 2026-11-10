import { cookies } from "next/headers"
import { getSessionUser } from "@/utils/auth"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"

/**
 * Which frame the signed-in route group draws: the persistent product shell, or the public header
 * and footer for signed-out visitors. This only picks the chrome. Every page keeps its own server
 * authorization (`AuthenticatedPageLayout` gates, `requireAuth`, `requireClubPermission`,
 * `requirePlatformAdmin`), so a signed-out visitor on a required page is still redirected or refused.
 * Same rules `AuthenticatedPageLayout` applied before the shell moved into `app/(workspace)/layout.tsx`.
 */
export async function workspaceFrame(): Promise<"shell" | "public"> {
  const [{ data: { user }, error }, jar] = await Promise.all([getSessionUser(), cookies()])
  if (jar.has(PLATFORM_VIEW_COOKIE)) return "shell"
  if (jar.get(DEMO_COOKIE)?.value === "1" && canAccessDemo(error || !user?.email_confirmed_at ? undefined : user.email)) return "shell"
  return error || !user?.email_confirmed_at ? "public" : "shell"
}
