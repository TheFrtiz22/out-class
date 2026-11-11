"use client"
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { LAST_PRODUCT_ROUTE_KEY, safeExitHref, type FocusWidth } from "@/lib/focus-routes"

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
}

type FrameContext = { set: (owner: symbol, details: FocusDetails | null) => void }
export const FocusFrameContext = createContext<FrameContext | null>(null)
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * Lets a screen inside a focus frame name its task and club, or take over Exit.
 * A no-op outside a frame, so shared components can call it unconditionally.
 * Registrations merge in the order they first mounted; two layers should not set the same field.
 */
export function useFocusFrame(details: FocusDetails) {
  const context = useContext(FocusFrameContext)
  const [owner] = useState(() => Symbol("focus-details"))
  const latest = useRef(details)
  useIsomorphicLayoutEffect(() => { latest.current = details })
  const exit = useCallback(() => latest.current.onExit?.(), [])
  const { task, club, exitHref, width } = details, hasExit = !!details.onExit
  useIsomorphicLayoutEffect(() => {
    context?.set(owner, { task, club: club ? { name: club.name, color: club.color } : club, exitHref, width, onExit: hasExit ? exit : undefined })
  }, [context, owner, task, club?.name, club?.color, exitHref, width, hasExit, exit])
  useEffect(() => () => context?.set(owner, null), [context, owner])
}

/**
 * The last product page in this tab, only for the same account and mode (live or demo), so
 * Exit never offers one person's page, with its club or applicant ids, to the next sign-in.
 */
export function storedProductRoute(account: string) {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(LAST_PRODUCT_ROUTE_KEY) || "null") as { href?: string; account?: string } | null
    return stored?.account === account ? safeExitHref(stored.href) : null
  } catch { return null }
}

/** Records the current product page so a focus screen's Exit can return to it. */
export function rememberProductRoute(account: string) {
  try {
    const href = safeExitHref(window.location.pathname + window.location.search)
    if (href) window.sessionStorage.setItem(LAST_PRODUCT_ROUTE_KEY, JSON.stringify({ href, account }))
  } catch { /* Exit falls back to /home without storage. */ }
}

/** Identifies whose page was stored: the signed-in (or viewed) account and live/demo mode. */
export function productRouteAccount(userId: string | null | undefined, demo: boolean) {
  return `${demo ? "demo" : "live"}:${userId ?? "anonymous"}`
}
