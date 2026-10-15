"use client"
import { useEffect, useRef, useState } from "react"
import { registerAutosaveNavigation } from "@/lib/autosave-navigation"

/** Lifecycle/recovery adapter for mature domain editors that already serialize their own saves. */
export function useAutosaveRecovery<T>({ identity, value, baseline, dirty, enabled, restore, flush }: { identity: string; value: T; baseline: string; dirty: boolean; enabled: boolean; restore: (value: T) => void; flush: () => Promise<void> }) {
  const latest = useRef({ value, baseline, dirty, restore, flush }); latest.current = { value, baseline, dirty, restore, flush }
  const [recovery, setRecovery] = useState<{ value: T } | null>(null)
  const restored = useRef(false)
  const key = `outclass:autosave:v1:${identity}`
  useEffect(() => {
    if (!enabled) return
    try {
      const raw = sessionStorage.getItem(key), stored = raw ? JSON.parse(raw) : null
      if (stored && Date.now() - stored.at < 7 * 86400000) {
        if (JSON.stringify(stored.value) === latest.current.baseline) sessionStorage.removeItem(key)
        else if (stored.baseline === latest.current.baseline) { restored.current = true; latest.current.restore(stored.value) }
        else setRecovery({ value: stored.value })
      } else if (raw) sessionStorage.removeItem(key)
    } catch { /* Recovery storage can be unavailable. */ }
    const save = () => { void latest.current.flush().catch(() => {}) }
    const collect = (event: Event) => { if (latest.current.dirty) (event as CustomEvent<Promise<void>[]>).detail.push(latest.current.flush()) }
    const unload = (event: BeforeUnloadEvent) => { if (latest.current.dirty) { event.preventDefault(); event.returnValue = "" } }
    const hidden = () => { if (document.visibilityState === "hidden") save() }
    window.addEventListener("online", save); window.addEventListener("beforeunload", unload); window.addEventListener("outclass:flush-editors", collect)
    document.addEventListener("visibilitychange", hidden)
    const unregister = registerAutosaveNavigation()
    return () => {
      window.removeEventListener("online", save); window.removeEventListener("beforeunload", unload); window.removeEventListener("outclass:flush-editors", collect)
      document.removeEventListener("visibilitychange", hidden); unregister()
    }
  }, [key, enabled])
  const serialized = JSON.stringify(value)
  useEffect(() => {
    if (!enabled || recovery) return
    if (restored.current && !dirty) { restored.current = false; return }
    restored.current = false
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify({ value: latest.current.value, baseline, at: Date.now() }))
      else sessionStorage.removeItem(key)
    } catch { /* The unload guard remains available. */ }
  }, [key, serialized, baseline, dirty, enabled, recovery])
  return { recovery: recovery?.value, restoreRecovery: () => { if (recovery) restore(recovery.value); setRecovery(null) }, discardRecovery: async () => { try { sessionStorage.removeItem(key) } catch {} setRecovery(null) }, onBlur: () => { if (!recovery) void flush().catch(() => {}) } }
}
