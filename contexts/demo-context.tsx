"use client"
import { useEffect, useState, type ReactNode } from "react"
import { DemoContext, useDemoMode } from "@/contexts/demo-mode"
export { useDemoMode }
import { resolveStudentView } from "@/lib/student-navigation"
import { studentRouteForPath } from "@/lib/navigation"
// The demo store and seed data load only when Demo Mode is enabled, so they are
// not part of every page's root bundle. Presenter-only.
type DemoStoreModule = typeof import("@/lib/demo/store")
let loadedStore: DemoStoreModule | null = null
const loadDemoStore = async () => (loadedStore ??= await import("@/lib/demo/store"))
import type { DemoState } from "@/lib/demo/seed"
import { OutClassLoadingScreen } from "@/components/outclass-loading-screen"

const Context = DemoContext
export function DemoDataProvider({
  children,
  allowed = false,
  enabled = false,
  clearStaleSession = false,
  template,
}: {
  children: ReactNode
  allowed?: boolean
  enabled?: boolean
  clearStaleSession?: boolean
  template?: DemoState
}) {
  const [ready, setReady] = useState(!enabled && !clearStaleSession),
    [state, setState] = useState<DemoState | null>(null),
    [error, setError] = useState("")
  const [epoch, setEpoch] = useState(0)
  const [cleanupRetry, setCleanupRetry] = useState(0)
  useEffect(() => {
    let current = true
    let unsubscribe = () => {}
    if (enabled && allowed) {
      loadDemoStore()
        .then(({ demoStore }) => {
          if (!current) return
          unsubscribe = demoStore.subscribe(() =>
            setState(demoStore.active() ? demoStore.get() : null),
          )
          try {
            demoStore.start(template)
          } catch {
            setError("Demo storage is unavailable. Allow browser storage or turn Demo Mode off.")
          }
        })
        .catch(() => {
          if (current) setError("Demo Mode could not load. Check your connection and try again.")
        })
    } else loadedStore?.demoStore.stop()
    if (clearStaleSession) {
      setReady(false)
      setError("")
      // Explicit exit clears the cookie even if auth is unavailable or access changed again.
      void fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      })
        .then(response => {
          if (!response.ok) throw new Error("Access refresh failed")
          if (current) setReady(true)
        })
        .catch(() => {
          if (current) setError("Could not clear the previous demo session. Check your connection and try again.")
        })
    } else setReady(true)
    const sync = (event: StorageEvent) => {
      if (event.key === "outclass.demo-mode-change") window.location.reload()
      if (event.key === "outclass.presentation.v1" && loadedStore?.demoStore.active()) {
        try { loadedStore.demoStore.refresh() } catch { setError("Demo could not refresh. Retry or reset Demo Mode.") }
      }
    }
    window.addEventListener("storage", sync)
    return () => {
      current = false
      unsubscribe()
      window.removeEventListener("storage", sync)
    }
  }, [allowed, enabled, clearStaleSession, cleanupRetry, template])
  async function toggleDemo() {
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        const reasons: Record<string, string> = {
          disabled: "Demo Mode is disabled for this deployment.",
          "invalid-configuration": "Demo configuration is invalid. Check the deployment’s server environment variables.",
          "sign-in-required": "Sign in with your authorized UVA account, then enable Demo Mode.",
          "not-allowlisted": "This account is not on the demo presenter allowlist.",
        }
        throw new Error(reasons[result?.reason] || "Demo mode could not be changed. Check your access and try again.")
      }
      if (enabled) loadedStore?.demoStore.stop()
      try {
        localStorage.setItem("outclass.demo-mode-change", String(Date.now()))
      } catch {
        /* Exit still succeeds when storage is unavailable. */
      }
      window.location.assign("/")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.")
    }
  }
  function viewAs(role: "student" | "leader", clubId = state?.clubs[0].id) {
    if (!clubId) return
    try {
      if (!loadedStore) throw new Error("Demo Mode is not loaded.")
      const { demoStore } = loadedStore
      const current = demoStore.get()
      const url = new URL(window.location.href)
      url.searchParams.delete("demoClub")
      // Selecting an already active club must not reset its URL or mounted drafts.
      if (clubId === current.clubs[0].id && current.perspective.role === role && current.perspective.clubId === clubId) {
        if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url)
        return
      }
      demoStore.mutate((s) => {
        if (clubId !== s.clubs[0].id) throw new Error("Demo management is limited to MII.")
        s.perspective = { role, clubId }
      })
      const requestedStudentView = role === "student" && (!!studentRouteForPath(url.pathname) || url.searchParams.get("workspace") === "student" && resolveStudentView(url.searchParams.get("view")))
      const requestedClubView = role === "leader" && url.pathname === `/club/${encodeURIComponent(clubId)}/workspace`
      if (!requestedStudentView && !requestedClubView) {
        url.searchParams.delete("workspace")
        url.searchParams.delete("view")
        url.searchParams.delete("section")
      }
      window.history.replaceState({}, "", url)
      setEpoch((v) => v + 1)
    } catch {
      setError("Could not save the demo perspective. Check available browser storage.")
    }
  }
  function resetDemo() {
    try {
      localStorage.removeItem("outclass.demo.customization.v1")
      if (!loadedStore) throw new Error("Demo Mode is not loaded.")
      loadedStore.demoStore.reset()
      const url = new URL(window.location.href)
      // A full navigation resets route-local state and Next's cached search parameters,
      // including resets initiated inside a club workspace.
      const preview = url.pathname === "/preview"
      url.pathname = preview ? "/preview" : "/home"
      url.search = preview ? new URLSearchParams({ workspace: "student", view: "student-dashboard" }).toString() : ""
      url.hash = ""
      window.location.assign(url.toString())
    } catch {
      setError("Could not reset the demo. Check available browser storage.")
    }
  }

  return (
    <Context.Provider
      value={{
        allowed,
        ready,
        isDemoEnabled: enabled && allowed,
        state,
        error,
        demoIdentity: state && loadedStore?.demoStore.active() ? loadedStore.demoUser() : null,
        toggleDemo,
        viewAs,
        resetDemo,
      }}
    >
      {error && (
        <div role="alert" className="border-b bg-card p-4 text-sm">
          {error}
          <button onClick={() => clearStaleSession ? setCleanupRetry(value => value + 1) : void toggleDemo()} className="ml-4 underline">
            {enabled ? "Exit demo" : "Try again"}
          </button>
        </div>
      )}
      {ready && (!enabled || state) ? (
        <div key={epoch} style={{ display: "contents" }}>
          {children}
        </div>
      ) : error ? null : <OutClassLoadingScreen />}
    </Context.Provider>
  )
}
