"use client"
import Link from "next/link"
import { useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Underlined text tabs for page and sub-page navigation ("Drafts (1)"): a thin underline marks the
 * active tab, no filled pill. Tabs with `href` are links (bookmarkable, back button works); others call
 * `onChange`. A count of 0 fades the tab but keeps it clickable. The row scrolls sideways when narrow.
 * Keyboard: one tab stop, arrow keys / Home / End move focus, Enter or Space chooses.
 */
export type UnderlineTab<T extends string> = { id: T; label: ReactNode; count?: number; href?: string; disabled?: boolean; ariaLabel?: string }

export function UnderlineTabs<T extends string>({ label, items, value, onChange, onNavigate, className, id }: {
  label: string
  items: UnderlineTab<T>[]
  value: T | null | undefined
  onChange?: (value: T) => void
  /** Runs for plain left clicks on link tabs; call `event.preventDefault()` to take over navigation. */
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void
  className?: string
  id?: string
}) {
  const list = useRef<HTMLDivElement>(null)
  const enabled = items.map((item, i) => item.disabled ? -1 : i).filter(i => i >= 0)
  const selectedIndex = items.findIndex(item => item.id === value)
  const stop = selectedIndex >= 0 && !items[selectedIndex]?.disabled ? selectedIndex : enabled[0] ?? 0
  const onKeyDown = (event: KeyboardEvent<HTMLElement>, i: number) => {
    const at = enabled.indexOf(i)
    const target = event.key === "ArrowRight" ? enabled[(at + 1) % enabled.length]
      : event.key === "ArrowLeft" ? enabled[(at - 1 + enabled.length) % enabled.length]
      : event.key === "Home" ? enabled[0] : event.key === "End" ? enabled[enabled.length - 1] : undefined
    if (target === undefined) return
    event.preventDefault()
    list.current?.querySelectorAll<HTMLElement>("[role=tab]")[target]?.focus()
  }
  return <div ref={list} id={id} role="tablist" aria-label={label} aria-orientation="horizontal" data-slot="underline-tabs" className={cn("oc-underline-tabs", className)}>
    {items.map((item, i) => {
      const selected = item.id === value
      const content = <>{item.label}{item.count != null && <span className="oc-underline-tab-count">{" "}({item.count})</span>}</>
      const common = {
        role: "tab" as const, "aria-selected": selected, "aria-label": item.ariaLabel, tabIndex: i === stop ? 0 : -1,
        className: "oc-underline-tab", "data-value": item.id, "data-empty": item.count === 0 || undefined,
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, i),
      }
      return item.href && !item.disabled
        ? <Link key={item.id} href={item.href} prefetch={false} {...common} aria-current={selected ? "page" : undefined}
          onClick={event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
            onNavigate?.(event, item.href!)
            if (!event.defaultPrevented) onChange?.(item.id)
          }}>{content}</Link>
        : <button key={item.id} type="button" {...common} disabled={item.disabled}
          onClick={() => onChange?.(item.id)}>{content}</button>
    })}
  </div>
}
