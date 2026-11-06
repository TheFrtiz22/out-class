"use client"
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef } from "react"
import { LAST_PRODUCT_ROUTE_KEY, safeExitHref, type FocusTheme, type FocusWidth } from "@/lib/focus-routes"

/* Hook and context only: shared screens import this without pulling in the frame's UI. */
export type FocusDetails = {
  /** The task, e.g. "Interview · Round 2". Defaults to the route's task name. */
  task?: string
  club?: { name: string; color?: string | null } | null
  /** Where Exit goes. Defaults to the last product page, then /home. */
  exitHref?: string
  /** Runs instead of navigating, e.g. to confirm unsaved work. */
  onExit?: () => void
  width?: FocusWidth
  theme?: FocusTheme
}

type FrameContext = { set: (owner: symbol, details: FocusDetails | null) => void }
export const FocusFrameContext = createContext<FrameContext | null>(null)
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * Lets a screen inside a focus frame name its task and club, or take over Exit.
 * A no-op outside a frame, so shared components can call it unconditionally.
 */
export function useFocusFrame(details: FocusDetails) {
  const context = useContext(FocusFrameContext)
  const owner = useRef(Symbol("focus-details")).current
  const latest = useRef(details); latest.current = details
  const exit = useCallback(() => latest.current.onExit?.(), [])
  const { task, club, exitHref, width, theme } = details, hasExit = !!details.onExit
  useIsomorphicLayoutEffect(() => {
    context?.set(owner, { task, club: club ? { name: club.name, color: club.color } : club, exitHref, width, theme, onExit: hasExit ? exit : undefined })
  }, [context, owner, task, club?.name, club?.color, exitHref, width, theme, hasExit, exit])
  useEffect(() => () => context?.set(owner, null), [context, owner])
}

export function storedProductRoute() {
  try { return safeExitHref(window.sessionStorage.getItem(LAST_PRODUCT_ROUTE_KEY)) } catch { return null }
}

/** Records the current product page so a focus screen's Exit can return to it. */
export function rememberProductRoute() {
  try {
    const href = safeExitHref(window.location.pathname + window.location.search)
    if (href) window.sessionStorage.setItem(LAST_PRODUCT_ROUTE_KEY, href)
  } catch { /* Exit falls back to /home without storage. */ }
}

