"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { hasWorkspace } from "@/lib/permissions"

/** Presentation consumes existing authorities: the account's memberships and the
 * server's platform eligibility endpoint. It never grants route/action access. */
export function useWorkspaceAccess() {
  const { user, loading, isImpersonating, refreshUser, activeClubId } = useAuth()
  const { isDemoEnabled } = useDemoMode()
  const identity = user && !loading && !isImpersonating && !user.impersonating && !isDemoEnabled ? user.id : ""
  const [admin, setAdmin] = useState({ identity: "", status: "pending", eligible: false })
  const refreshIdentity = useRef(refreshUser)
  useEffect(() => { refreshIdentity.current = refreshUser }, [refreshUser])
  useEffect(() => {
    if (!identity) return
    let live = true, running = false, queued = false, lastRefresh = 0
    const controller = new AbortController()
    async function refresh(memberships = false) {
      if (running) { queued ||= memberships; return }
      running = true; lastRefresh = Date.now()
      setAdmin({ identity, status: "pending", eligible: false })
      const accountRefresh = memberships ? refreshIdentity.current() : Promise.resolve()
      try {
        const response = await fetch("/api/platform/eligibility", { cache: "no-store", signal: controller.signal })
        const result = response.ok ? await response.json() : null
        if (live) setAdmin({ identity, status: "settled", eligible: result?.eligible === true })
      } catch {
        if (live) setAdmin({ identity, status: "settled", eligible: false })
      } finally {
        // AuthProvider deduplicates account refreshes; no per-control membership reads.
        await accountRefresh
        running = false
        if (queued && live) { queued = false; void refresh(true) }
      }
    }
    void refresh()
    const focus = () => { if (document.visibilityState === "visible" && Date.now() - lastRefresh > 30_000) void refresh(true) }
    const changed = () => { void refresh(true) }
    window.addEventListener("focus", focus)
    document.addEventListener("visibilitychange", focus)
    window.addEventListener("outclass:workspace-access-changed", changed)
    return () => { live = false; controller.abort(); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); window.removeEventListener("outclass:workspace-access-changed", changed) }
  }, [identity])
  return {
    personal: !!user && !loading,
    clubs: user && !loading ? user.memberships.filter(hasWorkspace) : [],
    activeClubId,
    admin: !!identity && admin.identity === identity && admin.eligible,
    pending: !!loading || !!identity && (admin.identity !== identity || admin.status === "pending"),
  }
}
export type WorkspaceAccess = ReturnType<typeof useWorkspaceAccess>
