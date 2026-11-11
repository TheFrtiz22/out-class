"use client"

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect
import type { PersonalSection } from "@/lib/product-navigation"
import type { ViewId } from "@/lib/views"

/**
 * What a page hands to the persistent workspace shell. The shell derives the workspace, club, rail
 * sections and active item from the URL; a page only adds its own title and the callbacks that need
 * its state (the student app's in-place navigation, the club workspace's review drawers).
 */
export type ShellBindings = {
  title?: string
  /** Fallback rail item for pages no URL describes. */
  active?: string
  /** Full-page steps (student onboarding, the legacy interview view) hide the chrome without remounting it. */
  bare?: boolean
  onNavigate?: (view: ViewId, section?: PersonalSection) => void
  onSelect?: (id: string) => void
  onModeSelect?: (id: "recruiting" | "club") => void
}

type Registry = { register: (owner: symbol, bindings: ShellBindings | null) => void }
export const WorkspaceShellContext = createContext<Registry | null>(null)

/** True inside `app/(workspace)`, where the shell is already on screen and pages render content only. */
export function useInWorkspaceShell() {
  return useContext(WorkspaceShellContext) !== null
}

/** Shell bindings owned by whichever page registered last; a page's cleanup clears only its own. */
export function useShellBindingsState() {
  const [state, setState] = useState<{ owner: symbol; value: ShellBindings } | null>(null)
  const registry = useRef<Registry>({
    register: (owner, bindings) => setState(current => bindings ? { owner, value: bindings } : current?.owner === owner ? null : current),
  }).current
  return [state?.value ?? null, registry] as const
}

/**
 * Registers this page's bindings with the shell. Callbacks are read through a ref, so a page
 * re-rendering never re-registers (or re-renders the shell) unless its title or active item changes.
 */
export function useShellBindings(bindings: ShellBindings, enabled = true) {
  const registry = useContext(WorkspaceShellContext)
  const [owner] = useState(() => Symbol("shell-bindings"))
  const latest = useRef(bindings)
  // Committed callbacks only: a discarded concurrent render never reaches the shell.
  useBrowserLayoutEffect(() => { latest.current = bindings })
  const { title, active, bare } = bindings
  const has = [!!bindings.onNavigate, !!bindings.onSelect, !!bindings.onModeSelect].join()
  useEffect(() => {
    if (!registry) return
    if (!enabled) { registry.register(owner, null); return }
    const [navigate, select, mode] = has.split(",").map(value => value === "true")
    registry.register(owner, {
      title, active, bare,
      onNavigate: navigate ? (view, section) => latest.current.onNavigate?.(view, section) : undefined,
      onSelect: select ? id => latest.current.onSelect?.(id) : undefined,
      onModeSelect: mode ? id => latest.current.onModeSelect?.(id) : undefined,
    })
  }, [registry, owner, enabled, title, active, bare, has])
  useEffect(() => () => registry?.register(owner, null), [registry, owner])
}
