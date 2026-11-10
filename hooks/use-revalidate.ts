"use client"

import { useEffect, useRef } from "react"

/** Domain events that mean "data you may be showing has changed". Dispatch them after a successful mutation. */
export const DATA_CHANGED_EVENT = "outclass:data-changed"

/** Tell every mounted view to reload. Pass a scope (e.g. "tasks") so unrelated views can ignore it. */
export function announceDataChanged(scope?: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail: { scope } }))
}

/**
 * Keeps a view current without a Refresh button: reloads when the person returns to the
 * tab (at most once per `minIntervalMs`), when any of `events` fire, and when
 * `outclass:data-changed` fires for one of `scopes` (or with no scope).
 * `reload` should be idempotent and keep showing the current data while it runs.
 */
export function useRevalidate(reload: () => unknown, options: { events?: string[]; scopes?: string[]; enabled?: boolean; minIntervalMs?: number } = {}) {
  const { events = [], scopes, enabled = true, minIntervalMs = 15_000 } = options
  const latest = useRef(reload)
  useEffect(() => { latest.current = reload }, [reload])
  const eventKey = events.join("|"), scopeKey = scopes?.join("|") ?? ""
  useEffect(() => {
    if (!enabled) return
    let last = Date.now()
    const run = () => { last = Date.now(); void latest.current() }
    const onVisible = () => { if (document.visibilityState === "visible" && Date.now() - last >= minIntervalMs) run() }
    const onChanged = (event: Event) => {
      const scope = (event as CustomEvent<{ scope?: string }>).detail?.scope
      if (!scope || !scopeKey || scopeKey.split("|").includes(scope)) run()
    }
    const names = eventKey ? eventKey.split("|") : []
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    window.addEventListener(DATA_CHANGED_EVENT, onChanged)
    names.forEach(name => window.addEventListener(name, run))
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      window.removeEventListener(DATA_CHANGED_EVENT, onChanged)
      names.forEach(name => window.removeEventListener(name, run))
    }
  }, [enabled, eventKey, scopeKey, minIntervalMs])
}
