"use client"
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { getCorkboard, setCorkboardClub } from "@/lib/workspace-api"
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
      const result = await getCorkboard()
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
    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onFocus)
    return () => { requests.current++; window.removeEventListener("focus", onFocus); window.removeEventListener("pageshow", onFocus) }
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
      const result = await setCorkboardClub({ clubId: club.id, saved })
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
