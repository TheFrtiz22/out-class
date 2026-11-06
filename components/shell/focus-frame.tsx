"use client"
import "./focus-frame.css"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { X } from "@/components/icons"
import { OutClassLogo } from "@/components/outclass-logo"
import { FOCUS_EXIT_FALLBACK, focusRouteFor, safeExitHref } from "@/lib/focus-routes"
import { FocusFrameContext, storedProductRoute, type FocusDetails } from "@/components/shell/focus-frame-context"
export { useFocusFrame, rememberProductRoute, type FocusDetails } from "@/components/shell/focus-frame-context"

/**
 * The calm full-screen frame for single-task screens: a slim bar with the
 * OutClass mark, the club, the task and Exit, over the shared page tokens.
 * As the (focus) route layout it reads its defaults from the URL; in place
 * (`overlay`) it covers the product shell until onExit.
 */
export function FocusFrame({ children, overlay = false, ...props }: FocusDetails & { children: ReactNode; overlay?: boolean }) {
  const pathname = usePathname() ?? ""
  const [entries, setEntries] = useState<[symbol, FocusDetails][]>([])
  // Read the query after mount: useSearchParams would opt every static focus page out of prerendering.
  const [search, setSearch] = useState("")
  const [fallback, setFallback] = useState(FOCUS_EXIT_FALLBACK)
  useEffect(() => {
    const sync = () => setSearch(window.location.search)
    sync(); setFallback(storedProductRoute() ?? FOCUS_EXIT_FALLBACK)
    window.addEventListener("popstate", sync)
    return () => window.removeEventListener("popstate", sync)
  }, [pathname])
  const set = useCallback((owner: symbol, details: FocusDetails | null) => setEntries(current => {
    const rest = current.filter(([key]) => key !== owner)
    return details ? [...rest, [owner, details]] : rest
  }), [])
  const context = useMemo(() => ({ set }), [set])
  const route = overlay ? null : focusRouteFor(pathname, new URLSearchParams(search))
  // Later registrations (deeper screens) win over earlier ones; props win over the route.
  const details = entries.reduce<FocusDetails>((merged, [, next]) => ({ ...merged, ...Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)) }), { task: route?.task, width: route?.width ?? "content", theme: route?.theme, ...Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined)) })
  const exitHref = safeExitHref(details.exitHref) ?? fallback
  const style = details.club?.color ? { "--oc-club-accent": details.club.color } as CSSProperties : undefined
  const exit = details.onExit
  return <FocusFrameContext.Provider value={context}>
    <div className="oc-focus-frame" data-focus-frame={overlay ? "overlay" : "route"} data-theme={details.theme} data-width={details.width} style={style}>
      <a href="#focus-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:bg-card focus:p-3">Skip to content</a>
      <header className="oc-focus-bar">
        <span className="oc-focus-mark"><OutClassLogo variant="mark" /></span>
        <div className="oc-focus-context">
          {details.club?.name && <span className="oc-focus-club"><span className="oc-focus-accent" aria-hidden="true" />{details.club.name}</span>}
          {details.task && <span className="oc-focus-task">{details.task}</span>}
        </div>
        {exit
          ? <button type="button" className="oc-focus-exit" onClick={exit}><X aria-hidden="true" />Exit</button>
          : <Link className="oc-focus-exit" href={exitHref}><X aria-hidden="true" />Exit</Link>}
      </header>
      <main id="focus-content" tabIndex={-1} className="oc-focus-content">{children}</main>
    </div>
  </FocusFrameContext.Provider>
}
