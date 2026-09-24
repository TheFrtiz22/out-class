"use client"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { demoStore } from "@/lib/demo/store"
import type { DemoState } from "@/lib/demo/seed"

type DemoContextValue = {
  isDemoEnabled: boolean
  allowed: boolean
  ready: boolean
  state: DemoState | null
  toggleDemo: () => Promise<void>
  resetDemo: () => void
  viewAs: (role: "student" | "leader", clubId?: string) => void
  error: string
}
const Context = createContext<DemoContextValue | null>(null)
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
    const unsubscribe = demoStore.subscribe(() =>
      setState(demoStore.active() ? demoStore.get() : null),
    )
    if (enabled && allowed) {
      try {
        demoStore.start(template)
      } catch {
        setError("Demo storage is unavailable. Allow browser storage or turn Demo Mode off.")
      }
    } else demoStore.stop()
    let current = true
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
      if (enabled) demoStore.stop()
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
      demoStore.mutate((s) => {
        if (clubId !== s.clubs[0].id) throw new Error("Demo management is limited to MII.")
        s.perspective = { role, clubId }
      })
      const url = new URL(window.location.href)
      url.searchParams.delete("demoClub")
      window.history.replaceState({}, "", url)
      setEpoch((v) => v + 1)
    } catch {
      setError("Could not save the demo perspective. Check available browser storage.")
    }
  }
  function resetDemo() {
    try {
      localStorage.removeItem("outclass.demo.customization.v1")
      demoStore.reset()
      const url = new URL(window.location.href)
      url.searchParams.delete("demoClub")
      window.history.replaceState({}, "", url)
      setEpoch((v) => v + 1)
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
      ) : (
        <p role="status" className="p-8 text-sm">
          Preparing the OutClass demo…
        </p>
      )}
    </Context.Provider>
  )
}
export function useDemoMode() {
  const value = useContext(Context)
  if (!value) throw new Error("DemoDataProvider is required")
  return value
}
