"use client"
import "./focus-frame.css"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { X } from "@/components/icons"
import { OutClassLogo } from "@/components/outclass-logo"
import { FOCUS_EXIT_FALLBACK, focusRouteFor, safeExitHref } from "@/lib/focus-routes"
import { FocusFrameContext, productRouteAccount, storedProductRoute, type FocusDetails } from "@/components/shell/focus-frame-context"
export { useFocusFrame, rememberProductRoute, productRouteAccount, type FocusDetails } from "@/components/shell/focus-frame-context"

/**
 * The calm full-screen frame for single-task screens: a slim bar with the
 * OutClass mark, the club, the task and Exit, over the shared page tokens.
 * As the (focus) route layout it takes defaults from the path; screens refine them
 * with useFocusFrame. The projector is a page that renders `data-theme="present"`:
 * the frame follows it in CSS, so the server render is already dark and full width.
 * In place (`overlay`) it covers the product shell until onExit and is not a landmark.
 */
export function FocusFrame({ children, overlay = false, ...props }: FocusDetails & { children: ReactNode; overlay?: boolean }) {
  const pathname = usePathname() ?? ""
  const { user } = useAuth(), demo = useDemoMode()
  const account = productRouteAccount(user?.id, demo.isDemoEnabled)
  const [entries, setEntries] = useState<[symbol, FocusDetails][]>([])
  const [fallback, setFallback] = useState(FOCUS_EXIT_FALLBACK)
  useEffect(() => { setFallback(storedProductRoute(account) ?? FOCUS_EXIT_FALLBACK) }, [pathname, account])
  // Updates keep their place, so the merge order is the order screens first mounted.
  const set = useCallback((owner: symbol, details: FocusDetails | null) => setEntries(current => {
    if (!details) return current.filter(([key]) => key !== owner)
    return current.some(([key]) => key === owner) ? current.map(entry => entry[0] === owner ? [owner, details] : entry) : [...current, [owner, details]]
  }), [])
  const context = useMemo(() => ({ set }), [set])
  const route = overlay ? null : focusRouteFor(pathname)
  const defined = (value: object) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
  const details = entries.reduce<FocusDetails>((merged, [, next]) => ({ ...merged, ...defined(next) }), { task: route?.task, width: route?.width ?? "content", ...defined(props) })
  const exitHref = safeExitHref(details.exitHref) ?? fallback
  const style = details.club?.color ? { "--oc-club-accent": details.club.color } as CSSProperties : undefined
  const exit = details.onExit
  return <FocusFrameContext.Provider value={context}>
    <div className="oc-focus-frame" data-focus-frame={overlay ? "overlay" : "route"} data-width={details.width} style={style}>
      {!overlay && <a href="#focus-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:bg-card focus:p-3">Skip to content</a>}
      <div className="oc-focus-reveal" aria-hidden="true" />
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
      {overlay
        ? <div className="oc-focus-content">{children}</div>
        : <main id="focus-content" tabIndex={-1} className="oc-focus-content">{children}</main>}
    </div>
  </FocusFrameContext.Provider>
}
