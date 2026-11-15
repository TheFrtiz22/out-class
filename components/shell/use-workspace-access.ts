"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { hasWorkspace } from "@/lib/permissions"

/** Per-tab, per-account layout hint: this account's last answer from the eligibility endpoint. */
const adminHintKey = (identity: string) => `outclass:admin-segment:${identity}`

/** Presentation consumes existing authorities: the account's memberships and the
 * server's platform eligibility endpoint. It never grants route/action access.
 * `adminPlaceholder` only reserves the Admin segment's width while eligibility is being
 * (re)checked, from the last answer this tab saw; it is never a link and never authorization. */
export function useWorkspaceAccess() {
  const { user, loading, isImpersonating, refreshUser, activeClubId } = useAuth()
  const { isDemoEnabled } = useDemoMode()
  const identity = user && !loading && !isImpersonating && !user.impersonating && !isDemoEnabled ? user.id : ""
  const [admin, setAdmin] = useState({ identity: "", status: "pending", eligible: false })
  const [adminHint, setAdminHint] = useState({ identity: "", eligible: false })
  // Read before paint, so a known admin's pill keeps its width instead of widening after the fetch.
  useLayoutEffect(() => {
    if (!identity) return
    let eligible = false
    try { eligible = window.sessionStorage.getItem(adminHintKey(identity)) === "1" } catch { /* storage blocked: no hint */ }
    setAdminHint({ identity, eligible })
  }, [identity])
  const refreshIdentity = useRef(refreshUser)
  useEffect(() => { refreshIdentity.current = refreshUser }, [refreshUser])
  useEffect(() => {
    if (!identity) return
    let live = true, running = false, queued = false, lastRefresh = 0
    const controller = new AbortController()
    function settle(eligible: boolean) {
      setAdmin({ identity, status: "settled", eligible })
      setAdminHint({ identity, eligible })
      try { if (eligible) window.sessionStorage.setItem(adminHintKey(identity), "1"); else window.sessionStorage.removeItem(adminHintKey(identity)) } catch { /* storage blocked */ }
    }
    async function refresh(memberships = false) {
      if (running) { queued ||= memberships; return }
      running = true; lastRefresh = Date.now()
      setAdmin({ identity, status: "pending", eligible: false })
      const accountRefresh = memberships ? refreshIdentity.current() : Promise.resolve()
      try {
        const response = await fetch("/api/platform/eligibility", { cache: "no-store", signal: controller.signal })
        const result = response.ok ? await response.json() : null
        if (live) settle(result?.eligible === true)
      } catch {
        if (live) settle(false)
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
  const pending = !!loading || !!identity && (admin.identity !== identity || admin.status === "pending")
  const isAdmin = !!identity && admin.identity === identity && admin.eligible
  return {
    personal: !!user && !loading,
    clubs: user && !loading ? user.memberships.filter(hasWorkspace) : [],
    activeClubId,
    admin: isAdmin,
    pending,
    adminPlaceholder: !isAdmin && pending && !!identity && adminHint.identity === identity && adminHint.eligible,
  }
}
export type WorkspaceAccess = ReturnType<typeof useWorkspaceAccess>
