"use client"
import Link from "next/link"
import type { MouseEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The one look for in-page section tabs (Decisions, the phone Recruiting sub-tabs, and
 * the Interviews tablist, which keeps Radix tab semantics but uses the same classes).
 * Each tab is a link, so tabs are bookmarkable and work with the browser's back button.
 */
export const sectionTabsListClass = "oc-section-tabs flex max-w-full gap-4 overflow-x-auto border-b border-border"
export const sectionTabClass = "inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:border-primary aria-[current=page]:font-medium aria-[current=page]:text-foreground data-[state=active]:border-primary data-[state=active]:font-medium data-[state=active]:text-foreground"

export type SectionTab = { id: string; label: ReactNode; href: string; count?: number }

export function SectionTabs({ label, items, current, onNavigate, className }: {
  label: string
  items: SectionTab[]
  current: string | null | undefined
  /** Runs for plain left clicks; call `event.preventDefault()` to stop or take over navigation. */
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void
  className?: string
}) {
  if (items.length < 2) return null
  return <nav aria-label={label} className={cn(sectionTabsListClass, className)}>
    {items.map(item => <Link key={item.id} href={item.href} prefetch={false} aria-current={current === item.id ? "page" : undefined} className={sectionTabClass}
      onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; onNavigate?.(event, item.href) }}>
      {item.label}{item.count != null && <span className="text-xs text-muted-foreground">{item.count}</span>}
    </Link>)}
  </nav>
}
