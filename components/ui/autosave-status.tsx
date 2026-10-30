"use client"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import type { AutosaveHandle } from "@/hooks/use-autosave"
export function AutosaveStatus({ save }: { save: Pick<AutosaveHandle, "state" | "error" | "flush"> & { retry?: () => void; recovery?: unknown; restoreRecovery?: () => void; discardRecovery?: () => Promise<void> } }) {
  if (save.recovery != null) return <div className="text-xs text-muted-foreground" role="status">A draft from an earlier version is available. <button type="button" className="underline" onClick={save.restoreRecovery}>Restore draft</button>{" · "}<button type="button" className="underline" onClick={() => void save.discardRecovery?.().catch(() => {})}>Discard old draft</button></div>
  if (save.state === "idle") return null
  return <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
    {save.state === "error" ? <><span>Couldn’t save — </span><button type="button" className="underline" onClick={() => save.retry ? save.retry() : void save.flush().catch(() => {})}>Retry</button>{save.error && <span className="ml-2">{save.error}</span>}</> : save.state === "saved" ? "Saved" : <><LoadingIndicator size="sm" /><span>Saving…</span></>}
  </div>
}
