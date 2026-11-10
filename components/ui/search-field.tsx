"use client"
import { useEffect, useRef, type ComponentProps } from "react"
import { Search as SearchIcon, X } from "@/components/icons"
import { cn } from "@/lib/utils"

export type SearchFieldProps = Omit<ComponentProps<"input">, "type" | "aria-label"> & {
  /** Required accessible name; the placeholder is never the label. */
  "aria-label": string
  /** Shows the clear (×) button while the field has a value. Callers own the query state. */
  onClear?: () => void
  /** A single key ("/") that focuses the field from anywhere on the page, shown as a hint while empty. */
  shortcut?: string
  /** Set false when the page already owns the shortcut (e.g. it must ignore an open drawer); the hint still shows. */
  shortcutListener?: boolean
  containerClassName?: string
}

const typingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/**
 * The pill search field: the segmented pills' glass track and height, a leading search icon,
 * a clear button and an optional keyboard-shortcut hint. Controlled or uncontrolled like an input;
 * it never owns filtering state.
 */
export function SearchField({ className, containerClassName, onClear, shortcut, shortcutListener = true, value, defaultValue, ref, onKeyDown, ...props }: SearchFieldProps) {
  const input = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (!shortcut || !shortcutListener) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== shortcut || event.metaKey || event.ctrlKey || event.altKey || typingTarget(event.target)) return
      event.preventDefault()
      input.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [shortcut, shortcutListener])
  const filled = value != null ? String(value).length > 0 : false
  return <div className={cn("oc-search-field", containerClassName)} data-slot="search-field" data-filled={filled || undefined}>
    <SearchIcon aria-hidden="true" className="oc-search-field-icon" />
    <input
      ref={node => { input.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node }}
      type="search" data-slot="search-input" autoComplete="off" value={value} defaultValue={defaultValue}
      aria-keyshortcuts={shortcut} className={cn("oc-search-field-input", className)}
      {...props}
      onKeyDown={event => { if (event.key === "Escape" && filled && onClear) { event.preventDefault(); onClear() } onKeyDown?.(event) }} />
    {onClear && filled && <button type="button" className="oc-search-field-clear" aria-label="Clear search"
      onClick={() => { onClear(); input.current?.focus() }}><X aria-hidden="true" /></button>}
    {shortcut && !filled && <kbd className="oc-search-field-shortcut" aria-hidden="true">{shortcut}</kbd>}
  </div>
}
