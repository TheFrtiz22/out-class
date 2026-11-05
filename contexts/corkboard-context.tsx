"use client"
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
// Loaded on first use so every page's root bundle does not include the full
// workspace adapter layer (all features plus demo fallbacks).
// After the first read (on mount) the module is cached and calls are issued
// synchronously, so saves keep their immediate request ordering.
let workspaceModule: typeof import("@/lib/workspace-api") | null = null
const workspaceApi = async () => (workspaceModule ??= await import("@/lib/workspace-api"))
import type { DirectoryClub } from "@/lib/club-directory"
import type { CorkboardItem } from "@/lib/corkboard"

type CorkboardContextValue = {
  items: CorkboardItem[]; loading: boolean; authenticated: boolean; error: string; pending: ReadonlySet<string>
  refresh: () => Promise<void>; saveClub: (club: DirectoryClub, saved: boolean) => Promise<void>
}
const CorkboardContext = createContext<CorkboardContextValue | null>(null)
export function CorkboardProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const demo = useDemoMode()
  const identity = user ? `${demo.isDemoEnabled ? "demo" : "live"}:${user.id}` : ""
  const owner = useRef(identity), revision = useRef(0), pendingWrites = useRef(new Set<string>())
  const [state, setState] = useState<{ identity: string; items: CorkboardItem[]; loading: boolean; error: string }>({ identity: "", items: [], loading: true, error: "" })
  const [pending, setPending] = useState(new Set<string>())
  // Immediately hide another account's data, even before the identity-change effect runs.
  owner.current = identity
  const refresh = useCallback(async () => {
    if (!identity || pendingWrites.current.size) return
    const request = ++revision.current
    try {
      const result = await (workspaceModule ?? await workspaceApi()).getCorkboard()
      if (request === revision.current && owner.current === identity) setState({ identity, items: result.items, loading: false, error: "" })
    } catch {
      if (request === revision.current && owner.current === identity) setState(previous => ({ ...previous, identity, items: [], loading: false, error: "We couldn’t load your Corkboard. Please try again." }))
    }
  }, [identity])
  useEffect(() => {
    const requests = revision
    requests.current++
    pendingWrites.current.clear(); setPending(new Set())
    setState({ identity, items: [], loading: !!identity, error: "" })
    if (identity) void refresh()
    const onFocus = () => { if (document.visibilityState !== "hidden") void refresh() }
    // A normal load already fetched above; only a back/forward-cache restore is stale.
    const onRestore = (event: PageTransitionEvent) => { if (event.persisted) onFocus() }
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onRestore)
    return () => { requests.current++; window.removeEventListener("focus", onFocus); window.removeEventListener("pageshow", onRestore) }
  }, [identity, refresh])
  useEffect(() => { if (demo.isDemoEnabled) void refresh() }, [demo.state, demo.isDemoEnabled, refresh])
  async function saveClub(club: DirectoryClub, saved: boolean) {
    if (!identity || state.identity !== identity || state.loading || club.source === "preview") throw new Error("Sign in and load your Corkboard before saving.")
    if (pendingWrites.current.has(club.id)) return
    const previous = state.items.find(item => item.club.id === club.id)
    revision.current++ // Ignore reads started before this optimistic mutation.
    pendingWrites.current.add(club.id); setPending(new Set(pendingWrites.current))
    setState(value => ({ ...value, error: "", items: saved ? previous ? value.items : [{ club, savedAt: new Date().toISOString() }, ...value.items] : value.items.filter(item => item.club.id !== club.id) }))
    let succeeded = false
    try {
      const result = await (workspaceModule ?? await workspaceApi()).setCorkboardClub({ clubId: club.id, saved })
      succeeded = true
      if (owner.current === identity && result.savedAt) setState(value => ({ ...value, items: value.items.map(item => item.club.id === club.id ? { ...item, savedAt: result.savedAt! } : item) }))
    } catch {
      if (owner.current === identity) setState(value => ({ ...value, error: "We couldn’t save that change. Your previous selection has been restored.", items: previous ? [...value.items.filter(item => item.club.id !== club.id), previous] : value.items.filter(item => item.club.id !== club.id) }))
      throw new Error("Couldn’t save this change. Your previous selection has been restored.")
    } finally {
      if (owner.current === identity) { pendingWrites.current.delete(club.id); setPending(new Set(pendingWrites.current)); if (succeeded && !pendingWrites.current.size) void refresh() }
    }
  }
  return <CorkboardContext.Provider value={{ items: state.identity === identity ? state.items : [], loading: authLoading || (!!identity && (state.identity !== identity || state.loading)), authenticated: !!user, error: state.identity === identity ? state.error : "", pending, refresh, saveClub }}>{children}</CorkboardContext.Provider>
}
export function useCorkboard() {
  const context = useContext(CorkboardContext)
  if (!context) throw new Error("Corkboard requires the shared student data provider.")
  return context
}
