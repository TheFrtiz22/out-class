"use client"

import { useSyncExternalStore } from "react"
import { Megaphone, X } from "@/components/icons"
import { IconButton } from "@/components/ui/icon-button"

/** Short, stable key so a new campus notice reappears after an earlier one was dismissed. */
export function noticeDismissKey(text: string) {
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = (hash * 33 + text.charCodeAt(i)) >>> 0
  return `oc-campus-notice-dismissed:${hash.toString(36)}`
}

// Per-session dismissal: sessionStorage may be unavailable (private mode, blocked storage),
// in which case dismissal lasts until the next full page load (browser-only memory).
const listeners = new Set<() => void>()
const dismissedInMemory = new Set<string>()
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
function isDismissed(key: string) {
  if (dismissedInMemory.has(key)) return true
  try { return window.sessionStorage.getItem(key) === "1" } catch { return false }
}
function dismiss(key: string) {
  dismissedInMemory.add(key)
  try { window.sessionStorage.setItem(key, "1") } catch { /* in-memory dismissal still applies */ }
  listeners.forEach(listener => listener())
}

/** Campus notice from Admin settings. Rendered as plain text; never interpreted as HTML. */
export function CampusNotice({ text }: { text: string }) {
  const key = noticeDismissKey(text)
  // Server snapshot is "not dismissed", so SSR and hydration agree; the client then hides it.
  const dismissed = useSyncExternalStore(subscribe, () => isDismissed(key), () => false)
  if (!text || dismissed) return null
  return (
    <aside role="status" aria-label="Campus notice" data-site-notice="campus" className="border-b border-border bg-info-subtle text-foreground">
      <div className="mx-auto flex max-w-[var(--oc-content-width)] items-start gap-3 px-4 py-2 sm:px-6">
        <Megaphone className="mt-0.5 size-4 shrink-0 text-info" />
        <p className="min-w-0 flex-1 whitespace-pre-line break-words text-sm">{text}</p>
        <IconButton size="icon-sm" aria-label="Dismiss campus notice" className="-my-1 -mr-2 shrink-0" onClick={() => dismiss(key)}>
          <X />
        </IconButton>
      </div>
    </aside>
  )
}
