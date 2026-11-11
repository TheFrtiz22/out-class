"use client"
import Link from "next/link"
import { useEffect, useLayoutEffect, useRef, type MouseEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The one look for in-page section tabs that navigate (Decisions, the phone Recruiting sub-tabs): the
 * segmented pill track with a sliding navy indicator. Each tab is a link, so tabs are bookmarkable and
 * work with the browser's back button. Tab panels that do not navigate use segmented `Tabs`.
 */
export type SectionTab = { id: string; label: ReactNode; href: string; count?: number }

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

export function SectionTabs({ label, items, current, onNavigate, className }: {
  label: string
  items: SectionTab[]
  current: string | null | undefined
  /** Runs for plain left clicks; call `event.preventDefault()` to stop or take over navigation. */
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void
  className?: string
}) {
  const nav = useRef<HTMLElement>(null)
  const index = items.findIndex(item => item.id === current)
  useBrowserLayoutEffect(() => {
    const el = nav.current
    if (!el) return
    const place = () => {
      const active = el.querySelectorAll<HTMLElement>("[data-segment]")[index]
      if (!active) { el.removeAttribute("data-measured"); return }
      el.style.setProperty("--indicator-x", `${active.offsetLeft}px`)
      el.style.setProperty("--indicator-width", `${active.offsetWidth}px`)
      el.setAttribute("data-measured", "true")
    }
    place()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(place)
    observer.observe(el)
    el.querySelectorAll("[data-segment]").forEach(link => observer.observe(link))
    return () => observer.disconnect()
  }, [index, items.length])
  if (items.length < 2) return null
  return <nav ref={nav} aria-label={label} data-slot="section-tabs" data-size="compact" data-sliding="true" data-has-active={index >= 0}
    className={cn("oc-segmented-control oc-section-tabs", className)}>
    <span className="oc-segmented-indicator" aria-hidden="true" />
    {items.map(item => <Link key={item.id} href={item.href} prefetch={false} data-segment="" data-selected={current === item.id || undefined}
      aria-current={current === item.id ? "page" : undefined}
      onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; onNavigate?.(event, item.href) }}>
      {item.label}{item.count != null && <span className="oc-segment-count">{" "}{item.count}</span>}
    </Link>)}
  </nav>
}
