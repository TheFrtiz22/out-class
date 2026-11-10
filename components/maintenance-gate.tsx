import type { ReactNode } from "react"
import { TriangleAlert } from "@/components/icons"
import { getSessionUser } from "@/utils/auth"
import { getSiteNotices, isMaintenanceExempt } from "@/utils/site-settings"

/** Shown in place of product routes while maintenance mode is ON (non-admins only).
 * The Admin maintenance notice, when set, is already in the site banner above it. */
export function MaintenancePage() {
  return (
    <main id="maintenance-content" className="mx-auto flex min-h-[60dvh] w-full max-w-[var(--oc-reading-width)] flex-col justify-center gap-4 px-4 py-16 sm:px-6">
      <TriangleAlert className="size-7 text-warning" />
      <h1 className="font-display text-2xl font-semibold">OutClass is undergoing maintenance</h1>
      <p className="text-muted-foreground">Your clubs, applications and messages are safe. Changes are paused until maintenance finishes. Please check back shortly.</p>
    </main>
  )
}

/**
 * Wraps product route groups. With maintenance mode OFF (the default) it costs one cached
 * settings read. When ON, signed-in non-admins see the maintenance page. Signed-out visitors
 * pass through (public pages and sign-in, including /platform/login, stay reachable), as do
 * platform administrators, including while they run a verified support session.
 */
export async function MaintenanceGate({ children }: { children: ReactNode }) {
  const notices = await getSiteNotices()
  if (!notices.maintenanceMode) return children
  // No shortcut for the view-as cookie: a real support session keeps the administrator's own
  // login (getSessionUser is the admin), so it passes the admin check below, while a bare or
  // forged cookie from anyone else does not.
  const { data: { user }, error } = await getSessionUser()
  if (error || !user) return children
  if (await isMaintenanceExempt(user.id)) return children
  return <MaintenancePage />
}
