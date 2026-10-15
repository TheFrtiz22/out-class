"use client"
import { useEffect, useRef, useState } from "react"
import { registerAutosaveNavigation } from "@/lib/autosave-navigation"
import { AutosaveQueue, type AutosaveState } from "@/lib/autosave-queue"

export type AutosaveHandle = { state: AutosaveState; error: string; dirty: boolean; saving: boolean; flush: () => Promise<void>; reset: () => Promise<void>; onBlur: () => void; recovery?: unknown; restoreRecovery?: () => void; discardRecovery?: () => Promise<void> }
/** Versioned, account/resource scoped recovery stays in this tab and expires after seven days. */
export function useAutosave<T>({ identity, value, save, enabled = true, restore }: { identity: string; value: T; save: (value: T) => Promise<void>; enabled?: boolean; restore?: (value: T) => void }): AutosaveHandle {
  const [, render] = useState(0)
  const latest = useRef({ identity, value, save, restore }); latest.current = { identity, value, save, restore }
  const holder = useRef<{ identity: string; queue: AutosaveQueue<T>; recovery: { value: T } | null; ignore?: string } | null>(null)
  useEffect(() => {
    if (!enabled) return
    const key = `outclass:autosave:v1:${identity}`
    const original = latest.current, writer = crypto.randomUUID()
    let baseline = JSON.stringify(original.value)
    const originalValue = baseline
    const recover = (content: T | null) => {
      try {
        if (content === null) {
          const raw = sessionStorage.getItem(key), current = raw ? JSON.parse(raw) : null
          if (!current || current.writer === writer) sessionStorage.removeItem(key)
          baseline = JSON.stringify(queue.value)
        }
        else sessionStorage.setItem(key, JSON.stringify({ value: content, baseline, writer, at: Date.now() }))
      } catch { /* The unload guard remains active when storage is unavailable. */ }
    }
    const saveCurrent = (data: T) => (latest.current.identity === identity ? latest.current.save : original.save)(data)
    const queue = new AutosaveQueue(original.value, saveCurrent, () => render(n => n + 1), recover)
    const entry: NonNullable<typeof holder.current> = { identity, queue, recovery: null }
    holder.current = entry
    try {
      const raw = sessionStorage.getItem(key), stored = raw ? JSON.parse(raw) : null
      if (stored && Date.now() - stored.at < 7 * 86400000 && original.restore && typeof stored.value === typeof original.value && Array.isArray(stored.value) === Array.isArray(original.value) && (stored.value !== null || original.value === null)) {
        if (JSON.stringify(stored.value) === baseline) sessionStorage.removeItem(key)
        else if (stored.baseline !== baseline) entry.recovery = { value: stored.value }
        else { original.restore(stored.value); queue.change(stored.value); entry.ignore = originalValue }
      } else if (raw) sessionStorage.removeItem(key)
    } catch { /* Corrupt recovery never prevents editing. */ }
    render(n => n + 1)
    const flush = () => { void queue.flush().catch(() => {}) }
    const unload = (event: BeforeUnloadEvent) => {
      if (!queue.dirty) return
      recover(queue.value); flush(); event.preventDefault(); event.returnValue = ""
    }
    const hidden = () => { if (document.visibilityState === "hidden") flush() }
    window.addEventListener("beforeunload", unload); window.addEventListener("online", flush)
    document.addEventListener("visibilitychange", hidden)
    const collect = (event: Event) => {
      if (queue.dirty) (event as CustomEvent<Promise<void>[]>).detail.push(queue.flush())
    }
    window.addEventListener("outclass:flush-editors", collect)
    const unregisterNavigation = registerAutosaveNavigation()
    return () => {
      window.removeEventListener("beforeunload", unload); window.removeEventListener("online", flush)
      document.removeEventListener("visibilitychange", hidden); window.removeEventListener("outclass:flush-editors", collect)
      unregisterNavigation(); queue.dispose()
      if (queue.dirty) queueMicrotask(() => { if (holder.current?.identity !== identity) flush() })
      if (holder.current === entry) holder.current = null
    }
  }, [identity, enabled])
  const serialized = JSON.stringify(value)
  useEffect(() => {
    const entry = holder.current
    if (enabled && entry?.identity === identity && !entry.recovery) {
      if (entry.ignore === serialized) { entry.ignore = undefined; return }
      entry.queue.change(latest.current.value)
    }
  }, [serialized, enabled, identity])
  const entry = holder.current?.identity === identity ? holder.current : null, queue = entry?.queue
  async function flush() {
    if (entry?.recovery) throw Error("Resolve the recovered draft before continuing.")
    await queue?.flush()
  }
  return {
    state: queue?.state ?? "idle", error: queue?.error ?? "", dirty: queue?.dirty ?? false, saving: queue?.saving ?? false,
    flush, reset: async () => { await flush(); queue?.reset(latest.current.value) },
    onBlur: () => { void flush().catch(() => {}) }, recovery: entry?.recovery?.value,
    restoreRecovery: () => { if (!entry?.recovery) return; const content = entry.recovery.value; entry.recovery = null; latest.current.restore?.(content); queue?.change(content); render(n => n + 1) },
    discardRecovery: async () => { if (entry) entry.recovery = null; queue?.reset(latest.current.value); render(n => n + 1) },
  }
}
