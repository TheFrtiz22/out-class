"use client"
import { UserFacingError } from "@/lib/action-result"
import { useEffect, useRef, useState } from "react"
import { registerAutosaveNavigation } from "@/lib/autosave-navigation"
import { AutosaveQueue, type AutosaveState } from "@/lib/autosave-queue"
import { createDraftStore, recoveryDecision, validDraftOwner, type DraftPersistence } from "@/lib/autosave-store"

export type AutosaveHandle = { state: AutosaveState; error: string; dirty: boolean; saving: boolean; flush: () => Promise<void>; reset: () => Promise<void>; onBlur: () => void; recovery?: unknown; restoreRecovery?: () => void; discardRecovery?: () => Promise<void>; recoveryKind?: RecoveryKind; reviewRecovery?: () => void; reviewing?: boolean }
/** "local": an unsaved copy from this device, newer than the server's version. "conflict": the server moved on since the copy was made. */
export type RecoveryKind = "local" | "conflict"
/**
 * Versioned, account/resource scoped recovery that expires after seven days.
 * With a signed-in `owner`, unsaved edits also survive a browser restart on this device
 * (localStorage); `persistence: "tab"` keeps screens with private data about other students
 * in memory and sessionStorage only. A copy is never applied over newer server data: it is
 * offered, and a copy whose baseline no longer matches is shown as a conflict that can only be
 * dismissed ("Keep newer version") or read ("Review my copy"); it is never restored or saved.
 * While a copy is offered or reviewed, the queue is held and edits snap back, so nothing overwrites it.
 */
export function useAutosave<T>({ identity, value, save, enabled = true, restore, owner, persistence = "device" }: { identity: string; value: T; save: (value: T) => Promise<void>; enabled?: boolean; restore?: (value: T) => void; owner?: string | null; persistence?: DraftPersistence }): AutosaveHandle {
  const [, render] = useState(0)
  const latest = useRef({ identity, value, save, restore }); latest.current = { identity, value, save, restore }
  const holder = useRef<{ identity: string; queue: AutosaveQueue<T>; recovery: { value: T; kind: RecoveryKind } | null; reviewing?: boolean; ignore?: string; discard: () => void } | null>(null)
  const signedIn = validDraftOwner(owner), storeOwner = signedIn ? owner : "tab", storeMode: DraftPersistence = signedIn ? persistence : "tab"
  useEffect(() => {
    if (!enabled) return
    const store = createDraftStore<T>({ owner: storeOwner, identity, persistence: storeMode })
    const original = latest.current, writer = crypto.randomUUID()
    let baseline = JSON.stringify(original.value)
    const originalValue = baseline
    const recover = (content: T | null) => {
      if (content === null) { store.clear(writer); baseline = JSON.stringify(queue.value); return }
      // The store swallows storage failures; the unload guard remains active either way.
      return store.write({ value: content, baseline, writer, at: Date.now() })
    }
    const saveCurrent = (data: T) => (latest.current.identity === identity ? latest.current.save : original.save)(data)
    const queue = new AutosaveQueue(original.value, saveCurrent, () => render(n => n + 1), recover)
    const entry: NonNullable<typeof holder.current> = { identity, queue, recovery: null, discard: () => store.clear() }
    holder.current = entry
    try {
      const stored = store.read()
      if (stored && original.restore && typeof stored.value === typeof original.value && Array.isArray(stored.value) === Array.isArray(original.value) && (stored.value !== null || original.value === null)) {
        const decision = recoveryDecision(stored, baseline)
        if (decision === "discard") store.clear()
        else if (decision === "conflict") entry.recovery = { value: stored.value, kind: "conflict" }
        else if (decision === "apply") { original.restore(stored.value); queue.change(stored.value); entry.ignore = originalValue }
        else if (decision === "offer") entry.recovery = { value: stored.value, kind: "local" }
      } else if (stored) store.clear()
      if (entry.recovery) queue.hold()
    } catch { /* Corrupt recovery never prevents editing. */ }
    render(n => n + 1)
    const flush = () => { void queue.flush().catch(() => {}) }
    const unload = (event: BeforeUnloadEvent) => {
      if (!queue.dirty) return
      recover(queue.value); flush(); event.preventDefault(); event.returnValue = ""
    }
    const hidden = () => { if (document.visibilityState === "hidden") flush() }
    const offline = () => queue.markOffline()
    window.addEventListener("beforeunload", unload); window.addEventListener("online", flush); window.addEventListener("offline", offline)
    document.addEventListener("visibilitychange", hidden)
    const collect = (event: Event) => {
      if (queue.dirty) (event as CustomEvent<Promise<void>[]>).detail.push(queue.flush())
    }
    window.addEventListener("outclass:flush-editors", collect)
    const unregisterNavigation = registerAutosaveNavigation()
    return () => {
      window.removeEventListener("beforeunload", unload); window.removeEventListener("online", flush); window.removeEventListener("offline", offline)
      document.removeEventListener("visibilitychange", hidden); window.removeEventListener("outclass:flush-editors", collect)
      unregisterNavigation(); queue.dispose()
      if (queue.dirty) queueMicrotask(() => { if (holder.current?.identity !== identity) flush() })
      if (holder.current === entry) holder.current = null
    }
  }, [identity, enabled, storeOwner, storeMode])
  const serialized = JSON.stringify(value)
  useEffect(() => {
    const entry = holder.current
    if (!enabled || entry?.identity !== identity) return
    // Editing is blocked until the offered copy is restored or dismissed: revert to the loaded value.
    if (entry.recovery) { if (serialized !== JSON.stringify(entry.queue.value)) latest.current.restore?.(structuredClone(entry.queue.value)); return }
    if (entry.ignore === serialized) { entry.ignore = undefined; return }
    entry.queue.change(latest.current.value)
  }, [serialized, enabled, identity])
  const entry = holder.current?.identity === identity ? holder.current : null, queue = entry?.queue
  async function flush() {
    if (entry?.recovery) throw new UserFacingError("Resolve the recovered draft before continuing.")
    await queue?.flush()
  }
  return {
    state: queue?.state ?? "idle", error: queue?.error ?? "", dirty: queue?.dirty ?? false, saving: queue?.saving ?? false,
    flush, reset: async () => { await flush(); queue?.reset(latest.current.value) },
    onBlur: () => { void flush().catch(() => {}) }, recovery: entry?.recovery?.value, recoveryKind: entry?.recovery?.kind,
    reviewing: entry?.reviewing ?? false,
    // Only a copy that is newer than the server's version can be restored; a conflict copy never is.
    restoreRecovery: () => { if (entry?.recovery?.kind !== "local") return; const content = entry.recovery.value; entry.recovery = null; entry.reviewing = false; queue?.release(); latest.current.restore?.(content); queue?.change(content); render(n => n + 1) },
    reviewRecovery: () => { if (!entry?.recovery) return; entry.reviewing = true; render(n => n + 1) },
    discardRecovery: async () => { if (entry) { entry.recovery = null; entry.reviewing = false; entry.discard() } queue?.release(); queue?.reset(latest.current.value); render(n => n + 1) },
  }
}
